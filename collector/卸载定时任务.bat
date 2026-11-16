@echo off
chcp 65001 >nul
title 卸载定时任务
echo 删除全部小红书舆情定时任务...
schtasks /delete /tn "XhsYiqing_0930" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1200" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1430" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1730" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_push" /f >nul 2>&1
schtasks /delete /tn "XhsYiqingMonitor" /f >nul 2>&1
echo 已全部删除。
pause
