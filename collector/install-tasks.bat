@echo off
chcp 65001 >nul
title XHS Monitor - Install Scheduled Tasks
echo ================================================
echo   Install daily tasks:
echo   Crawl  09:30 / 12:00 / 14:30 / 17:30
echo   Report push 10:00
echo ================================================
cd /d "%~dp0"
set SCRIPT_DIR=%cd%

set CMDLINE=cmd /c "cd /d %SCRIPT_DIR% && python monitor.py >> %SCRIPT_DIR%\monitor.log 2>&1"

schtasks /create /tn "XhsYiqing_0930" /tr "%CMDLINE%" /sc daily /st 09:30 /f >nul
schtasks /create /tn "XhsYiqing_1200" /tr "%CMDLINE%" /sc daily /st 12:00 /f >nul
schtasks /create /tn "XhsYiqing_1430" /tr "%CMDLINE%" /sc daily /st 14:30 /f >nul
schtasks /create /tn "XhsYiqing_1730" /tr "%CMDLINE%" /sc daily /st 17:30 /f >nul

set PUSHLINE=cmd /c "cd /d %SCRIPT_DIR% && python monitor.py --push-only >> %SCRIPT_DIR%\monitor.log 2>&1"
schtasks /create /tn "XhsYiqing_push" /tr "%PUSHLINE%" /sc daily /st 10:00 /f >nul

schtasks /query /tn "XhsYiqing_0930" >nul 2>&1 && echo   [OK] 09:30 crawl
schtasks /query /tn "XhsYiqing_1200" >nul 2>&1 && echo   [OK] 12:00 crawl
schtasks /query /tn "XhsYiqing_1430" >nul 2>&1 && echo   [OK] 14:30 crawl
schtasks /query /tn "XhsYiqing_1730" >nul 2>&1 && echo   [OK] 17:30 crawl
schtasks /query /tn "XhsYiqing_push" >nul 2>&1 && echo   [OK] 10:00 report push

echo.
echo Notes:
echo   - PC must be ON and awake at those times (sleep skips tasks)
echo   - Log: collector\monitor.log
echo   - Remove all tasks: run "xiezai-dingshi.bat"
pause
