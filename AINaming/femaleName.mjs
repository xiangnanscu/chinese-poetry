import fs from 'fs';
import { evaluatePinyinComboFluency, splitPinyin } from './pinyin.mjs';

// 项的拼音信息
const xiang = {
  initial: 'x',
  final: 'iang',
  tone: 4
};

// 第二个字的拼音数据
const secondCharacters = {
  // 其他常见字
  '明': { pinyin: 'ming', initial: 'm', final: 'ing', tone: 2 },
  '海': { pinyin: 'hai', initial: 'h', final: 'ai', tone: 3 },
  '子': { pinyin: 'zi', initial: 'z', final: 'i', tone: 3 },
  '梓': { pinyin: 'zi', initial: 'z', final: 'i', tone: 3 },
  '诗': { pinyin: 'shi', initial: 'sh', final: 'i', tone: 1 },
  '思': { pinyin: 'si', initial: 's', final: 'i', tone: 1 },
  '梦': { pinyin: 'meng', initial: 'm', final: 'eng', tone: 4 },
  '嘉': { pinyin: 'jia', initial: 'j', final: 'ia', tone: 1 },
  '欣': { pinyin: 'xin', initial: 'x', final: 'in', tone: 1 },
  '可': { pinyin: 'ke', initial: 'k', final: 'e', tone: 3 },
  '心': { pinyin: 'xin', initial: 'x', final: 'in', tone: 1 },
  '语': { pinyin: 'yu', initial: 'y', final: 'v', tone: 3 },
  '紫': { pinyin: 'zi', initial: 'z', final: 'i', tone: 3 },
  '亦': { pinyin: 'yi', initial: 'y', final: 'i', tone: 4 },
  '若': { pinyin: 'ruo', initial: 'r', final: 'uo', tone: 4 },
  '佳': { pinyin: 'jia', initial: 'j', final: 'ia', tone: 1 },
  '晓': { pinyin: 'xiao', initial: 'x', final: 'iao', tone: 3 },
  '如': { pinyin: 'ru', initial: 'r', final: 'u', tone: 2 },
  '尔': { pinyin: 'er', initial: '', final: 'er', tone: 3 },
  // 自然元素
  '雨': { pinyin: 'yu', initial: 'y', final: 'v', tone: 3 },
  '雪': { pinyin: 'xue', initial: 'x', final: 've', tone: 3 },
  '云': { pinyin: 'yun', initial: 'y', final: 'vn', tone: 2 },
  '霞': { pinyin: 'xia', initial: 'x', final: 'ia', tone: 2 },
  '露': { pinyin: 'lu', initial: 'l', final: 'u', tone: 4 },
  '冰': { pinyin: 'bing', initial: 'b', final: 'ing', tone: 1 },
  '霜': { pinyin: 'shuang', initial: 'sh', final: 'uang', tone: 1 },
  '月': { pinyin: 'yue', initial: 'y', final: 've', tone: 4 },
  '星': { pinyin: 'xing', initial: 'x', final: 'ing', tone: 1 },
  '阳': { pinyin: 'yang', initial: 'y', final: 'ang', tone: 2 },
  '春': { pinyin: 'chun', initial: 'ch', final: 'un', tone: 1 },
  '夏': { pinyin: 'xia', initial: 'x', final: 'ia', tone: 4 },
  '秋': { pinyin: 'qiu', initial: 'q', final: 'iu', tone: 1 },
  '冬': { pinyin: 'dong', initial: 'd', final: 'ong', tone: 1 },

  // 花草植物
  '芷': { pinyin: 'zhi', initial: 'zh', final: 'i', tone: 3 },
  '兰': { pinyin: 'lan', initial: 'l', final: 'an', tone: 2 },
  '梅': { pinyin: 'mei', initial: 'm', final: 'ei', tone: 2 },
  '菊': { pinyin: 'ju', initial: 'j', final: 'v', tone: 2 },
  '荷': { pinyin: 'he', initial: 'h', final: 'e', tone: 2 },
  '莲': { pinyin: 'lian', initial: 'l', final: 'ian', tone: 2 },
  '蓉': { pinyin: 'rong', initial: 'r', final: 'ong', tone: 2 },
  '桃': { pinyin: 'tao', initial: 't', final: 'ao', tone: 2 },
  '杏': { pinyin: 'xing', initial: 'x', final: 'ing', tone: 4 },
  '梨': { pinyin: 'li', initial: 'l', final: 'i', tone: 2 },
  '柳': { pinyin: 'liu', initial: 'l', final: 'iu', tone: 3 },
  '桂': { pinyin: 'gui', initial: 'g', final: 'ui', tone: 4 },
  '棠': { pinyin: 'tang', initial: 't', final: 'ang', tone: 2 },
  '茜': { pinyin: 'qian', initial: 'q', final: 'ian', tone: 4 },
  '茉': { pinyin: 'mo', initial: 'm', final: 'o', tone: 4 },
  '荔': { pinyin: 'li', initial: 'l', final: 'i', tone: 4 },
  '茵': { pinyin: 'yin', initial: 'y', final: 'in', tone: 1 },
  '菁': { pinyin: 'jing', initial: 'j', final: 'ing', tone: 1 },
  '菲': { pinyin: 'fei', initial: 'f', final: 'ei', tone: 1 },
  '薇': { pinyin: 'wei', initial: 'w', final: 'ei', tone: 1 },
  '萱': { pinyin: 'xuan', initial: 'x', final: 'van', tone: 1 },
  '葵': { pinyin: 'kui', initial: 'k', final: 'ui', tone: 2 },
  '芹': { pinyin: 'qin', initial: 'q', final: 'in', tone: 2 },
  '蔓': { pinyin: 'man', initial: 'm', final: 'an', tone: 4 },
  '蓝': { pinyin: 'lan', initial: 'l', final: 'an', tone: 2 },

  // 美好品质
  '雅': { pinyin: 'ya', initial: 'y', final: 'a', tone: 3 },
  '静': { pinyin: 'jing', initial: 'j', final: 'ing', tone: 4 },
  '慧': { pinyin: 'hui', initial: 'h', final: 'ui', tone: 4 },
  '敏': { pinyin: 'min', initial: 'm', final: 'in', tone: 3 },
  '淑': { pinyin: 'shu', initial: 'sh', final: 'u', tone: 1 },
  '惠': { pinyin: 'hui', initial: 'h', final: 'ui', tone: 4 },
  '秀': { pinyin: 'xiu', initial: 'x', final: 'iu', tone: 4 },
  '颖': { pinyin: 'ying', initial: 'y', final: 'ing', tone: 3 },
  '灵': { pinyin: 'ling', initial: 'l', final: 'ing', tone: 2 },
  '巧': { pinyin: 'qiao', initial: 'q', final: 'iao', tone: 3 },
  '婉': { pinyin: 'wan', initial: 'w', final: 'an', tone: 3 },
  '娴': { pinyin: 'xian', initial: 'x', final: 'ian', tone: 2 },
  '清': { pinyin: 'qing', initial: 'q', final: 'ing', tone: 1 },
  '安': { pinyin: 'an', initial: '', final: 'an', tone: 1 },
  '乐': { pinyin: 'le', initial: 'l', final: 'e', tone: 4 },
  '文': { pinyin: 'wen', initial: 'w', final: 'en', tone: 2 },
  '艺': { pinyin: 'yi', initial: 'y', final: 'i', tone: 4 },
  '依': { pinyin: 'yi', initial: 'y', final: 'i', tone: 1 },

  // 珍宝美玉
  '琼': { pinyin: 'qiong', initial: 'q', final: 'iong', tone: 2 },
  '瑶': { pinyin: 'yao', initial: 'y', final: 'ao', tone: 2 },
  '琳': { pinyin: 'lin', initial: 'l', final: 'in', tone: 2 },
  '璇': { pinyin: 'xuan', initial: 'x', final: 'van', tone: 2 },
  '琪': { pinyin: 'qi', initial: 'q', final: 'i', tone: 2 },
  '瑾': { pinyin: 'jin', initial: 'j', final: 'in', tone: 3 },
  '瑜': { pinyin: 'yu', initial: 'y', final: 'v', tone: 2 },
  '璐': { pinyin: 'lu', initial: 'l', final: 'u', tone: 4 },
  '玫': { pinyin: 'mei', initial: 'm', final: 'ei', tone: 2 },
  '瑰': { pinyin: 'gui', initial: 'g', final: 'ui', tone: 1 },
  '珍': { pinyin: 'zhen', initial: 'zh', final: 'en', tone: 1 },
  '珠': { pinyin: 'zhu', initial: 'zh', final: 'u', tone: 1 },
  '珊': { pinyin: 'shan', initial: 'sh', final: 'an', tone: 1 },
  '瑚': { pinyin: 'hu', initial: 'h', final: 'u', tone: 2 },
  '珀': { pinyin: 'po', initial: 'p', final: 'o', tone: 4 },
  '珂': { pinyin: 'ke', initial: 'k', final: 'e', tone: 1 },
  '珞': { pinyin: 'luo', initial: 'l', final: 'uo', tone: 4 },
  '珈': { pinyin: 'jia', initial: 'j', final: 'ia', tone: 1 },
  '玲': { pinyin: 'ling', initial: 'l', final: 'ing', tone: 2 },
  '珑': { pinyin: 'long', initial: 'l', final: 'ong', tone: 2 },


};

