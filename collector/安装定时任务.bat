@echo off
chcp 65001 >nul
title 安装每日定时任务
echo.
echo  ================================================
echo   安装「每日 08:00 自动采集」定时任务
echo   （删除任务请运行: schtasks /delete /tn XhsYiqingMonitor /f）
echo  ================================================
echo.
REM 切到脚本所在目录，取绝对路径
cd /d "%~dp0"
set SCRIPT_DIR=%cd%
schtasks /create /tn "XhsYiqingMonitor" /tr "cmd /c cd /d \"%SCRIPT_DIR%\" && python monitor.py >> monitor.log 2>&1" /sc daily /st 08:00 /f
echo.
echo 完成！以后每天早上 8 点自动采集（需电脑开机状态）。
echo 如需改时间：先运行 schtasks /delete /tn XhsYiqingMonitor /f 再以新时间重跑本脚本。
pause
