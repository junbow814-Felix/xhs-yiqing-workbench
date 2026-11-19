@echo off
chcp 65001 >nul
title XHS Monitor - Run Now
echo ================================================
echo   XHS Monitor - Run crawl now
echo ================================================
cd /d "%~dp0"
python monitor.py %*
echo.
echo Finished. Window closes in 15 seconds...
timeout /t 15 >nul