// 第三个字的拼音数据
const thirdCharacters = {
  // 带"女"旁或女性化特质
  '婷': { pinyin: 'ting', initial: 't', final: 'ing', tone: 2 },
  '娜': { pinyin: 'na', initial: 'n', final: 'a', tone: 4 },
  '娟': { pinyin: 'juan', initial: 'j', final: 'van', tone: 1 },
  '妮': { pinyin: 'ni', initial: 'n', final: 'i', tone: 1 },
  '娇': { pinyin: 'jiao', initial: 'j', final: 'iao', tone: 1 },
  '婉': { pinyin: 'wan', initial: 'w', final: 'an', tone: 3 },
  '婕': { pinyin: 'jie', initial: 'j', final: 'ie', tone: 2 },
  '婵': { pinyin: 'chan', initial: 'ch', final: 'an', tone: 2 },
  '娥': { pinyin: 'e', initial: '', final: 'e', tone: 2 },
  '姝': { pinyin: 'shu', initial: 'sh', final: 'u', tone: 1 },
  '媛': { pinyin: 'yuan', initial: 'y', final: 'van', tone: 2 },
  '嫣': { pinyin: 'yan', initial: 'y', final: 'an', tone: 1 },
  '姗': { pinyin: 'shan', initial: 'sh', final: 'an', tone: 1 },
  '妤': { pinyin: 'yu', initial: 'y', final: 'v', tone: 2 },
  '妙': { pinyin: 'miao', initial: 'm', final: 'iao', tone: 4 },
  '娆': { pinyin: 'rao', initial: 'r', final: 'ao', tone: 2 },
  '媚': { pinyin: 'mei', initial: 'm', final: 'ei', tone: 4 },
  '娴': { pinyin: 'xian', initial: 'x', final: 'ian', tone: 2 },
  '婌': { pinyin: 'shuan', initial: 'sh', final: 'uan', tone: 1 },
  '婳': { pinyin: 'hua', initial: 'h', final: 'ua', tone: 4 },
  '媱': { pinyin: 'yao', initial: 'y', final: 'ao', tone: 2 },
  '婠': { pinyin: 'wan', initial: 'w', final: 'an', tone: 2 },

  // 自然与美好意象
  '怡': { pinyin: 'yi', initial: 'y', final: 'i', tone: 2 },
  '欣': { pinyin: 'xin', initial: 'x', final: 'in', tone: 1 },
  '妍': { pinyin: 'yan', initial: 'y', final: 'an', tone: 2 },
  '洁': { pinyin: 'jie', initial: 'j', final: 'ie', tone: 2 },
  '莹': { pinyin: 'ying', initial: 'y', final: 'ing', tone: 2 },
  '雪': { pinyin: 'xue', initial: 'x', final: 've', tone: 3 },
  '瑶': { pinyin: 'yao', initial: 'y', final: 'ao', tone: 2 },
  '菲': { pinyin: 'fei', initial: 'f', final: 'ei', tone: 1 },
  '璇': { pinyin: 'xuan', initial: 'x', final: 'van', tone: 2 },
  '诗': { pinyin: 'shi', initial: 'sh', final: 'i', tone: 1 },
  '茹': { pinyin: 'ru', initial: 'r', final: 'u', tone: 2 },
  '月': { pinyin: 'yue', initial: 'y', final: 've', tone: 4 },
  '舒': { pinyin: 'shu', initial: 'sh', final: 'u', tone: 1 },
  '颖': { pinyin: 'ying', initial: 'y', final: 'ing', tone: 3 },
  '彤': { pinyin: 'tong', initial: 't', final: 'ong', tone: 2 },
  '萱': { pinyin: 'xuan', initial: 'x', final: 'van', tone: 1 },
  '珊': { pinyin: 'shan', initial: 'sh', final: 'an', tone: 1 },
  '琪': { pinyin: 'qi', initial: 'q', final: 'i', tone: 2 },
  '韵': { pinyin: 'yun', initial: 'y', final: 'vn', tone: 4 },
  '蕊': { pinyin: 'rui', initial: 'r', final: 'ui', tone: 3 },

  // 花草植物
  '蕾': { pinyin: 'lei', initial: 'l', final: 'ei', tone: 3 },
  '薇': { pinyin: 'wei', initial: 'w', final: 'ei', tone: 1 },
  '芷': { pinyin: 'zhi', initial: 'zh', final: 'i', tone: 3 },
  '莎': { pinyin: 'sha', initial: 'sh', final: 'a', tone: 1 },
  '蔓': { pinyin: 'man', initial: 'm', final: 'an', tone: 4 },
  '蓝': { pinyin: 'lan', initial: 'l', final: 'an', tone: 2 },
  '莺': { pinyin: 'ying', initial: 'y', final: 'ing', tone: 1 },
  '燕': { pinyin: 'yan', initial: 'y', final: 'an', tone: 4 },
  '雁': { pinyin: 'yan', initial: 'y', final: 'an', tone: 4 },
  '凤': { pinyin: 'feng', initial: 'f', final: 'eng', tone: 4 },
  '鸾': { pinyin: 'luan', initial: 'l', final: 'uan', tone: 2 },
  '蝶': { pinyin: 'die', initial: 'd', final: 'ie', tone: 2 },
  '蝉': { pinyin: 'chan', initial: 'ch', final: 'an', tone: 2 },
  '鹃': { pinyin: 'juan', initial: 'j', final: 'van', tone: 1 },
  '鸥': { pinyin: 'ou', initial: '', final: 'ou', tone: 1 }, // 修正鸥的拼音信息，没有声母
  '鹭': { pinyin: 'lu', initial: 'l', final: 'v', tone: 4 },
  '鹂': { pinyin: 'li', initial: 'l', final: 'i', tone: 2 },
  '鹤': { pinyin: 'he', initial: 'h', final: 'e', tone: 4 },

  // 珍宝美玉
  '琼': { pinyin: 'qiong', initial: 'q', final: 'iong', tone: 2 },
  '瑶': { pinyin: 'yao', initial: 'y', final: 'ao', tone: 2 },
  '琳': { pinyin: 'lin', initial: 'l', final: 'in', tone: 2 },
  '璇': { pinyin: 'xuan', initial: 'x', final: 'van', tone: 2 },
  '琪': { pinyin: 'qi', initial: 'q', final: 'i', tone: 2 },
  '瑾': { pinyin: 'jin', initial: 'j', final: 'in', tone: 3 },
  '瑜': { pinyin: 'yu', initial: 'y', final: 'v', tone: 2 },
  '璐': { pinyin: 'lu', initial: 'l', final: 'u', tone: 4 },
  '珍': { pinyin: 'zhen', initial: 'zh', final: 'en', tone: 1 },
  '珠': { pinyin: 'zhu', initial: 'zh', final: 'u', tone: 1 },
  '珊': { pinyin: 'shan', initial: 'sh', final: 'an', tone: 1 },
  '瑚': { pinyin: 'hu', initial: 'h', final: 'u', tone: 2 },
  '珮': { pinyin: 'pei', initial: 'p', final: 'ei', tone: 4 },
  '珞': { pinyin: 'luo', initial: 'l', final: 'uo', tone: 4 },
  '琬': { pinyin: 'wan', initial: 'w', final: 'an', tone: 3 },
  '琰': { pinyin: 'yan', initial: 'y', final: 'an', tone: 3 },
  '琮': { pinyin: 'cong', initial: 'c', final: 'ong', tone: 2 },
  '琦': { pinyin: 'qi', initial: 'q', final: 'i', tone: 2 },
  '璨': { pinyin: 'can', initial: 'c', final: 'an', tone: 4 },
  '璎': { pinyin: 'ying', initial: 'y', final: 'ing', tone: 1 },

  // 其他常见字
  '涵': { pinyin: 'han', initial: 'h', final: 'an', tone: 2 },
  '雅': { pinyin: 'ya', initial: 'y', final: 'a', tone: 3 },
  '静': { pinyin: 'jing', initial: 'j', final: 'ing', tone: 4 },
  '慧': { pinyin: 'hui', initial: 'h', final: 'ui', tone: 4 },
  '敏': { pinyin: 'min', initial: 'm', final: 'in', tone: 3 },
  '淑': { pinyin: 'shu', initial: 'sh', final: 'u', tone: 1 },
  '惠': { pinyin: 'hui', initial: 'h', final: 'ui', tone: 4 },
  '秀': { pinyin: 'xiu', initial: 'x', final: 'iu', tone: 4 },
  '华': { pinyin: 'hua', initial: 'h', final: 'ua', tone: 2 },
  '兰': { pinyin: 'lan', initial: 'l', final: 'an', tone: 2 },
  '竹': { pinyin: 'zhu', initial: 'zh', final: 'u', tone: 2 },
  '菊': { pinyin: 'ju', initial: 'j', final: 'v', tone: 2 },
  '梅': { pinyin: 'mei', initial: 'm', final: 'ei', tone: 2 },
  '荷': { pinyin: 'he', initial: 'h', final: 'e', tone: 2 },
  '莲': { pinyin: 'lian', initial: 'l', final: 'ian', tone: 2 },
  '蓉': { pinyin: 'rong', initial: 'r', final: 'ong', tone: 2 },
  '桃': { pinyin: 'tao', initial: 't', final: 'ao', tone: 2 },
  '杏': { pinyin: 'xing', initial: 'x', final: 'ing', tone: 4 },
  '梨': { pinyin: 'li', initial: 'l', final: 'i', tone: 2 },
  '柳': { pinyin: 'liu', initial: 'l', final: 'iu', tone: 3 },
  '桂': { pinyin: 'gui', initial: 'g', final: 'ui', tone: 4 }
};

