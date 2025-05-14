import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { callGeminiApi, rpmControlledBatch } from './geminiCaller.mjs';

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
};

console.log('已从.env文件加载配置', config);

// 读取prompt模板
const promptTemplate = fs.readFileSync(path.join(process.cwd(), 'nameGeneratorPrompt.md'), 'utf8');

/**
 * 批量处理诗歌生成名字建议
 * @async
 */
async function batchGenerateNamesFromPoems() {
  try {
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

    // 过滤掉已经处理过的诗歌
    const poemsToProcess = selectedPoems.filter(poem => {
      const outputFileName = `${poem.title}_${poem.author}.json`;
      const outputPath = path.join(config.batchProcess.outputDir, outputFileName.replace(/[\\/:*?"<>|]/g, '_'));
      const exists = fs.existsSync(outputPath);
      if (exists) {
        // console.log(`文件 ${outputPath} 已存在，跳过《${poem.title}》(${poem.author})`);
      }
      return !exists;
    });

    console.log(`过滤后需要处理的诗歌数量：${poemsToProcess.length}首`);

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

        // 使用模板构建提示词
        const prompt = promptTemplate + poemText;

        // 调用Gemini API
        console.log(`处理诗《${title}》(${author})...`);
        const result = await callGeminiApi(modelName, prompt, config.gemini.timeout);

        // 确保输出目录存在
        if (!fs.existsSync(path.join(config.batchProcess.outputDir))) {
          fs.mkdirSync(path.join(config.batchProcess.outputDir), { recursive: true });
        }

        // 写入文件
        const outputFileName = `${title}_${author}.json`;
        const outputPath = path.join(config.batchProcess.outputDir, outputFileName.replace(/[\\/:*?"<>|]/g, '_'));
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
    const batchArgs = poemsToProcess.map(poem => [config.gemini.model, poem]);

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