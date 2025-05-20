// https://zh.wikipedia.org/wiki/汉语拼音音节列表
// https://www.unicode.org/Public/UCD/latest/charts/RSIndex.txt
// 零声母映射表
const zeroInitialMap = {
  // 基本韵母映射到自身
  a: "a",
  o: "o",
  e: "e",
  ai: "ai",
  ei: "ei",
  ao: "ao",
  ou: "ou",
  an: "an",
  en: "en",
  ang: "ang",
  eng: "eng",
  er: "er",

  yi: "i",
  ya: "ia",
  yo: "io",
  ye: "ie",
  yao: "iao",
  you: "iu",
  yan: "ian",
  yin: "in",
  yang: "iang",
  ying: "ing",
  yong: "iong", // 大陆齐齿

  wu: "u",
  wa: "ua",
  wo: "uo",
  wai: "uai",
  wei: "ui",
  wan: "uan",
  wen: "un",
  wang: "uang",
  weng: "ong",

  yu: "v",
  yue: "ve",
  yuan: "van",
  yun: "vn",
};

// jqx与ü(v)结合的预处理映射
const jqxMapping = {
  ju: "jv",
  qu: "qv",
  xu: "xv",
  jue: "jve",
  que: "qve",
  xue: "xve",
  juan: "jvan",
  quan: "qvan",
  xuan: "xvan",
  jun: "jvn",
  qun: "qvn",
  xun: "xvn",
};

// 声母组索引映射
const doubleInitialMap = {
  zh: 5,
  ch: 5,
  sh: 5,
};

const initialGroupMap = {
  "": 0,
  b: 1,
  p: 1,
  m: 1,
  f: 2,
  z: 3,
  c: 3,
  s: 3,
  d: 4,
  t: 4,
  n: 4,
  l: 4,
  ...doubleInitialMap,
  r: 5,
  j: 6,
  q: 6,
  x: 6,
  g: 7,
  k: 7,
  h: 7,
};

const finalStructure = {
  /* 开口呼 */
  a: { medial: "", main: "a", ending: "" },
  o: { medial: "", main: "o", ending: "" },
  e: { medial: "", main: "e", ending: "" },
  ai: { medial: "", main: "a", ending: "i" },
  ei: { medial: "", main: "e", ending: "i" },
  er: { medial: "", main: "e", ending: "r" }, // 儿化音
  ao: { medial: "", main: "a", ending: "o" },
  ou: { medial: "", main: "o", ending: "u" },
  an: { medial: "", main: "a", ending: "n" },
  en: { medial: "", main: "e", ending: "n" },
  ang: { medial: "", main: "a", ending: "ng" },
  eng: { medial: "", main: "e", ending: "ng" },
  ong: { medial: "", main: "o", ending: "ng" }, // 有争议, 合口呼, https://zh.wikipedia.org/wiki/四呼

  /* 齐齿呼 */
  i: { medial: "i", main: "i", ending: "" },
  ia: { medial: "i", main: "a", ending: "" },
  ie: { medial: "i", main: "e", ending: "" },
  iao: { medial: "i", main: "a", ending: "o" },
  iu: { medial: "i", main: "o", ending: "u" },
  ian: { medial: "i", main: "a", ending: "n" },
  in: { medial: "i", main: "i", ending: "n" },
  iang: { medial: "i", main: "a", ending: "ng" },
  ing: { medial: "i", main: "i", ending: "ng" },
  iong: { medial: "i", main: "o", ending: "ng" }, // 有争议, 撮口呼, https://zh.wikipedia.org/wiki/四呼
  /* 特殊情况 */
  io: { medial: "i", main: "o", ending: "" }, // 用于 yo 拼音

  /* 合口呼 */
  u: { medial: "u", main: "u", ending: "" },
  ua: { medial: "u", main: "a", ending: "" },
  uo: { medial: "u", main: "o", ending: "" },
  uai: { medial: "u", main: "a", ending: "i" },
  ui: { medial: "u", main: "e", ending: "i" },
  uan: { medial: "u", main: "a", ending: "n" },
  un: { medial: "u", main: "e", ending: "n" },
  uang: { medial: "u", main: "a", ending: "ng" },

  /* 撮口呼 */
  v: { medial: "v", main: "v", ending: "" },
  ve: { medial: "v", main: "e", ending: "" },
  van: { medial: "v", main: "a", ending: "n" },
  vn: { medial: "v", main: "v", ending: "n" },
};

