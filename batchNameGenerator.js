const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 从.env文件加载环境变量
dotenv.config();

// 从环境变量中读取配置
const config = {
  gemini: {
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash-latest",
    timeout: parseInt(process.env.GEMINI_TIMEOUT || "30000")
  },
  batchProcess: {
    rpm: parseInt(process.env.BATCH_RPM || "10"),
    maxConcurrent: parseInt(process.env.BATCH_MAX_CONCURRENT || "3"),
    outputDir: process.env.OUTPUT_DIR || "诗名建议",
    startIndex: parseInt(process.env.START_INDEX || "0"),
    endIndex: parseInt(process.env.END_INDEX || "-1")
  },
  mockMode: process.env.MOCK_MODE === "true"
};

console.log('已从.env文件加载配置');

/**
 * 生成模拟的名字建议
 * @param {Object} poem - 诗歌对象
 * @returns {Array} 名字建议数组
 */
function generateMockNameSuggestions(poem) {
  const { title, author, paragraphs } = poem;

  // 从诗中提取一些字符
  const firstLine = paragraphs[0] || '';
  const lastLine = paragraphs[paragraphs.length - 1] || '';

  // 生成一些模拟名字
  const mockNames = [
    {
      name: firstLine.slice(0, 2).replace(/[，。？！,.!?]/g, ''),
      sex: Math.random() > 0.5 ? "男" : "女",
      desc: "取自诗的开头，寓意美好事物的开始"
    },
    {
      name: lastLine.slice(0, 2).replace(/[，。？！,.!?]/g, ''),
      sex: "通用",
      desc: "取自诗的结尾，象征圆满和成就"
    }
  ];

  return mockNames;
}

/**
 * 批量处理诗歌生成名字建议
 * @async
 */
async function batchGenerateNamesFromPoems() {
  try {
    let callGeminiApi, rpmControlledBatch;

    if (!config.mockMode) {
      console.log('导入geminiCaller模块...');
      // 使用动态导入ES模块
      const geminiModule = await import('./geminiCaller.mjs');
      callGeminiApi = geminiModule.callGeminiApi;
      rpmControlledBatch = geminiModule.rpmControlledBatch;
    } else {
      console.log('使用模拟模式，不调用实际API');
      // 模拟API调用函数
      callGeminiApi = async (modelName, prompt) => {
        console.log(`[模拟]调用API，模型: ${modelName}`);
        // 从prompt中提取诗的文本
        const poemTextMatch = prompt.match(/这首诗是：([\s\S]+)$/);
        if (poemTextMatch && poemTextMatch[1]) {
          const poemLines = poemTextMatch[1].split('\n').filter(line => line.trim());
          const poem = { paragraphs: poemLines };
          return generateMockNameSuggestions(poem);
        }
        return [{ name: "模拟", sex: "通用", desc: "这是模拟生成的名字建议" }];
      };

      // 模拟批处理函数
      rpmControlledBatch = async (asyncFn, fnArgs, options) => {
        console.log(`[模拟]批处理，参数: rpm=${options.rpm}, maxConcurrent=${options.maxConcurrent}`);
        return Promise.all(fnArgs.map(args => asyncFn(...args)));
      };
    }

    // 读取唐诗三百首json文件
    const poemsFilePath = path.join('全唐诗', '唐诗三百首.json');
    const poemsData = fs.readFileSync(poemsFilePath, 'utf8');
    const poems = JSON.parse(poemsData);

    console.log(`共读取到${poems.length}首诗`);

    // 处理起始和结束索引
    const startIndex = config.batchProcess.startIndex || 0;
    const endIndex = config.batchProcess.endIndex < 0 ? poems.length : Math.min(config.batchProcess.endIndex, poems.length);

    // 选取指定范围的诗进行处理
    const selectedPoems = poems.slice(startIndex, endIndex);
    console.log(`将处理第${startIndex+1}到第${endIndex}首诗，共${selectedPoems.length}首`);

    /**
     * 为一首诗生成名字建议
     * @param {string} modelName - Gemini模型名称
     * @param {Object} poem - 诗歌对象
     * @returns {Promise<Object>} 包含处理结果的对象
     */
    async function generateNameForPoem(modelName, poem) {
      try {
        // 获取标题、作者和内容
        const { title, author, paragraphs } = poem;

        // 将段落用\n连接成一个字符串
        const poemText = paragraphs.join('\n');

        // 构建提示词
        const prompt = `你将扮演姓名生成器, 根据我给你的古诗词, 你要从种找出适合作为名字的两个字. 要求一: 两个字要么是连续的, 要么是特殊位置的字组合(例如每个诗句的首字或尾字). 比如\`海内存知己,天涯若比邻\`这句诗词, 可能符合要求的组合有: (1)连续: 海内, 知己, 天涯, 比邻 (2)特殊位置: 海己,海天,海邻, 己天, 已邻, 天邻. 要求二: 名字要有积极向上或吉祥美好的内涵. 要求三: 发音要顺口,音调要抑扬顿挫. 对于你选出来的每个组合, 你需要说明理由. 要求四: 要注明适合男性还是女性,或是两者皆可. 要求五:你应以JSON格式回应, 且把繁体中文转化为简体。例如针对之前提到那句诗词, 你可以这样回应: \`[{name:"海邻",sex:"男",desc:"志向远大,高朋满座"}]\`. 这首诗是：${poemText}`;

        // 调用Gemini API
        console.log(`处理诗《${title}》(${author})...`);
        const result = await callGeminiApi(modelName, prompt, config.gemini.timeout);

        // 保存结果到json文件
        const outputFileName = `${title}_${author}.json`;
        const outputPath = path.join(config.batchProcess.outputDir, outputFileName.replace(/[\\/:*?"<>|]/g, '_'));

        // 确保输出目录存在
        if (!fs.existsSync(path.join(config.batchProcess.outputDir))) {
          fs.mkdirSync(path.join(config.batchProcess.outputDir), { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`已保存名字建议到: ${outputPath}`);

        return {
          title,
          author,
          result,
          success: true
        };

      } catch (error) {
        console.error(`处理诗《${poem.title}》(${poem.author})时出错:`, error);
        return {
          title: poem.title,
          author: poem.author,
          error: error.message,
          success: false
        };
      }
    }

    // 准备批处理参数
    const batchArgs = selectedPoems.map(poem => [config.gemini.model, poem]);

    // 使用rpmControlledBatch控制API调用频率
    const results = await rpmControlledBatch(
      generateNameForPoem,
      batchArgs,
      {
        rpm: config.batchProcess.rpm,
        maxConcurrent: config.batchProcess.maxConcurrent
      }
    );

    // 统计处理结果
    const successCount = results.filter(r => r && r.success).length;
    const failCount = results.length - successCount;

    console.log(`批量处理完成，成功: ${successCount}，失败: ${failCount}`);

    // 将所有处理结果写入一个汇总文件
    const summaryPath = path.join(config.batchProcess.outputDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      totalPoems: selectedPoems.length,
      successCount,
      failCount,
      results
    }, null, 2), 'utf8');
    console.log(`处理汇总已保存到: ${summaryPath}`);

  } catch (error) {
    console.error('批量生成名字过程中发生错误:', error);
  }
}

// 执行批量处理函数
batchGenerateNamesFromPoems();