#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monitor.py — 小红书舆情一键采集：MediaCrawler 抓取 → SnowNLP 情感分析 → 写入工作台数据库
用法：
    python monitor.py            # 全流程：采集最新笔记 + 分析 + 入库
    python monitor.py --skip-crawl  # 跳过采集，只分析已有数据并入库（调试用）
前提：首次运行前请先阅读 SETUP.md 完成环境安装与小红书扫码登录。
"""
import argparse
import datetime
import glob
import json
import os
import subprocess
import sys
import time

try:
    import requests
except ImportError:
    print("缺少 requests，请运行: pip install requests snownlp")
    sys.exit(1)

try:
    from snownlp import SnowNLP
except ImportError:
    print("缺少 snownlp，请运行: pip install requests snownlp")
    sys.exit(1)

# ========== 配置区（安装时会自动填好，也可手动改） ==========
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tqczpfzzlgtkrttndxlf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY3pwZnp6bGd0a3J0dG5keGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTUxMDEsImV4cCI6MjEwODY3MTEwMX0.9uA6lKFGlma0LZRRQyfC9iLLRXKoMjaZMMcWkT8wuL0")
MEDIA_CRAWLER_DIR = os.environ.get("MEDIA_CRAWLER_DIR", "MediaCrawler")

NEG_THRESHOLD = 0.4   # SnowNLP 情感分低于此值判为负面
HIGH_LIKES = 2500     # 负面且点赞超过此值 → 高风险
MID_LIKES = 800       # 负面且点赞超过此值 → 中风险
# ===========================================================

if not SUPABASE_KEY:
    print("错误：未配置 SUPABASE_ANON_KEY。请打开 monitor.py 填入，或先运行 setup_check.py")
    sys.exit(1)

HDRS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
}


def log(msg):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def fetch_keywords():
    """从工作台数据库拉取团队共享的监控关键词（只取启用中的）"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/keywords?select=name&enabled=eq.true",
        headers=HDRS, timeout=15,
    )
    r.raise_for_status()
    kws = [row["name"] for row in r.json()]
    log(f"从工作台同步到 {len(kws)} 个监控关键词: {', '.join(kws) or '(无)'}")
    return kws


def write_keywords_to_crawler(keywords):
    """把工作台的关键词写进 MediaCrawler 配置（base_config.py 的 KEYWORDS 行）"""
    cfg_path = os.path.join(MEDIA_CRAWLER_DIR, "config", "base_config.py")
    if not os.path.exists(cfg_path):
        log(f"警告：找不到 {cfg_path}，请确认 MediaCrawler 目录正确")
        return False
    with open(cfg_path, "r", encoding="utf-8") as f:
        content = f.read()
    lines = content.split("\n")
    new_line = f'KEYWORDS = "{",".join(keywords)}"'
    found = False
    for i, line in enumerate(lines):
        if line.strip().startswith("KEYWORDS"):
            lines[i] = new_line
            found = True
            break
    if not found:
        lines.insert(0, new_line)
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"已把关键词写入 MediaCrawler 配置")
    return True


def run_crawler():
    """运行 MediaCrawler 抓取小红书（cookie 模式；首次会要求扫码）"""
    cmd = [
        sys.executable, "main.py",
        "--platform", "xhs",
        "--lt", "qrcode",
        "--type", "search",
    ]
    log("启动 MediaCrawler 采集（首次运行会弹出浏览器要求扫码登录，之后复用登录态）…")
    result = subprocess.run(cmd, cwd=MEDIA_CRAWLER_DIR)
    if result.returncode != 0:
        log("MediaCrawler 运行异常（返回码非 0），继续尝试处理已抓到的数据")


def find_latest_data():
    """找 MediaCrawler 最新输出的一批 JSON"""
    pattern = os.path.join(MEDIA_CRAWLER_DIR, "data", "xhs", "**", "*.json")
    files = sorted(glob.glob(pattern, recursive=True), key=os.path.getmtime)
    if not files:
        # 兼容部分版本直接落 data/xhs/*.json
        pattern2 = os.path.join(MEDIA_CRAWLER_DIR, "data", "xhs", "*.json")
        files = sorted(glob.glob(pattern2), key=os.path.getmtime)
    return files[-1] if files else None


