#!/bin/bash
# install-cron-mac.sh — 定时任务：每 2 小时采集分析（9:30~21:30）/ 每日 10:00 推送日报
# 修改频率：先 bash uninstall-cron-mac.sh，改本文件里的 cron 表达式后重跑
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

# 工作时段采集：9:30 / 12:00 / 14:30 / 17:30（笔记级合并，历史与预警状态保留）
JOB_CRAWL="30 9,12,14,17 * * * cd \"$ABS\" && $ENV_LINE \"$PY\" monitor.py >> \"$ABS/monitor.log\" 2>&1 # XhsYiqingCrawl"
# 每日 10:00 推送日报（汇总前一天 9:30 至今的全部采集情况）
JOB_PUSH="0 10 * * * cd \"$ABS\" && $ENV_LINE \"$PY\" monitor.py --push-only >> \"$ABS/monitor.log\" 2>&1 # XhsYiqingPush"

( crontab -l 2>/dev/null | grep -v "XhsYiqingCrawl\|XhsYiqingPush\|XhsYiqingMonitor" ; echo "$JOB_CRAWL" ; echo "$JOB_PUSH" ) | crontab -

echo "已安装定时任务："
crontab -l | grep XhsYiqing
echo
echo "· 工作时段采集：9:30 / 12:00 / 14:30 / 17:30（合并写入，历史笔记与预警状态保留）"
echo "· 每日 10:00 推送日报：汇总前一天 9:30 至今的全部采集情况（含竞品蹭评统计）"
echo "· 下班后/夜间不运行。前提：Mac 开机且未睡眠。日志见 collector/monitor.log"
echo "删除：bash uninstall-cron-mac.sh"
