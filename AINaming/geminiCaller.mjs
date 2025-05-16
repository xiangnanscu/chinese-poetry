import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config(); // 从 .env 文件加载环境变量

/**
 * 调用 Gemini API，并期望模型返回 JSON 字符串，然后解析并返回结果对象。
 *
 * @param {string} modelName 要使用的 Gemini 模型的名称 (例如 "gemini-1.5-flash-latest").
 * @param {string} promptText 发送给模型的 Prompt。这个 Prompt 应该指示模型返回 JSON 格式的字符串。
 * @returns {Promise<object>} 一个 Promise，解析为从模型响应中解析得到的 JSON 对象。
 * @throws {Error} 如果 API 调用失败、API 密钥缺失或响应无法解析为 JSON。
 */
async function callGeminiApi(modelName, promptText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("错误: 环境变量中未设置 GEMINI_API_KEY。");
        throw new Error("GEMINI_API_KEY 未设置。");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // 配置生成参数，强制输出 JSON
        const generationConfig = {
            // temperature: 0.7, // 例如，按需调整
            // maxOutputTokens: 2048, // 例如
            responseMimeType: "application/json", // 强制模型输出 JSON
        };

        const model = genAI.getGenerativeModel({
            model: modelName,
            // 可选: 配置安全设置 (如果需要)
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              // 根据需要添加更多安全设置
            ],
            generationConfig, // 应用生成配置
        });

        // console.log(`正在向模型 <span class="math-inline">\{modelName\} 发送 Prompt\: "</span>{promptText}"`);

        // 使用 GenerateContentRequest 对象结构来传递 prompt 和 generationConfig
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            // generationConfig 已在模型初始化时设置，也可在此处覆盖
        });

        // 非流式响应
        const response = result.response;

        if (!response) {
            console.error("错误: Gemini API 返回了空的响应对象。");
             // 检查是否有 promptFeedback 指示为何请求可能被阻止
            if (result.promptFeedback && result.promptFeedback.blockReason) {
                throw new Error(`请求因安全原因被阻止: ${result.promptFeedback.blockReason}。详情: ${JSON.stringify(result.promptFeedback.safetyRatings)}`);
            }
            throw new Error("从 Gemini API 接收到无效或空的响应。");
        }

        if (!response.candidates || response.candidates.length === 0) {
            console.error("错误: Gemini API 响应中没有候选内容。", response);
             // 再次检查 promptFeedback
            if (response.promptFeedback && response.promptFeedback.blockReason) {
                throw new Error(`请求可能因以下原因被阻止: ${response.promptFeedback.blockReason}。详细信息: ${JSON.stringify(response.promptFeedback.blockReasonMessage || response.promptFeedback.safetyRatings)}`);
            }
            throw new Error("Gemini API 响应中没有有效的候选内容。");
        }

        const candidate = response.candidates[0];

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            // 处理响应可能被阻止或为空的情况
            if (candidate.finishReason && candidate.finishReason !== "STOP") {
                throw new Error(`内容生成因 ${candidate.finishReason} 而结束。安全评级: ${JSON.stringify(candidate.safetyRatings)}`);
            }
            throw new Error("在 Gemini API 响应候选内容中未找到文本。");
        }

        const responseText = candidate.content.parts[0].text;
        // console.log("从 Gemini API 收到的原始文本响应:\n", responseText);

        try {
            // responseMimeType: "application/json" 应该确保 responseText 是一个有效的 JSON 字符串。
            // SDK 在某些情况下甚至可能自动解析它，但显式解析更安全。
            const jsonResult = JSON.parse(responseText);
            return jsonResult;
        } catch (parseError) {
            console.error("错误: 解析 Gemini 响应为 JSON 时失败:", parseError);
            console.error("解析失败的原始响应:", responseText);
            throw new Error(`解析 Gemini 响应为 JSON 失败。原始文本: ${responseText.substring(0, 200)}...`);
        }

    } catch (error) {
        console.error("错误: 调用 Gemini API 或处理响应时出错:", error.message);
        if (error.response && error.response.data) { // 针对底层 HTTP 客户端未被 SDK 捕获的错误
            console.error("API 错误详情:", error.response.data);
        }
        // 重新抛出错误，以便调用者可以处理它
        throw error;
    }
}

/**
 * RPM并发控制函数，用于限制异步函数的调用频率和并发数
 *
 * @param {Function} asyncFn 要执行的异步函数
 * @param {Array} fnArgs 传递给异步函数的参数数组列表，每个元素是一组参数
 * @param {Object} options 配置选项
 * @param {number} options.rpm 每分钟最大请求数，默认为10
 * @param {number} options.maxConcurrent 最大并发数，默认与rpm相同
 * @returns {Promise<Array>} 返回所有异步函数执行结果的数组
 */
