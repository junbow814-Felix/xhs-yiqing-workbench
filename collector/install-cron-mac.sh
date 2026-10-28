#!/bin/bash
# install-cron-mac.sh — 安装定时任务：每日 09:30 采集分析 / 10:00 推送日报
# 修改时间：先 bash uninstall-cron-mac.sh 再改本文件里的时间后重跑
set -e
cd "$(dirname "$0")"
ABS="$(pwd)"

PY="$(command -v python3)"
if [ -z "$PY" ]; then
  echo "找不到 python3，请先运行 bash setup-mac.sh"
  exit 1
fi

# 读取 zshrc 里的环境变量（DASHSCOPE_API_KEY 等），cron 环境不加载 ~/.zshrc
ENV_LINE="export \$(grep -E '^export (DASHSCOPE_API_KEY|LLM_API_KEY|MODEL_TEXT|MODEL_VISION)=' ~/.zshrc 2>/dev/null | sed 's/^export //'); "

JOB_CRAWL="30 9 * * * cd \"$ABS\" && $ENV_LINE \"$PY\" monitor.py >> \"$ABS/monitor.log\" 2>&1 # XhsYiqingCrawl"
JOB_PUSH="0 10 * * * cd \"$ABS\" && $ENV_LINE \"$PY\" monitor.py --push-only >> \"$ABS/monitor.log\" 2>&1 # XhsYiqingPush"

( crontab -l 2>/dev/null | grep -v "XhsYiqingCrawl\|XhsYiqingPush" ; echo "$JOB_CRAWL" ; echo "$JOB_PUSH" ) | crontab -

echo "已安装定时任务："
crontab -l | grep XhsYiqing
echo
echo "· 09:30 自动采集（双批：综合+最新排序）+ AI 判定 + 写入工作台"
echo "· 10:00 从工作台取最新日报推送到 IM 群（需在工作台「上报设置」里配好 Webhook）"
echo "· 前提：Mac 开机且未睡眠。日志见 collector/monitor.log"
echo "删除：bash uninstall-cron-mac.sh"
