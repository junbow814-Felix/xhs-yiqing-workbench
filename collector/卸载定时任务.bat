@echo off
chcp 65001 >nul
title Remove Scheduled Tasks
echo Removing all XHS Monitor scheduled tasks...
schtasks /delete /tn "XhsYiqing_0930" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1200" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1430" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_1730" /f >nul 2>&1
schtasks /delete /tn "XhsYiqing_push" /f >nul 2>&1
schtasks /delete /tn "XhsYiqingMonitor" /f >nul 2>&1
echo Done.
pause