// 元音相似度映射表（归一化到0-100区间）
const vowelSimilarityMap = {
  i: { i: 100, v: 30, u: 20 },
  v: { i: 30, v: 100, u: 70 },
  u: { i: 20, v: 70, u: 100 },
};

const getInitialScore = (sm1, sm2) => {
  // 完全相同的声母，包括空声母，返回100分
  if (sm1 === sm2) return 100;

  // 一方为空声母，另一方不是，返回0分
  if (!sm1 || !sm2) return 0;

  const group1 = initialGroupMap[sm1];
  const group2 = initialGroupMap[sm2];

  if (group1 === undefined || group2 === undefined) return 0;

  // 基于发音位置距离计算相似度
  const positionDifference = Math.abs(group1 - group2);

  // 同组声母内部差异化处理，相同组内不再固定为100分
  if (group1 === group2) {
    // 同组但不同声母，给予较高但不是100的分数
    // 例如：b和p的相似度应该高但不等于b和b
    return 90;
  }

  // 不同组声母基于距离计算相似度
  // 最大可能距离是7(从0到7)，将差异映射到0-80的评分
  // 这样即使相邻组的声母相似度也低于同组内的声母
  const similarityScore = Math.max(0, 80 - (positionDifference * 80) / 7);

  return Math.round(similarityScore);
};

const getFinalScore = (ym1, ym2) => {
  if (ym1 === ym2) return 100;

  const parts1 = finalStructure[ym1];
  const parts2 = finalStructure[ym2];
  if (!parts1 || !parts2) return 0;

  let score = 0;

  // 介音和韵尾的评分
  if (parts1.medial === parts2.medial) score += 30;
  if (parts1.ending === parts2.ending) score += 20;

  // 先判断简单情况：主元音完全相同
  if (parts1.main === parts2.main) {
    score += 50;
  }
  // 再判断复杂情况：使用元音相似度映射表
  else if (vowelSimilarityMap[parts1.main] && vowelSimilarityMap[parts1.main][parts2.main]) {
    // 将0-100的相似度缩放到0-50的区间
    score += vowelSimilarityMap[parts1.main][parts2.main] * 0.5;
  }

  return score;
};

const getToneScore = (t1, t2) => {
  const diff = Math.abs(t1 - t2);
  return diff === 0 ? 100 : Math.max(0, 100 - diff * 25);
};

const pinyinSimilarity = (parts1, parts2) => {
  const [sm1, ym1, tone1] = parts1;
  const [sm2, ym2, tone2] = parts2;

  const weights = { initial: 0.3, final: 0.5, tone: 0.2 };
  const smScore = getInitialScore(sm1, sm2);
  const ymScore = getFinalScore(ym1, ym2);
  const toneScore = getToneScore(tone1, tone2);

  const total = smScore * weights.initial + ymScore * weights.final + toneScore * weights.tone;

  return Math.round(total);
};

// 使用示例
// console.log(pinyinSimilarity(["zh", "ang", 1], ["ch", "ang", 1])); // 85
// console.log(pinyinSimilarity(["b", "an", 1], ["p", "ang", 2])); // 59
// console.log(pinyinSimilarity(["j", "in", 3], ["q", "ing", 3])); // 65
// console.log(getFinalScore("i", "v"), getFinalScore("u", "v"));

/**
 * 将拼音拆分为声母和韵母
 * @param {string} pinyin - 需要拆分的拼音
 * @returns {Array} - [声母, 韵母] 的数组
 */
