@echo off
chcp 65001 >nul
title XHS Monitor - Setup
echo ================================================
echo   XHS Monitor - One-Click Setup
echo   1/4 Install Python deps  2/4 Check DB key
echo   3/4 Download MediaCrawler 4/4 Self-check
echo ================================================
cd /d "%~dp0"

echo [1/4] Installing Python packages (requests / snownlp) ...
pip install requests snownlp -i https://pypi.tuna.tsinghua.edu.cn/simple
echo.

echo [2/4] Checking key.txt ...
if exist key.txt (
  echo [OK] key.txt found
) else (
  echo [FAIL] key.txt missing! Copy it from the handover package.
)
echo.

echo [3/4] Downloading MediaCrawler ...
if exist MediaCrawler\main.py (
  echo MediaCrawler exists, skip download
) else (
  git clone https://github.com/NanmiCoder/MediaCrawler.git MediaCrawler
  if exist MediaCrawler\main.py (
    echo Installing MediaCrawler deps ...
    cd MediaCrawler
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    python -m playwright install chromium
    cd ..
  ) else (
    echo [FAIL] git clone failed! Check network or git install.
  )
)
echo.

echo [4/4] Self check ...
python setup_check.py
echo.
echo Setup finished. Next: run "liji-caiji.bat" (first run needs QR scan).
pause
