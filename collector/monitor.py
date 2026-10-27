#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monitor.py — 小红书舆情一键采集：MediaCrawler 抓取 → 大模型/SnowNLP 情感分析 → 写入工作台数据库
用法：
    python3 monitor.py           # 全流程：采集最新笔记 + 分析 + 入库
    python3 monitor.py --skip-crawl  # 跳过采集，只分析已有数据并入库（调试用）
前提：首次运行前请先阅读 SETUP.md 完成环境安装与小红书扫码登录。
"""
import argparse
import datetime
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


# ---------- 大模型情感判定 ----------

def llm_sentiment(text: str) -> dict:
    """用通义千问判定情感。返回 {sent, reason, engine}。失败抛异常由调用方降级。"""
    prompt = (
        "你是小红书舆情分析专家。判断下面这篇笔记对品牌/产品的情感倾向。\n"
        "只输出一行 JSON（不要多余文字），格式：\n"
        '{"sent": "neg|neu|pos", "reason": "不超过30字的判断依据"}\n'
        "注意：种草推荐、好评、晒效果好 = pos；吐槽、避雷、投诉、质疑 = neg；"
        "测评中立、求推荐、无明显倾向 = neu。注意识别反讽和网络流行语的真实含义。\n\n"
        f"笔记内容：\n{text[:800]}"
    )
    r = requests.post(
        f"{LLM_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}"},
        json={
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
        },
        timeout=30,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"].strip()
    # 提取 JSON（兼容模型输出 markdown 代码块包裹）
    import re
    m = re.search(r"\{.*\}", content, re.S)
    if not m:
        raise ValueError(f"模型输出无法解析: {content[:100]}")
    d = json.loads(m.group(0))
    sent = d.get("sent")
    if sent not in ("neg", "neu", "pos"):
        raise ValueError(f"sent 值非法: {sent}")
    return {"sent": sent, "reason": str(d.get("reason", ""))[:60], "engine": f"大模型({LLM_MODEL})"}


def snownlp_sentiment(text: str) -> dict:
    """降级方案：SnowNLP 打分。返回 {sent, reason, engine}。"""
    try:
        score = SnowNLP(text).sentiments  # 0~1，越低越负面
    except Exception:
        score = 0.5
    sent = "neg" if score < NEG_THRESHOLD else ("pos" if score > 0.6 else "neu")
    return {"sent": sent, "reason": f"SnowNLP情感分 {score:.2f}", "engine": "SnowNLP"}

# ========== 配置区（安装时会自动填好，也可手动改） ==========
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tqczpfzzlgtkrttndxlf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
MEDIA_CRAWLER_DIR = os.environ.get("MEDIA_CRAWLER_DIR", "MediaCrawler")

# 大模型情感判定（通义千问，兼容 OpenAI 接口格式）。
# 申请免费 Key: https://bailian.console.aliyun.com/ → API-KEY 管理 → 创建。
# 留空则自动降级为 SnowNLP 判定（准确率较低）。
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen-plus")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")

NEG_THRESHOLD = 0.4   # SnowNLP 情感分低于此值判为负面（仅降级模式使用）
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
    """找 MediaCrawler 最新产出的笔记数据文件（jsonl 优先，兼容 csv/json）。
    新版路径: data/xhs/jsonl/search_contents_<日期>.jsonl
    """
    base = os.path.join(MEDIA_CRAWLER_DIR, "data", "xhs")
    if not os.path.isdir(base):
        return None
    candidates = []
    for root, _dirs, files in os.walk(base):
        for f in files:
            # 只要笔记正文文件，排除评论文件
            if "contents" not in f:
                continue
            if f.endswith((".jsonl", ".json", ".csv")):
                p = os.path.join(root, f)
                candidates.append((os.path.getmtime(p), p))
    if not candidates:
        return None
    candidates.sort()
    return candidates[-1][1]


def find_comments_files():
    """找同目录下同一天产出的评论文件（用于丰富情感分析文本）"""
    data_file = find_latest_data()
    if not data_file:
        return []
    root = os.path.dirname(data_file)
    stem_date = data_file.rsplit("_", 1)[-1].split(".")[0]  # 如 2026-10-27
    cmts = []
    for f in os.listdir(root):
        if "comments" in f and stem_date in f:
            cmts.append(os.path.join(root, f))
    return cmts


def load_comments_map(comment_files):
    """note_id -> 热评文本列表（取点赞最高的前 5 条）"""
    m = {}
    for path in comment_files:
        with open(path, encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if not line:
                    continue
                try:
                    c = json.loads(line)
                except json.JSONDecodeError:
                    continue
                nid = c.get("note_id")
                if not nid:
                    continue
                try:
                    likes = int(c.get("like_count") or 0)
                except (TypeError, ValueError):
                    likes = 0
                m.setdefault(nid, []).append((likes, c.get("content") or ""))
    out = {}
    for nid, lst in m.items():
        lst.sort(key=lambda x: -x[0])
        out[nid] = [t for _, t in lst[:5] if t]
    return out


def normalize_time(raw):
    """把 MediaCrawler 的 time 字段（毫秒时间戳/秒级时间戳/字符串日期）统一转成 ISO 格式"""
    if raw is None:
        return datetime.datetime.now().isoformat()
    # 数字时间戳
    try:
        ts = float(raw)
        if ts > 1e12:      # 毫秒
            ts /= 1000
        elif ts > 1e9:     # 秒
            pass
        else:
            raise ValueError
        return datetime.datetime.fromtimestamp(ts).isoformat()
    except (TypeError, ValueError):
        pass
    # 字符串：尝试常见格式
    s = str(raw).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    return datetime.datetime.now().isoformat()


def analyze(file_path, keywords):
    """读取采集结果（jsonl/csv/json），做情感分析 + 风险分级（正文 + 热评一起分析）"""
    comments_map = load_comments_map(find_comments_files())
    items = []
    seen_ids = set()

    rows = []
    if file_path.endswith(".csv"):
        import csv as _csv
        with open(file_path, encoding="utf-8-sig") as fp:
            rows = list(_csv.DictReader(fp))
    else:
        with open(file_path, encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if line:
                    try:
                        rows.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

    use_llm = bool(DASHSCOPE_API_KEY)
    log(f"情感判定引擎: {'通义千问 ' + LLM_MODEL if use_llm else 'SnowNLP（未配置 DASHSCOPE_API_KEY，准确率较低；申请免费 Key 见 SETUP.md）'}")

    for n in rows:
        if not isinstance(n, dict):
            continue
        nid = n.get("note_id")
        if nid and nid in seen_ids:
            continue  # 追加写可能重复，去重
        if nid:
            seen_ids.add(nid)
        title = (n.get("title") or (n.get("desc") or "")[:50] or "").strip()
        if not title:
            continue
        desc = (n.get("desc") or "").strip()
        hot_comments = comments_map.get(nid, [])
        # 情感分析文本：标题 + 正文 + 热评
        text_for_score = f"{title}。{desc[:300]}"
        if hot_comments:
            text_for_score += "。" + "。".join(c[:80] for c in hot_comments[:3])

        # 情感判定：大模型优先，失败自动降级 SnowNLP
        if use_llm:
            try:
                verdict = llm_sentiment(text_for_score)
            except Exception as e:
                log(f"  大模型判定失败（{str(e)[:60]}），本篇降级 SnowNLP")
                verdict = snownlp_sentiment(text_for_score)
        else:
            verdict = snownlp_sentiment(text_for_score)
        sent = verdict["sent"]

        likes = int(n.get("liked_count") or 0)
        risk = "无"
        if sent == "neg":
            risk = "高" if likes > HIGH_LIKES else ("中" if likes > MID_LIKES else "低")
        # 关键词归属：优先用采集源字段，否则按标题/正文匹配
        kw = n.get("source_keyword") or n.get("keyword") or ""
        if not kw:
            kw = next((k for k in keywords if k in title or k in desc), keywords[0] if keywords else "未分类")

        # 笔记原文链接：优先用采集的 note_url，否则用 note_id 构造
        note_url = (n.get("note_url") or "").strip()
        if not note_url and nid:
            note_url = f"https://www.xiaohongshu.com/explore/{nid}"

        excerpt = f"【{verdict['engine']}判定：{sent_name_cn(sent)}】依据：{verdict['reason']}\n\n{desc[:1800]}"
        if hot_comments:
            excerpt += ("\n\n—— 热评（采集）——\n" + "\n".join(f"· {c[:100]}" for c in hot_comments[:5]))
        items.append({
            "kw": kw,
            "title": title[:300],
            "author": (n.get("nickname") or "")[:100],
            "sent": sent,
            "score": 0,  # 兼容日报字段
            "likes": likes,
            "comments": int(n.get("comment_count") or 0),
            "collects": int(n.get("collected_count") or 0),
            "risk": risk,
            "excerpt": excerpt,
            "source": "real",
            "note_url": note_url,
            "published_at": normalize_time(n.get("time") or n.get("publish_time")),
        })
    return items


def sent_name_cn(s: str) -> str:
    return {"neg": "负面", "neu": "中性", "pos": "正面"}.get(s, s)


def push_to_workbench(items):
    """整体替换工作台数据库中的真实笔记"""
    if not items:
        log("没有可写入的数据")
        return
    # 只发数据库表里存在的列，多余字段（如 score）全部剔除
    DB_FIELDS = {"kw", "title", "author", "sent", "likes", "comments",
                 "collects", "risk", "excerpt", "source", "note_url", "published_at"}
    rows = [{k: v for k, v in it.items() if k in DB_FIELDS} for it in items]
    # 清空上一批
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/notes?source=eq.real", headers=HDRS, timeout=30)
    if r.status_code >= 400:
        log(f"清空旧数据失败 HTTP {r.status_code}: {r.text[:200]}")
        sys.exit(1)
    # 分批插入，失败时打印服务器具体原因
    for i in range(0, len(rows), 100):
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/notes",
            headers=HDRS, json=rows[i:i + 100], timeout=30,
        )
        if r.status_code >= 400:
            log(f"写入失败 HTTP {r.status_code}: {r.text[:300]}")
            sys.exit(1)
    log(f"已写入 {len(rows)} 篇笔记到工作台，打开网页即可看到（页面每 30 秒自动刷新，或点「立即同步」）")


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
        lines.append(f'{i}. {t["title"]}（赞 {t["likes"]} | 风险 {t["risk"]}）')
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
        params={"on_conflict": "rep_date"},
        timeout=30,
    )
    if r.status_code >= 400:
        log(f"日报写入失败 HTTP {r.status_code}: {r.text[:200]}（不影响笔记数据，可稍后在工作台手动生成）")
        return
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
