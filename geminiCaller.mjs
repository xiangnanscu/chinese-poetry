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

        console.log(`正在向模型 <span class="math-inline">\{modelName\} 发送 Prompt\: "</span>{promptText}"`);

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
        console.log("从 Gemini API 收到的原始文本响应:\n", responseText);

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

  // 用于跟踪时间窗口内的请求数
  let requestsInWindow = 0;
  let windowStartTime = Date.now();
  const windowDuration = 60 * 1000; // 1分钟的毫秒数

  // 创建任务索引队列
  const taskQueue = Array.from({ length: fnArgs.length }, (_, i) => i);
  const results = new Array(fnArgs.length);
  const executing = new Set();

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
      executing.delete(taskIndex);

      // 尝试执行下一个任务
      const nextIndex = taskQueue.shift();
      if (nextIndex !== undefined) {
        executing.add(nextIndex);
        executeTask(nextIndex);
      }
      return;
    }

    // 检查是否需要限制请求频率
    const now = Date.now();
    const timeElapsed = now - windowStartTime;

    if (timeElapsed >= windowDuration) {
      // 如果已经过了一个时间窗口，重置计数器和窗口起始时间
      windowStartTime = now;
      requestsInWindow = 0;
    } else if (requestsInWindow >= rpm) {
      // 如果当前窗口的请求数已达到上限，等待到下一个窗口
      const waitTime = windowDuration - timeElapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 重置窗口
      windowStartTime = Date.now();
      requestsInWindow = 0;
    }

    // 增加请求计数器
    requestsInWindow++;

    try {
      // 执行异步函数
      console.log(`执行任务 #${taskIndex+1}，参数:`, args);
      results[taskIndex] = await asyncFn(...args);
    } catch (error) {
      console.error(`任务 #${taskIndex+1} 执行出错:`, error);
      results[taskIndex] = { error };
    } finally {
      executing.delete(taskIndex);

      // 尝试执行下一个任务
      const nextIndex = taskQueue.shift();
      if (nextIndex !== undefined) {
        executing.add(nextIndex);
        executeTask(nextIndex);
      }
    }
  }

  // 启动初始批次的任务
  const initialBatchSize = Math.min(maxConcurrent, taskQueue.length);
  for (let i = 0; i < initialBatchSize; i++) {
    const taskIndex = taskQueue.shift();
    if (taskIndex !== undefined) {
      executing.add(taskIndex);
      executeTask(taskIndex); // 立即开始执行任务
    }
  }

  // 等待所有任务完成
  while (executing.size > 0) {
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