const splitPinyinRaw = (pinyin) => {
  pinyin = pinyin.toLowerCase().replaceAll("ü", "v");

  // 处理特殊情况：单声母 m
  if (pinyin === "m") {
    return ["m", ""];
  }

  // 处理特殊情况：yo
  if (pinyin === "yo") {
    return ["y", "io"];
  }

  // jqx 与 ü 的组合，直接用对象属性查找
  if (pinyin in jqxMapping) {
    const mappedValue = jqxMapping[pinyin];
    return [mappedValue[0], mappedValue.slice(1)];
  }

  // 直接在 zeroInitialMap 中查找拼音
  if (pinyin in zeroInitialMap) {
    const mappedValue = zeroInitialMap[pinyin];
    // 情形1: 结果和拼音相同，返回''和拼音
    if (mappedValue === pinyin) {
      return ["", pinyin];
    }
    // 情形2: 结果和拼音不同(y/w开头)，返回首字母和映射结果
    else {
      return [pinyin[0], mappedValue];
    }
  }
  const two = pinyin.slice(0, 2);
  if (two in doubleInitialMap) {
    return [two, pinyin.slice(2)];
  }
  if (pinyin[0] in initialGroupMap) {
    return [pinyin[0], pinyin.slice(1)];
  }

  // 不匹配任何规则，视为零声母
  throw new Error(`invalid pinyin: ${pinyin}`);
};

const splitPinyin = (pinyin) => {
  const [initial, final] = splitPinyinRaw(pinyin);
  if (!finalStructure[final]) {
    throw new Error(`invalid final: ${final} in pinyin: ${pinyin}`);
  }
  return [initial, final];
};

/**
 * 评估两个声调的顺口程度，100分制
 * @param {number} a - 第一个声调（1-4）
 * @param {number} b - 第二个声调（1-4）
 * @returns {number} - 顺口度评分（0-100）
 */
const evaluateToneFluency2 = (a, b) => {
  // 确保输入是有效的声调值
  if (![1, 2, 3, 4].includes(a) || ![1, 2, 3, 4].includes(b)) {
    throw new Error("声调必须是1、2、3或4");
  }

  // 相同声调连续会降低顺口度（如"一一"、"四四"）
  if (a === b) {
    return 50; // 相同声调降低顺口度
  }

  // 按照平仄分组：1、2为平，3、4为仄
  const isPing = (tone) => tone === 1 || tone === 2;
  const aIsPing = isPing(a);
  const bIsPing = isPing(b);

  // 平仄交替（如"一三"、"四二"）比连续平或连续仄更顺口
  if (aIsPing !== bIsPing) {
    return 90;
  }

  // 同组不同调（如"一二"、"三四"）比完全相同调好一些
  return 70;
};

/**
 * 评估三个声调的顺口程度，100分制
 * @param {number} a - 第一个声调（1-4）
 * @param {number} b - 第二个声调（1-4）
 * @param {number} c - 第三个声调（1-4）
 * @returns {number} - 顺口度评分（0-100）
 */
const evaluateToneFluency3 = (a, b, c) => {
  // 确保输入是有效的声调值
  if (![1, 2, 3, 4].includes(a) || ![1, 2, 3, 4].includes(b) || ![1, 2, 3, 4].includes(c)) {
    throw new Error("声调必须是1、2、3或4");
  }

  // 平仄判断函数
  const isPing = (tone) => tone === 1 || tone === 2;
  const aIsPing = isPing(a);
  const bIsPing = isPing(b);
  const cIsPing = isPing(c);

  // 声调完全相同的情况评分最低
  if (a === b && b === c) {
    return 40;
  }

  // 计算平仄模式
  const pattern = (aIsPing ? "P" : "Z") + (bIsPing ? "P" : "Z") + (cIsPing ? "P" : "Z");

  // 最理想的平仄交替模式：PPZ, ZPP, PZP, ZPZ
  const idealPatterns = ["PPZ", "ZPP", "PZP", "ZPZ"];
  if (idealPatterns.includes(pattern)) {
    return 100;
  }

  // 次优的模式：PZZ, ZZP
  const secondaryPatterns = ["PZZ", "ZZP"];
  if (secondaryPatterns.includes(pattern)) {
    return 85;
  }

  // 连续相同声调数量
  const sameConsecutive = (a === b) + (b === c);

  // 两个连续相同声调
  if (sameConsecutive === 1) {
    return 70;
  }

  // 其他情况（如PPP, ZZZ）
  return 60;
};

/**
 * 通用的声调顺口度评估函数
 * @param {number} a - 第一个声调（1-4）
 * @param {number} b - 第二个声调（1-4）
 * @param {number} [c] - 可选的第三个声调（1-4）
 * @returns {number} - 顺口度评分（0-100）
 */
const evaluateToneFluency = (a, b, c) => {
  if (c !== undefined) {
    return evaluateToneFluency3(a, b, c);
  }
  return evaluateToneFluency2(a, b);
};