def analyze(file_path, keywords):
    """读取采集结果，做情感分析 + 风险分级"""
    items = []
    with open(file_path, encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                n = json.loads(line)
            except json.JSONDecodeError:
                continue
            title = (n.get("title") or (n.get("desc") or "")[:50] or "").strip()
            if not title:
                continue
            text_for_score = f"{title}。{(n.get('desc') or '')[:200]}"
            try:
                score = SnowNLP(text_for_score).sentiments  # 0~1，越低越负面
            except Exception:
                score = 0.5
            sent = "neg" if score < NEG_THRESHOLD else ("pos" if score > 0.6 else "neu")
            likes = int(n.get("liked_count") or 0)
            risk = "无"
            if sent == "neg":
                risk = "高" if likes > HIGH_LIKES else ("中" if likes > MID_LIKES else "低")
            # 关键词归属：优先用采集源字段，否则按标题匹配
            kw = n.get("source_keyword") or n.get("keyword") or ""
            if not kw:
                kw = next((k for k in keywords if k in title), keywords[0] if keywords else "未分类")
            items.append({
                "kw": kw,
                "title": title[:300],
                "author": (n.get("nickname") or "")[:100],
                "sent": sent,
                "score": round(score, 3),
                "likes": likes,
                "comments": int(n.get("total_comment_count") or n.get("comment_count") or 0),
                "collects": int(n.get("collected_count") or 0),
                "risk": risk,
                "excerpt": (n.get("desc") or "")[:2000],
                "source": "real",
                "published_at": n.get("publish_time") or n.get("time") or datetime.datetime.now().isoformat(),
            })
    return items


def push_to_workbench(items):
    """整体替换工作台数据库中的真实笔记"""
    if not items:
        log("没有可写入的数据")
        return
    # 清空上一批
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/notes?source=eq.real", headers=HDRS, timeout=30)
    r.raise_for_status()
    # 分批插入
    for i in range(0, len(items), 100):
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/notes",
            headers=HDRS, json=items[i:i + 100], timeout=30,
        )
        r.raise_for_status()
    log(f"已写入 {len(items)} 篇笔记到工作台，打开网页即可看到（页面每 30 秒自动刷新，或点「立即同步」）")


def save_daily_report(items):
    """把日报写入工作台「上报中心」"""
    today = datetime.date.today().isoformat()
    neg = [x for x in items if x["sent"] == "neg"]
    high = [x for x in items if x["risk"] == "高"]
    lines = [
        f"【小红书舆情日报】{today}",
        f"监控笔记 {len(items)} 篇 | 负面 {len(neg)} 篇 | 高风险 {len(high)} 条",
        "",
    ]
    top = sorted(neg, key=lambda x: -x["likes"])[:3]
    for i, t in enumerate(top, 1):
        lines.append(f'{i}. {t["title"]}（赞 {t["likes"]} | 风险 {t["risk"]} | 情感分 {t["score"]}）')
    if not top:
        lines.append("今日无显著负面笔记")
    if high:
        lines.append(f"\n⚠️ 高风险 {len(high)} 条，建议 24 小时内响应")
    content = "\n".join(lines)
    summary = f"笔记 {len(items)} 篇 · 负面 {len(neg)} 篇（自动采集）"
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/reports",
        headers={**HDRS, "Prefer": "resolution=merge-duplicates"},
        json=[{"rep_date": today, "content": content, "summary": summary}],
        timeout=30,
    )
    r.raise_for_status()
    log("日报已写入工作台「上报中心」")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-crawl", action="store_true", help="跳过采集，只处理已有数据")
    args = parser.parse_args()

    log("=== 小红书舆情监控 · 一键采集开始 ===")
    keywords = fetch_keywords()
    if not keywords:
        log("工作台里没有启用中的关键词，请先到网页上添加")
        sys.exit(0)

    if not args.skip_crawl:
        write_keywords_to_crawler(keywords)
        run_crawler()

    data_file = find_latest_data()
    if not data_file:
        log("错误：MediaCrawler 没有产出数据文件。请检查采集是否成功（登录是否过期等）")
        sys.exit(1)
    log(f"分析采集数据: {data_file}")
    items = analyze(data_file, keywords)
    log(f"情感分析完成：{len(items)} 篇 | 负面 {sum(1 for x in items if x['sent']=='neg')} 篇")
    if not items:
        sys.exit(1)

    push_to_workbench(items)
    save_daily_report(items)
    log("=== 完成！打开工作台即可查看最新舆情 ===")


if __name__ == "__main__":
    main()