// 生成所有可能的名字组合并评分
const nameScores = [];

for (const [char2, data2] of Object.entries(secondCharacters)) {
  for (const [char3, data3] of Object.entries(thirdCharacters)) {
    // 创建拼音对象数组
    const pinyinObjects = [
      xiang,
      data2,
      data3
    ];

    try {
      // 验证所有对象都有必要的属性
      const isValid = pinyinObjects.every(obj =>
        obj && obj.initial !== undefined &&
        obj.final !== undefined &&
        obj.tone !== undefined);

      if (!isValid) {
        console.error(`无效的拼音对象: 项${char2}${char3}`);
        continue;
      }

      // 评估拼音组合的顺口度
      const score = evaluatePinyinComboFluency(pinyinObjects);

      // 添加到结果数组
      nameScores.push({
        name: `项${char2}${char3}`,
        pinyinStr: `xiang4 ${data2.pinyin}${data2.tone} ${data3.pinyin}${data3.tone}`,
        score
      });
    } catch (error) {
      console.error(`评分错误: 项${char2}${char3} - ${error.message}`);
    }
  }
}

// 按分数降序排序
nameScores.sort((a, b) => b.score - a.score);

// 准备输出字符串
let output = `项姓女宝宝三字姓名评分结果（按分数降序排列）\n\n`;
output += `序号\t姓名\t\t拼音\t\t顺口度评分\n`;
output += `-----------------------------------------------------\n`;

// 添加所有名字和评分
nameScores.forEach((item, index) => {
  output += `${index + 1}\t${item.name}\t\t${item.pinyinStr}\t\t${item.score}\n`;
});

// 写入到文件
fs.writeFileSync('女宝宝姓名.txt', output, 'utf8');

console.log(`已生成 ${nameScores.length} 个名字组合，并按顺口度评分排序保存到 女宝宝姓名.txt`);
