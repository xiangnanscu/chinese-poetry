# 唐诗名字生成器

这是一个基于《唐诗三百首》生成名字建议的工具。该工具使用人工智能（Gemini API）分析古诗词，从中提取适合作为名字的字组合。

## 功能特点

- 读取《唐诗三百首》JSON文件
- 对每首诗进行分析，生成名字建议
- 为每个名字建议提供性别适用性和含义解释
- 支持批量处理，可控制API调用频率
- 可配置处理参数

## 文件说明

- `batchNameGenerator.js` - 主批处理脚本
- `testBatch.js` - 测试脚本（仅处理少量诗）
- `.env` - 环境配置文件
- `geminiCaller.mjs` - Gemini API调用工具

## 配置说明

在`.env`文件中可以调整以下参数：

```
# Gemini API配置
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash-latest
GEMINI_TIMEOUT=30000

# 批处理配置
BATCH_RPM=10
BATCH_MAX_CONCURRENT=3
OUTPUT_DIR=诗名建议
START_INDEX=0
END_INDEX=-1

```

## 使用方法

1. 确保已安装Node.js环境
2. 安装依赖包：`npm install dotenv`
3. 复制`env.sample`为`.env`并配置你的API密钥
4. 运行以下命令之一：

```bash
# 处理全部诗词
node batchNameGenerator.js

# 测试处理少量诗词
node testBatch.js
```

## 输出结果

程序将为每首诗生成一个JSON文件，文件名格式为`诗标题_作者.json`，同时生成一个`summary.json`汇总文件，包含所有处理结果。

每个名字建议包含以下信息：
- `name`: 建议的名字（两个字）
- `sex`: 适合的性别（男/女/通用）
- `desc`: 名字含义解释

## 示例输出

```json
[
  {
    "name": "海邻",
    "sex": "男",
    "desc": "志向远大,高朋满座"
  },
  {
    "name": "天涯",
    "sex": "通用",
    "desc": "胸怀广阔,情意深长"
  }
]
```
