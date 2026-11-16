@echo off
chcp 65001 >nul
title 安装定时任务（工作时段自动采集）
echo.
echo  ================================================
echo   安装定时任务：
echo   采集 9:30 / 12:00 / 14:30 / 17:30（每日）
echo   日报推送 10:00（每日）
echo  ================================================
echo.
cd /d "%~dp0"
set SCRIPT_DIR=%cd%

set CMDLINE=cmd /c "cd /d %SCRIPT_DIR% && python monitor.py >> %SCRIPT_DIR%\monitor.log 2>&1"

schtasks /create /tn "XhsYiqing_0930" /tr "%CMDLINE%" /sc daily /st 09:30 /f >nul
schtasks /create /tn "XhsYiqing_1200" /tr "%CMDLINE%" /sc daily /st 12:00 /f >nul
schtasks /create /tn "XhsYiqing_1430" /tr "%CMDLINE%" /sc daily /st 14:30 /f >nul
schtasks /create /tn "XhsYiqing_1730" /tr "%CMDLINE%" /sc daily /st 17:30 /f >nul

set PUSHLINE=cmd /c "cd /d %SCRIPT_DIR% && python monitor.py --push-only >> %SCRIPT_DIR%\monitor.log 2>&1"
schtasks /create /tn "XhsYiqing_push" /tr "%PUSHLINE%" /sc daily /st 10:00 /f >nul

echo 已安装 5 个定时任务：
schtasks /query /tn "XhsYiqing_0930" | findstr /i "任务名" >nul && echo   [OK] 09:30 采集
schtasks /query /tn "XhsYiqing_1200" | findstr /i "任务名" >nul && echo   [OK] 12:00 采集
schtasks /query /tn "XhsYiqing_1430" | findstr /i "任务名" >nul && echo   [OK] 14:30 采集
schtasks /query /tn "XhsYiqing_1730" | findstr /i "任务名" >nul && echo   [OK] 17:30 采集
schtasks /query /tn "XhsYiqing_push" | findstr /i "任务名" >nul && echo   [OK] 10:00 日报推送

echo.
echo 说明：
echo  · 需电脑开机且未睡眠；睡眠会跳过（可手动跑「立即采集.bat」补）
echo  · 日志：collector\monitor.log
echo  · 删除全部任务：运行 卸载定时任务.bat
pause
