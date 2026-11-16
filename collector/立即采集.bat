@echo off
chcp 65001 >nul
title 小红书舆情监控 - 立即采集
echo.
echo  ================================================
echo   小红书舆情监控 · 立即采集最新舆情
echo   （双批采集：热度+最新排序，AI判定，自动入库）
echo  ================================================
echo.
cd /d "%~dp0"
python monitor.py %*
echo.
echo 运行结束。窗口将在 15 秒后关闭（或直接关闭）...
timeout /t 15 >nul