async function rpmControlledBatch(asyncFn, fnArgs, options = {}) {
  const rpm = options.rpm || 10; // 默认每分钟10次请求
  const maxConcurrent = options.maxConcurrent || rpm; // 默认最大并发数与rpm相同

  // 用于跟踪时间窗口内的请求
  let requestTimestamps = []; // 记录每个请求的时间戳
  const windowDuration = 60 * 1000; // 1分钟的毫秒数

  // 创建任务索引队列
  const taskQueue = Array.from({ length: fnArgs.length }, (_, i) => i);
  const results = new Array(fnArgs.length);
  let activeTaskCount = 0; // 当前活跃任务数
  let processingQueue = false; // 标记是否正在处理队列

  // 计算下一个请求需要等待的时间
  function getTimeUntilNextSlot() {
    const now = Date.now();

    // 清理一分钟窗口外的旧时间戳
    requestTimestamps = requestTimestamps.filter(ts => now - ts < windowDuration);

    // 如果窗口内请求数小于rpm限制，可以立即发送
    if (requestTimestamps.length < rpm) {
      return 0;
    }

    // 否则，需要等待最早的请求移出窗口
    const oldestRequest = requestTimestamps[0];
    const waitTime = (oldestRequest + windowDuration) - now;

    return Math.max(0, waitTime + 100); // 额外增加100ms缓冲
  }

  // 异步互斥锁，确保同一时间只有一个任务在检查和更新请求计数
  async function acquireRateLimitSlot() {
    const waitTime = getTimeUntilNextSlot();

    if (waitTime > 0) {
      console.log(`RPM限制已达到(${requestTimestamps.length}/${rpm})。等待 ${waitTime} 毫秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 重新检查，因为可能有其他任务在等待期间获取了时间槽
      return acquireRateLimitSlot();
    }

    // 记录当前请求时间戳并排序
    const now = Date.now();
    requestTimestamps.push(now);
    requestTimestamps.sort((a, b) => a - b);

    return true;
  }

  // 定义任务执行函数
  async function executeTask(taskIndex) {
    // 安全检查：确保任务索引有效
    if (taskIndex === undefined || taskIndex < 0 || taskIndex >= fnArgs.length) {
      console.error(`无效的任务索引: ${taskIndex}`);
      return;
    }

    // 获取参数
    const args = fnArgs[taskIndex];

    // 安全检查：确保参数是数组
    if (!Array.isArray(args)) {
      console.error(`任务 #${taskIndex+1} 的参数不是数组: ${args}`);
      results[taskIndex] = { error: new Error("任务参数必须是数组") };
      completeTask();
      return;
    }

    try {
      // 获取频率限制许可
      await acquireRateLimitSlot();

      // 执行异步函数
      results[taskIndex] = await asyncFn(...args);
    } catch (error) {
      console.error(`任务 #${taskIndex+1} 执行出错:`, error);
      results[taskIndex] = { error };

      // 如果是API限制错误(429)，从错误中获取重试延迟信息并全局应用
      if (error.status === 429 && error.errorDetails) {
        try {
          const retryInfo = error.errorDetails.find(d => d['@type'] && d['@type'].includes('RetryInfo'));
          if (retryInfo && retryInfo.retryDelay) {
            const retryDelaySec = retryInfo.retryDelay.replace('s', '');
            const retryDelayMs = parseInt(retryDelaySec) * 1000;

            if (retryDelayMs > 0) {
              console.log(`API请求被限制，根据API建议暂停所有请求${retryDelayMs}毫秒...`);
              // 添加一个未来的时间戳，确保在指定延迟后才能继续请求
              const blockingTimestamp = Date.now() - windowDuration + retryDelayMs;
              // 添加rpm个这样的时间戳，确保接下来的请求会被延迟处理
              for (let i = 0; i < rpm; i++) {
                requestTimestamps.push(blockingTimestamp);
              }
              requestTimestamps.sort((a, b) => a - b);
            }
          }
        } catch (e) {
          // 如果无法解析重试信息，添加默认延迟
          console.log(`API请求被限制，暂停所有请求30秒...`);
          const blockingTimestamp = Date.now() - windowDuration + 30000;
          for (let i = 0; i < rpm; i++) {
            requestTimestamps.push(blockingTimestamp);
          }
          requestTimestamps.sort((a, b) => a - b);
        }
      }
    } finally {
      completeTask();
    }
  }

  // 任务完成后的处理
  function completeTask() {
    activeTaskCount--;
    // 使用setTimeout确保有一定延迟后再处理队列
    setTimeout(() => processQueue(), 50);
  }

  // 处理队列，启动新任务
  async function processQueue() {
    if (processingQueue) return; // 如果已经在处理队列，则直接返回
    processingQueue = true;

    try {
      // 当有空闲槽位且队列中还有任务时，启动新任务
      while (activeTaskCount < maxConcurrent && taskQueue.length > 0) {
        // 检查是否可以立即发送请求，否则延迟处理队列
        const waitTime = getTimeUntilNextSlot();
        if (waitTime > 0) {
          // 如果需要等待，延迟后重新处理队列
          setTimeout(() => processQueue(), waitTime);
          break;
        }

        const taskIndex = taskQueue.shift();
        if (taskIndex !== undefined) {
          activeTaskCount++;
          // 异步执行任务，但不急于返回控制流
          setTimeout(() => executeTask(taskIndex), 0);
        }
      }
    } finally {
      processingQueue = false;
    }
  }

  // 初始化处理队列
  processQueue();

  // 等待所有任务完成
  while (activeTaskCount > 0 || taskQueue.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * 使用rpmControlledBatch的示例
 */
async function exampleRpmControlled() {
  // 准备一批调用参数
  const batchArgs = [
    ["gemini-1.5-flash-latest", "请返回JSON格式的北京简介"],
    ["gemini-1.5-flash-latest", "请返回JSON格式的上海简介"],
    ["gemini-1.5-flash-latest", "请返回JSON格式的广州简介"],
    // 可以添加更多参数组
  ];

  try {
    console.log("开始批量受控API调用...");
    const results = await rpmControlledBatch(
      callGeminiApi,
      batchArgs,
      { rpm: 10, maxConcurrent: 10 }
    );

    console.log("所有API调用已完成，结果:");
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`调用 #${index+1} 失败:`, result.error);
      } else {
        console.log(`调用 #${index+1} 成功:`, JSON.stringify(result, null, 2).substring(0, 100) + "...");
      }
    });

  } catch (error) {
    console.error("批量调用过程中发生错误:", error);
  }
}

// exampleRpmControlled()
// 导出函数
export { callGeminiApi, rpmControlledBatch };