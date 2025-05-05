#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import re
import sys
import multiprocessing
import time
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import Manager

try:
    import opencc
except ImportError:
    print("需要安装opencc库。请运行: pip install opencc-python-reimplemented")
    sys.exit(1)

# 创建一个全局的转换器实例
converter = opencc.OpenCC('t2s')

# 创建manager对象
manager = Manager()
# 创建共享列表
shared_poems = manager.list()

# 定义插件基类
class Plugin:
    def __init__(self, name, description):
        self.name = name
        self.description = description

    def process(self, data):
        """处理数据，子类必须实现此方法"""
        raise NotImplementedError("子类必须实现process方法")

    def __str__(self):
        return f"{self.name}: {self.description}"

# 繁体转简体插件
class TraditionalToSimplifiedPlugin(Plugin):
    def __init__(self):
        super().__init__(
            name="繁体转简体",
            description="将JSON数据中的繁体中文字符转换为简体中文"
        )

    def process(self, data):
        """递归处理JSON数据，将繁体字转换为简体字"""
        if isinstance(data, dict):
            return {k: self.process(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.process(item) for item in data]
        elif isinstance(data, str):
            return converter.convert(data)
        else:
            return data

# 段落拆分插件
class ParagraphSplitPlugin(Plugin):
    def __init__(self):
        super().__init__(
            name="段落拆分",
            description="拆分paragraphs中包含多个句号且句号后跟中文字符的段落"
        )

    def process(self, data):
        """递归处理JSON数据，拆分paragraphs中包含多个句号的段落"""
        if isinstance(data, dict):
            result = {}
            for k, v in data.items():
                if k == "paragraphs" and isinstance(v, list):
                    # 处理paragraphs属性
                    result[k] = self._split_paragraph_list(v)
                else:
                    result[k] = self.process(v)
            return result
        elif isinstance(data, list):
            return [self.process(item) for item in data]
        else:
            return data

    def _is_chinese_char(self, char):
        """检查字符是否是中文字符"""
        return '\u4e00' <= char <= '\u9fff'

    def _split_paragraph_list(self, paragraph_list):
        """处理段落列表，只在句号后面是中文字符时才拆分段落"""
        result = []
        for paragraph in paragraph_list:
            if not isinstance(paragraph, str):
                result.append(paragraph)
                continue

            # 初始化处理
            segments = []
            current_segment = ""

            # 遍历段落中的每个字符
            i = 0
            while i < len(paragraph):
                current_segment += paragraph[i]

                # 检查是否是句号且不是最后一个字符
                if paragraph[i] == "。" and i < len(paragraph) - 1:
                    # 检查句号后面的字符是否是中文
                    if self._is_chinese_char(paragraph[i + 1]):
                        # 句号后跟中文字符，添加当前段落并重置
                        segments.append(current_segment)
                        current_segment = ""

                i += 1

            # 添加最后的段落部分（如果有）
            if current_segment:
                segments.append(current_segment)

            # 如果没有拆分，保留原始段落
            if segments:
                result.extend(segments)
            else:
                result.append(paragraph)

        return result

# 写入p.txt插件
class WriteToPTxtPlugin(Plugin):
    def __init__(self, shared_poems):
        print("写入p.txt插件初始化")
        super().__init__(
            name="写入p.txt",
            description="将title和paragraphs连接为一行，写入p.txt文件"
        )
        self.poems = shared_poems  # 使用共享列表

    def process(self, data):
        """提取title和paragraphs，并保存到poems列表中"""
        if isinstance(data, dict):
            # 如果同时包含title和paragraphs，则认为是一首诗
            if "title" in data and "paragraphs" in data and isinstance(data["paragraphs"], list):
                title = data["title"]
                paragraphs = "".join(data["paragraphs"]) if all(isinstance(p, str) for p in data["paragraphs"]) else ""
                if title and paragraphs:
                    poem_line = f"{title}|{paragraphs}"
                    self.poems.append(poem_line)
            # 继续处理其他键值对
            for k, v in data.items():
                self.process(v)
        elif isinstance(data, list):
            for item in data:
                self.process(item)

        # 返回原始数据，不做修改
        return data

    def write_to_file(self, directory):
        """将收集到的诗写入p.txt文件"""
        if not self.poems:
            print("没有诗歌可写入，跳过")
            return

        output_path = os.path.join(directory, "p.txt")
        with open(output_path, 'a', encoding='utf-8') as f:
            for poem in self.poems:
                f.write(poem + "\n")

        print(f"已将 {len(self.poems)} 首诗写入 {output_path}")
        # 清空列表，为下一个目录做准备
        # self.poems = []

# 创建插件列表
plugins = [
    # TraditionalToSimplifiedPlugin(),
    # ParagraphSplitPlugin(),
    WriteToPTxtPlugin(shared_poems)
]

def is_chinese_dir(dirname):
    """检查目录名是否全部由中文字符组成"""
    pattern = re.compile(r'^[\u4e00-\u9fff]+$')
    return bool(pattern.match(dirname))

def convert_json_file(file_path):
    """将JSON文件处理，应用所有插件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 依次应用所有插件
        for plugin in plugins:
            data = plugin.process(data)

        # 写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        return f"已处理: {file_path}"
    except Exception as e:
        return f"处理 {file_path} 时出错: {str(e)}"

def find_json_files(directory):
    """查找目录下所有的JSON文件"""
    json_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.json'):
                json_files.append(os.path.join(root, file))
    return json_files

def process_directory_parallel(directory, workers=None):
    """并行处理目录下的所有JSON文件"""
    json_files = find_json_files(directory)
    total_files = len(json_files)

    if not json_files:
        print(f"目录 {directory} 中没有找到JSON文件")
        return

    print(f"找到 {total_files} 个JSON文件，开始处理...")

    # 如果未指定工作进程数，使用CPU核心数
    if workers is None:
        workers = multiprocessing.cpu_count()

    # 使用ProcessPoolExecutor进行并行处理
    processed_files = 0

    with ProcessPoolExecutor(max_workers=workers) as executor:
        # 提交所有任务
        future_to_file = {executor.submit(convert_json_file, file): file for file in json_files}

        # 处理完成的任务
        for future in as_completed(future_to_file):
            result = future.result()
            processed_files += 1
            progress = (processed_files / total_files) * 100
            print(f"进度: {progress:.2f}% ({processed_files}/{total_files}) - {result}")

    # 处理完目录后，写入收集到的诗
    for plugin in plugins:
        if isinstance(plugin, WriteToPTxtPlugin):
            print("begin to write"+directory)
            plugin.write_to_file(directory)

def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="将古诗文集中的繁体字转换为简体字")
    parser.add_argument('--dirs', nargs='+', help='要处理的文件夹列表，如果不指定则处理所有中文文件夹')
    args = parser.parse_args()

    start_time = time.time()

    # 获取CPU核心数，确定并行进程数
    cpu_count = multiprocessing.cpu_count()
    # 使用CPU核心数作为默认进程数，但至少使用2个，最多使用CPU核心数
    workers = max(2, cpu_count)

    print(f"系统CPU核心数: {cpu_count}，使用 {workers} 个并行进程")
    print(f"已加载 {len(plugins)} 个插件:")
    for plugin in plugins:
        print(f" - {plugin}")

    current_dir = os.getcwd()
    print(f"扫描目录: {current_dir}")

    # 如果指定了要处理的文件夹
    if args.dirs:
        chinese_dirs = [d for d in args.dirs if os.path.isdir(os.path.join(current_dir, d))]
        if not chinese_dirs:
            print("指定的文件夹不存在")
            return
        print(f"将处理指定的 {len(chinese_dirs)} 个文件夹:")
    else:
        # 获取当前目录下的所有文件夹
        all_dirs = [d for d in os.listdir(current_dir) if os.path.isdir(os.path.join(current_dir, d))]
        # 筛选出纯中文名称的文件夹
        chinese_dirs = [d for d in all_dirs if is_chinese_dir(d)]
        if not chinese_dirs:
            print("未找到纯中文名称的文件夹")
            return
        print(f"找到 {len(chinese_dirs)} 个中文文件夹:")

    for d in chinese_dirs:
        print(f" - {d}")

    # 处理每个中文文件夹
    for dir_name in chinese_dirs:
        dir_path = os.path.join(current_dir, dir_name)
        print(f"处理文件夹: {dir_path}")
        process_directory_parallel(dir_path, workers=workers)

    end_time = time.time()
    print(f"转换完成，总耗时: {end_time - start_time:.2f} 秒")

if __name__ == "__main__":
    main()