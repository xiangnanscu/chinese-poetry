const fs = require('fs');
const path = require('path');
const { callGeminiApi } = require('./geminiCaller.mjs');

/**
 * 从唐诗三百首中为每首诗生成名字建议
 * @async
 */
async function generateNamesFromPoems() {
  try {
    // 读取唐诗三百首json文件
    const poemsFilePath = path.join('全唐诗', '唐诗三百首.json');
    const poemsData = fs.readFileSync(poemsFilePath, 'utf8');
    const poems = JSON.parse(poemsData);

    console.log(`共读取到${poems.length}首诗`);

    // 处理每首诗
    for (const poem of poems) {
      try {
        // 获取标题、作者和内容
        const { title, author, paragraphs } = poem;

        // 将段落用\n连接成一个字符串
        const poemText = paragraphs.join('\n');

        // 构建提示词
        const prompt = `你将扮演姓名生成器, 根据我给你的古诗词, 你要从种找出适合作为名字的两个字. 要求一: 两个字要么是连续的, 要么是特殊位置的字组合(例如每个诗句的首字或尾字). 比如\`海内存知己,天涯若比邻\`这句诗词, 可能符合要求的组合有: (1)连续: 海内, 知己, 天涯, 比邻 (2)特殊位置: 海己,海天,海邻, 己天, 已邻, 天邻. 要求二: 名字要有积极向上或吉祥美好的内涵. 要求三: 发音要顺口,音调要抑扬顿挫. 对于你选出来的每个组合, 你需要说明理由. 要求四: 要注明适合男性还是女性,或是两者皆可. 要求五:你应以JSON格式回应, 且把繁体中文转化为简体。例如针对之前提到那句诗词, 你可以这样回应: \`[{name:"海邻",sex:"男",desc:"志向远大,高朋满座"}]\`. 这首诗是：${poemText}`;

        // 调用Gemini API
        console.log(`处理诗《${title}》(${author})...`);
        const result = await callGeminiApi('gemini-1.5-flash-latest', prompt);

        // 保存结果到json文件
        const outputFileName = `${title}_${author}.json`;
        const outputPath = path.join('诗名建议', outputFileName.replace(/[\\/:*?"<>|]/g, '_'));

        // 确保输出目录存在
        if (!fs.existsSync(path.join('诗名建议'))) {
          fs.mkdirSync(path.join('诗名建议'), { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`已保存名字建议到: ${outputPath}`);

      } catch (error) {
        console.error(`处理诗《${poem.title}》时出错:`, error);
      }
    }

    console.log('所有诗词处理完成！');

  } catch (error) {
    console.error('生成名字过程中发生错误:', error);
  }
}

// 执行函数
generateNamesFromPoems();

module.exports = { generateNamesFromPoems };