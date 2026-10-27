#!/bin/bash
# install-cron-mac.sh — 安装每日 08:00 自动采集的 crontab（macOS）
set -e
cd "$(dirname "$0")"
ABS="$(pwd)"

# python3 绝对路径
PY="$(command -v python3)"
if [ -z "$PY" ]; then
  echo "找不到 python3，请先运行 bash setup-mac.sh"
  exit 1
fi

JOB="0 8 * * * cd \"$ABS\" && \"$PY\" monitor.py >> \"$ABS/monitor.log\" 2>&1 # XhsYiqingMonitor"

# 去掉旧的同名任务再追加（幂等）
( crontab -l 2>/dev/null | grep -v "XhsYiqingMonitor" ; echo "$JOB" ) | crontab -

echo "已安装每日 08:00 自动采集任务："
crontab -l | grep XhsYiqingMonitor
echo
echo "删除任务: bash uninstall-cron-mac.sh （或 crontab -e 手动删）"
