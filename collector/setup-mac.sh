#!/bin/bash
# setup-mac.sh — macOS 一键配置采集环境
set -e
echo "========================================"
echo " 小红书舆情采集 · macOS 一键配置"
echo " 1/4 安装 Python 依赖  2/4 校验数据库密钥"
echo " 3/4 下载 MediaCrawler  4/4 环境自检"
echo "========================================"

cd "$(dirname "$0")"

echo
echo "[1/4] 安装 Python 依赖 requests / snownlp ..."
pip3 install requests snownlp -i https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || \
  python3 -m pip install requests snownlp -i https://pypi.tuna.tsinghua.edu.cn/simple

echo
echo "[2/4] 校验数据库密钥 key.txt ..."
if [ -s key.txt ]; then
  echo "key.txt 已存在（内置密钥），跳过"
else
  python3 gen_key.py
fi

echo
echo "[3/4] 下载 MediaCrawler ..."
if [ -f MediaCrawler/main.py ]; then
  echo "MediaCrawler 已存在，跳过下载"
else
  git clone https://github.com/NanmiCoder/MediaCrawler.git MediaCrawler
  cd MediaCrawler
  echo "安装 MediaCrawler 依赖（几分钟）..."
  pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || \
    python3 -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
  python3 -m playwright install chromium
  cd ..
fi

echo
echo "[4/4] 环境自检 ..."
python3 setup_check.py

echo
echo "配置结束。下一步运行: python3 monitor.py  （首次会弹扫码）"
