@echo off
chcp 65001 >nul
title 小红书舆情监控 - 立即采集
echo.
echo  ================================================
echo   小红书舆情监控 · 立即采集最新舆情
echo   抓取完成后自动分析并同步到团队工作台
echo  ================================================
echo.
REM 切到脚本所在目录
cd /d "%~dp0"
python monitor.py
echo.
echo 运行结束。窗口将在 10 秒后关闭（或直接关闭）...
timeout /t 10 >nul