/**
 * 规范化权重对象，使所有权重之和等于1
 * @param {Object} weights - 权重对象
 * @returns {Object} - 规范化后的权重对象
 */
const normalizeWeights = (weights) => {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
  if (sum === 0) {
    throw new Error("权重之和不能为0");
  }

  const normalizedWeights = {};
  for (const key in weights) {
    normalizedWeights[key] = weights[key] / sum;
  }
  return normalizedWeights;
};

/**
 * 评估拼音组合的顺口度和响亮度，100分制
 * @param {Array<{initial: string, final: string, tone: number}>} pinyins - 2-3个拼音对象组成的数组，每个对象包含声母、韵母和声调
 * @param {boolean} [verbose=false] - 是否返回详细评分过程
 * @returns {number|Object} - 组合顺口度评分（0-100）或包含详细评分的对象
 */
const evaluatePinyinComboFluency = (pinyins, verbose = false) => {
  // 验证输入
  if (!Array.isArray(pinyins) || pinyins.length < 2 || pinyins.length > 3) {
    throw new Error("请输入2-3个拼音对象组成的数组");
  }

  // 检查对象结构
  for (const pinyin of pinyins) {
    if (pinyin.initial === undefined || pinyin.final === undefined || pinyin.tone === undefined) {
      throw new Error("拼音对象必须包含initial、final和tone属性"+JSON.stringify(pinyin));
    }

    // 允许initial为空字符串（无声母的字）
    if (!finalStructure[pinyin.final]) {
      throw new Error(`无效的韵母: ${pinyin.final}`);
    }
  }

  // 权重配置 - 调整权重以更好地捕捉拗口组合
  let weights = {
    initialVariety: 0.25, // 声母多样性权重增加
    initialDistance: 0.2, // 声母发音位置区分度权重增加
    finalConsonance: 0.25, // 韵母和谐度
    mainVowelStrength: 0.15, // 主元音响亮度稍微降低
    rhythm: 0.15, // 节奏感稍微降低
    toneFluency: 0.15, // 声调权重
  };

  // 规范化权重
  weights = normalizeWeights(weights);

  // 1. 声母多样性评分
  let initialVarietyScore = 0;
  const initials = pinyins.map((p) => p.initial);

  // 避免重复声母
  const uniqueInitials = new Set(initials);
  initialVarietyScore = 100 * (uniqueInitials.size / pinyins.length);

  // 2. 声母发音位置区分度
  let initialDistanceScore = 0;
  if (pinyins.length === 2) {
    initialDistanceScore = 100 - getInitialScore(pinyins[0].initial, pinyins[1].initial);

    // 对于声母完全相同的情况额外惩罚
    if (pinyins[0].initial === pinyins[1].initial && pinyins[0].initial !== "") {
      initialDistanceScore = Math.max(0, initialDistanceScore - 20);
    }
  } else {
    // 只考虑相邻声母的差异性（最差分为准）
    const dist1 = 100 - getInitialScore(pinyins[0].initial, pinyins[1].initial); // 第一字和第二字
    const dist2 = 100 - getInitialScore(pinyins[1].initial, pinyins[2].initial); // 第二字和第三字
    // 不再计算dist3（第一字和第三字），因为发音只与相邻声母有关

    // 取最差分（最小值）而不是平均值
    initialDistanceScore = Math.min(dist1, dist2);

    // 检查是否有重复声母
    if (uniqueInitials.size < pinyins.length) {
      initialDistanceScore = Math.max(0, initialDistanceScore - 15);
    }
  }

  // 3. 韵母和谐度
  let finalConsonanceScore = 0;
  const finals = pinyins.map((p) => p.final);

  if (pinyins.length === 2) {
    // 韵母有一定相似性但不完全相同更好听
    const similarity = getFinalScore(finals[0], finals[1]);

    // 相似度在60-80分最佳，太相似或太不同都不理想
    finalConsonanceScore = 100 - Math.abs(70 - similarity);

    // 对于完全相同韵母的额外惩罚
    if (finals[0] === finals[1]) {
      finalConsonanceScore = Math.max(0, finalConsonanceScore - 25);
    }
  } else {
    // 只考虑相邻韵母的相似度，取最差分为准
    const sim1 = getFinalScore(finals[0], finals[1]); // 第一字和第二字韵母相似度
    const sim2 = getFinalScore(finals[1], finals[2]); // 第二字和第三字韵母相似度
    // 不再计算非相邻韵母的相似度

    // 对于相似度，70分是理想值，偏离越远越不理想
    const diff1 = Math.abs(70 - sim1);
    const diff2 = Math.abs(70 - sim2);

    // 取最差评分（偏离理想值最远的）
    const worstDiff = Math.max(diff1, diff2);
    finalConsonanceScore = 100 - worstDiff;

    // 检查是否有重复韵母
    const uniqueFinals = new Set(finals);
    if (uniqueFinals.size < finals.length) {
      finalConsonanceScore = Math.max(0, finalConsonanceScore - 20);
    }
  }

  // 4. 主元音响亮度
  let mainVowelStrengthScore = 0;
  const vowelStrength = {
    a: 100, // 最响亮的元音
    o: 85,
    e: 75,
    i: 60,
    u: 65,
    v: 55, // 最不响亮的元音
  };

  const mainVowels = pinyins.map((p) => finalStructure[p.final].main);
  const avgStrength =
    mainVowels.reduce((sum, vowel) => sum + (vowelStrength[vowel] || 70), 0) / pinyins.length;
  mainVowelStrengthScore = avgStrength;

  // 5. 节奏感评分 - 基于韵尾的分布
  let rhythmScore = 0;
  const endings = pinyins.map((p) => finalStructure[p.final].ending);

  // 开音节和闭音节交替会增加节奏感
  const hasEmptyEnding = endings.some((e) => e === "");
  const hasConsonantEnding = endings.some((e) => e !== "");

  if (hasEmptyEnding && hasConsonantEnding) {
    rhythmScore = 100;
  } else {
    rhythmScore = 70;
  }

  // 鼻音韵尾(n/ng)分布 - 均匀分布效果最好
  const nasalEndings = endings.filter((e) => e === "n" || e === "ng").length;
  if (nasalEndings > 0 && nasalEndings < pinyins.length) {
    rhythmScore = Math.max(rhythmScore, 90);
  }

  // 相同声母相同韵母的特殊惩罚 (针对"时事"和"知齿"这类拗口组合)
  let specialPenalty = 0;
  if (pinyins.length === 2) {
    if (pinyins[0].initial === pinyins[1].initial && pinyins[0].final === pinyins[1].final) {
      specialPenalty = 20;
    } else if (
      pinyins[0].initial === pinyins[1].initial &&
      (pinyins[0].initial === "zh" ||
        pinyins[0].initial === "ch" ||
        pinyins[0].initial === "sh" ||
        pinyins[0].initial === "j" ||
        pinyins[0].initial === "q" ||
        pinyins[0].initial === "x")
    ) {
      // 对于zh/ch/sh/j/q/x开头的相同声母组合额外惩罚
      specialPenalty = 15;
    }

    // 对于s/sh/z/zh/c/ch等声母的组合特别容易拗口
    const frictionInitials = ["s", "sh", "z", "zh", "c", "ch"];
    if (
      frictionInitials.includes(pinyins[0].initial) &&
      frictionInitials.includes(pinyins[1].initial)
    ) {
      specialPenalty += 10;
    }

    // si/shi组合特别拗口
    if (
      (pinyins[0].final === "i" && pinyins[0].initial === "s") ||
      (pinyins[1].final === "i" && pinyins[1].initial === "s") ||
      (pinyins[0].final === "i" && pinyins[0].initial === "sh") ||
      (pinyins[1].final === "i" && pinyins[1].initial === "sh")
    ) {
      specialPenalty += 10;
    }
  } else if (pinyins.length === 3) {
    // 检查有多少相同部分
    const sameInitials = initials.filter((v, i, a) => a.indexOf(v) !== i).length;
    const sameFinals = finals.filter((v, i, a) => a.indexOf(v) !== i).length;

    if (sameInitials > 0 && sameFinals > 0) {
      specialPenalty = 15 + sameInitials * 5 + sameFinals * 5;
    }

    // 特别惩罚ü系列组合
    const vFinals = finals.filter((f) => f.includes("v")).length;
    if (vFinals >= 2) {
      specialPenalty += 15;
    }

    // s/sh/z/zh/c/ch组合特别拗口
    const frictionInitials = ["s", "sh", "z", "zh", "c", "ch"];
    const frictionCount = initials.filter((i) => frictionInitials.includes(i)).length;
    if (frictionCount >= 2) {
      specialPenalty += 10;
    }

    // 对j/q/x声母组合加强惩罚
    const palatals = ["j", "q", "x"];
    const palatalCount = initials.filter((i) => palatals.includes(i)).length;
    if (palatalCount >= 2) {
      specialPenalty += 10;
    }
  }

  // 计算声调顺口度
  let toneScore = 0;
  const tones = pinyins.map((p) => p.tone);

  if (pinyins.length === 2) {
    toneScore = evaluateToneFluency(tones[0], tones[1]);
  } else {
    toneScore = evaluateToneFluency(tones[0], tones[1], tones[2]);
  }

  // 计算总分 - 直接累加各项得分
  let totalScore =
    initialVarietyScore * weights.initialVariety +
    initialDistanceScore * weights.initialDistance +
    finalConsonanceScore * weights.finalConsonance +
    mainVowelStrengthScore * weights.mainVowelStrength +
    rhythmScore * weights.rhythm +
    toneScore * weights.toneFluency;

  // 四舍五入总分
  totalScore = Math.round(totalScore);

  // 应用特殊惩罚
  totalScore = Math.max(0, totalScore - specialPenalty);

  const finalScore = Math.min(100, Math.max(0, totalScore));

  // 如果需要详细信息，返回分项评分
  if (verbose) {
    return {
      score: finalScore,
      details: {
        initialVariety: {
          score: Math.round(initialVarietyScore),
          description: `声母多样性: ${uniqueInitials.size}个不同声母/${pinyins.length}个拼音`,
          weight: weights.initialVariety,
        },
        initialDistance: {
          score: Math.round(initialDistanceScore),
          description: "声母发音位置区分度: " + (initialDistanceScore > 70 ? "良好" : "一般"),
          weight: weights.initialDistance,
        },
        finalConsonance: {
          score: Math.round(finalConsonanceScore),
          description:
            "韵母和谐度: " +
            (finalConsonanceScore > 80 ? "极佳" : finalConsonanceScore > 60 ? "良好" : "一般"),
          weight: weights.finalConsonance,
        },
        mainVowelStrength: {
          score: Math.round(mainVowelStrengthScore),
          description: `主元音响亮度: ${mainVowels.join(", ")}`,
          weight: weights.mainVowelStrength,
        },
        rhythm: {
          score: Math.round(rhythmScore),
          description:
            "节奏感: " +
            (hasEmptyEnding && hasConsonantEnding ? "开闭音节交替" : "单一音节类型") +
            (nasalEndings > 0 && nasalEndings < pinyins.length ? "，鼻音韵尾良好分布" : ""),
          weight: weights.rhythm,
        },
        toneFluency: {
          score: Math.round(toneScore),
          description: `声调顺口度: ${tones.join(", ")}`,
          weight: weights.toneFluency,
        },
        specialPenalty: {
          score: specialPenalty,
          description: "拗口组合特殊惩罚",
        },
      },
    };
  }

  return finalScore;
};

// 测试示例
// console.log("拼音组合顺口度评分示例:");
// console.log("ba + na =", evaluatePinyinComboFluency(["ba", "na"])); // 声母不同、韵母相似，响亮的a元音
// console.log("ling + long =", evaluatePinyinComboFluency(["ling", "long"])); // 声母相同但韵母不同，节奏感好
// console.log("ming + tian + hao =", evaluatePinyinComboFluency(["ming", "tian", "hao"])); // 常见组合"明天好"
// console.log("yi + qi + lai =", evaluatePinyinComboFluency(["yi", "qi", "lai"])); // 常见组合"一起来"
// console.log("详细评分:", evaluatePinyinComboFluency(["ming", "tian", "hao"], [1, 2, 3], true)); // 获取详细评分

export {
  initialGroupMap,
  finalStructure,
  getInitialScore,
  getFinalScore,
  getToneScore,
  pinyinSimilarity,
  zeroInitialMap,
  jqxMapping,
  splitPinyin,
  evaluateToneFluency2,
  evaluateToneFluency3,
  evaluateToneFluency,
  evaluatePinyinComboFluency, // 主函数,评估2到3字的发音顺口度
  normalizeWeights,
};
