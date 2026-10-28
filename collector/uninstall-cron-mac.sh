#!/bin/bash
# uninstall-cron-mac.sh — 删除定时任务
( crontab -l 2>/dev/null | grep -v "XhsYiqingCrawl\|XhsYiqingPush\|XhsYiqingMonitor" ) | crontab -
echo "已删除。当前 crontab："
crontab -l 2>/dev/null || echo "(空)"
