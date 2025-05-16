const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 使用立即执行的异步函数
(async () => {
  try {
    // 从.env文件加载环境变量
    dotenv.config();

    // 设置测试环境变量
    process.env.START_INDEX = "0";
    process.env.END_INDEX = "3";
    process.env.OUTPUT_DIR = "诗名建议_测试";

    console.log('已设置测试环境变量，将只处理前3首诗');

    // 执行批处理脚本
    console.log('开始执行批处理...');
    // 使用动态导入执行脚本
    await import('./batchNameGenerator.mjs');

  } catch (error) {
    console.error('测试批处理时发生错误:', error);
  }
})();