@echo off
chcp 65001 >nul
title 一键配置采集环境
echo.
echo  ================================================
echo   小红书舆情采集 · 一键配置
echo   （1/4 安装 Python 依赖  2/4 生成数据库密钥
echo     3/4 下载 MediaCrawler  4/4 环境自检）
echo  ================================================
echo.
cd /d "%~dp0"

echo [1/4] 安装 Python 依赖 requests 和 snownlp ...
pip install requests snownlp -i https://pypi.tuna.tsinghua.edu.cn/simple
echo.

echo [2/4] 生成数据库密钥文件 key.txt ...
python -c "import sys; sys.path.insert(0,'.'); from gen_key import write_key; write_key()" 2>nul || (
  echo 首次请手动执行下面第 3 步前，把密钥写入 key.txt
)
echo.

echo [3/4] 下载 MediaCrawler ...
if exist MediaCrawler\main.py (
  echo MediaCrawler 已存在，跳过下载
) else (
  echo 需要联网下载，请耐心等待...
  git clone https://github.com/NanmiCoder/MediaCrawler.git MediaCrawler
  if exist MediaCrawler\main.py (
    echo 正在安装 MediaCrawler 依赖...
    cd MediaCrawler
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple 2>nul
    python -m playwright install chromium
    cd ..
  ) else (
    echo 下载失败！请确认已安装 git，或手动下载后放到本目录
  )
)
echo.

echo [4/4] 运行环境自检 ...
python setup_check.py
echo.
echo 配置流程结束。接下来双击「立即采集.bat」开始首次采集（会弹扫码）。
pause
