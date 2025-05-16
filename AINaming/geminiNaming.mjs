import fs from 'fs';
import path from 'path';
import { callGeminiApi } from './geminiCaller.mjs';

/**
 * 读取指定文件夹下所有JSON文件，处理内容并调用Gemini API生成名字
 * @param {string} folderPath - 包含JSON文件的文件夹路径
 * @returns {Promise<void>}
 */
async function processFolder(folderPath) {
  try {
    // 确保输出目录存在
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 读取提示模板
    const promptTemplatePath = path.join(process.cwd(), 'AINaming', 'nameGeneratorPromptMega.md');
    const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf-8');

    // 获取所有JSON文件
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'));

    // 逐个处理文件
    for (const file of files) {
      console.log(`处理文件: ${file}`);
      const filePath = path.join(folderPath, file);
      const outputPath = path.join(outputDir, `${path.basename(file, '.json')}.md`);

      // 解析JSON文件
      const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // 处理JSON内容
      const processedContent = processJsonContent(jsonContent);

      // 如果没有有效内容，跳过该文件
      if (!processedContent) {
        console.log(`文件 ${file} 没有找到有效内容，跳过`);
        continue;
      }

      // 组合提示词
      const fullPrompt = `${promptTemplate}${processedContent}`;

      // 调用Gemini API
      console.log(`调用Gemini API生成名字...`, fullPrompt.length);
      const config = {
        temperature: 0.8,
        // maxOutputTokens: 4096,
        responseMimeType: "text/plain"
      };
      const result = await callGeminiApi("gemini-2.5-flash-preview-04-17", fullPrompt, config);

      // 将结果保存到输出文件
      fs.writeFileSync(outputPath, result, 'utf-8');
      console.log(`结果已保存到: ${outputPath}`);
    }

    console.log('所有文件处理完成');
  } catch (error) {
    console.error('处理文件夹时出错:', error);
  }
}

/**
 * 处理JSON内容，提取标题和内容
 * @param {any} jsonContent - JSON内容
 * @returns {string} - 处理后的文本
 */
function processJsonContent(jsonContent) {
  // 确保JSON内容是数组
  if (!Array.isArray(jsonContent)) {
    console.log('JSON内容不是数组，跳过');
    return '';
  }

  // 处理每个数组成员
  const processedLines = jsonContent.map(item => {
    if (!item || typeof item !== 'object') return null;

    const title = item.title || '';

    // 获取内容，可能在content或paragraphs字段中
    let contentText = '';
    if (Array.isArray(item.content)) {
      contentText = item.content.join('');
    } else if (Array.isArray(item.paragraphs)) {
      contentText = item.paragraphs.join('');
    }

    // 如果有标题和内容，则返回格式化的行
    if (title && contentText) {
      return `《${title}》${contentText}`;
    }

    return null;
  }).filter(Boolean); // 过滤掉空值

  return processedLines.join('\n');
}

/**
 * 命令行入口函数
 */
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('使用方法: node geminiNaming.mjs <文件夹路径>');
    return;
  }

  const folderPath = args[0];

  // 检查文件夹是否存在
  if (!fs.existsSync(folderPath)) {
    console.error(`错误: 文件夹 "${folderPath}" 不存在`);
    return;
  }

  await processFolder(folderPath);
}

// 当脚本直接运行时执行main函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('执行过程中出错:', error);
    process.exit(1);
  });
}

export { processFolder };
