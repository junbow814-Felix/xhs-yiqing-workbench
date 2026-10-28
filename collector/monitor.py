#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monitor.py — 小红书舆情一键采集 v3
流程：双批采集（综合+最新）→ 图片视觉分析（通义qwen-vl-flash）→ 全量评论分析 →
      笔记/评论独立双标签 + 竞品蹭评识别 → 写入工作台数据库 → 生成日报

用法：
    python3 monitor.py               # 全流程
    python3 monitor.py --skip-crawl  # 只分析已有采集数据
    python3 monitor.py --push-only   # 只推送最新日报到 IM（定时任务 10:00 用）
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import time

try:
    import requests
except ImportError:
    print("缺少 requests，请运行: pip install requests snownlp")
    sys.exit(1)

# ========== 配置区 ==========
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tqczpfzzlgtkrttndxlf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
MEDIA_CRAWLER_DIR = os.environ.get("MEDIA_CRAWLER_DIR", "MediaCrawler")

# 大模型（统一通义千问）：
#   文本判定/评论分析: qwen-turbo（文本，便宜）
#   图片视觉分析:      qwen-vl-flash（视觉，便宜）
# Key 申请: https://bailian.console.aliyun.com/ → API-KEY
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
LLM_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_TEXT = os.environ.get("MODEL_TEXT", "qwen-flash")
MODEL_VISION = os.environ.get("MODEL_VISION", "qwen-vl-flash")

# 采集
NOTES_PER_BATCH = int(os.environ.get("NOTES_PER_BATCH", "20"))  # 每批抓取篇数（综合/最新各一批）
MAX_IMAGES_PER_NOTE = 5          # 每篇最多分析图片数
COMMENT_BATCH_SIZE = 15          # 评论每批判定条数
NEG_COMMENT_RATIO_LINE = 0.30    # 评论区负面占比 ≥30% → 评论·负面
SLEEP_BETWEEN_LLM = 1.2          # 相邻 LLM 调用间隔（秒），规避限流
LLM_MAX_RETRY = 4                # 限流重试次数

HIGH_LIKES = 2500                # 风险分级：负面+赞超此值
MID_LIKES = 800
# ===========================

if not SUPABASE_KEY:
    # 从 key.txt 兜底
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.txt")
    if os.path.exists(_p):
        SUPABASE_KEY = open(_p).read().strip()

HDRS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
}


def log(msg):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


# ============================================================
# LLM 调用（通义千问，OpenAI 兼容格式，限流自动重试）
# ============================================================

def llm_call(model, messages, max_retries=None):
    """调用通义千问。返回 content 字符串。限流自动等待重试。"""
    retries = LLM_MAX_RETRY if max_retries is None else max_retries
    for attempt in range(retries):
        try:
            r = requests.post(
                f"{LLM_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}"},
                json={"model": model, "messages": messages, "temperature": 0.1},
                timeout=60,
            )
        except requests.RequestException as e:
            log(f"  网络错误（{str(e)[:50]}），重试…")
            time.sleep(10)
            continue
        if r.status_code == 429 or "limit_requests" in r.text[:300] or "Throttling" in r.text[:300]:
            wait = 65 * (attempt + 1)
            log(f"  限流，等待 {wait}s（第 {attempt+1}/{retries} 次）…")
            time.sleep(wait)
            continue
        if r.status_code == 401:
            raise RuntimeError("API Key 无效，请检查 DASHSCOPE_API_KEY")
        if r.status_code >= 500:
            time.sleep(10)
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    raise RuntimeError("LLM 限流重试次数用尽")


def extract_json(content):
    """从模型输出中提取 JSON 对象"""
    m = re.search(r"\{.*\}", content, re.S)
    if not m:
        raise ValueError(f"输出无法解析: {content[:100]}")
    return json.loads(m.group(0))


# ============================================================
# 判定 1：笔记文字（标题+正文）
# ============================================================

def judge_note_text(title, desc):
    prompt = (
        "你是小红书舆情分析专家。只根据下面的笔记标题和正文，判断笔记本身对品牌/产品的情感。\n"
        "只输出一行 JSON：{\"sent\": \"neg|neu|pos\", \"reason\": \"不超过30字依据\"}\n"
        "种草好评=pos；吐槽避雷投诉质疑=neg；中立测评求推荐=neu。注意反讽和网络用语。\n\n"
        f"标题：{title}\n正文：{desc[:600]}"
    )
    try:
        d = extract_json(llm_call(MODEL_TEXT, [{"role": "user", "content": prompt}]))
        return d.get("sent", "neu"), str(d.get("reason", ""))[:40]
    except Exception as e:
        log(f"  笔记文字判定失败（{str(e)[:40]}），降级中性")
        return "neu", "判定失败"


# ============================================================
# 判定 2：笔记图片（视觉模型）
# ============================================================

def judge_note_images(image_urls):
    """逐张图片视觉判定。返回 (neg_found, img_reasons, img_descs)"""
    if not image_urls:
        return False, [], []
    neg, reasons, descs = False, [], []
    for url in image_urls[:MAX_IMAGES_PER_NOTE]:
        prompt = (
            "你是小红书舆情分析专家。分析这张小红书笔记配图。\n"
            '只输出一行 JSON：{"neg": true/false, "desc": "不超过20字图片内容", "reason": "负面原因或空"}\n'
            "neg=true 的情形：烂脸/过敏/差评对比图、讽刺挖苦暗示图、竞品产品出镜并贬低本品、"
            "截图引用负面评论、质检/成分质疑图。正常产品图/效果图/生活图=false。\n"
        )
        try:
            d = extract_json(llm_call(MODEL_VISION, [
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": url}},
                    {"type": "text", "text": prompt},
                ]},
            ]))
            descs.append(str(d.get("desc", ""))[:30])
            if d.get("neg"):
                neg = True
                reasons.append(str(d.get("reason", "图片含负面信息"))[:40])
        except Exception as e:
            descs.append(f"分析失败")
        time.sleep(SLEEP_BETWEEN_LLM)
    return neg, reasons, descs


# ============================================================
# 判定 3：全量评论（分批）
# ============================================================

def judge_comments(comments, own_brands):
    """全量评论分批判定。comments: [(likes, content), ...]; own_brands: 自家品牌词集合（小写）
    返回 {neg_count, pos_count, neu_count, shill_count, shill_brands, typical_neg, shill_samples}"""
    result = {"neg_count": 0, "pos_count": 0, "neu_count": 0,
              "shill_count": 0, "shill_brands": set(), "typical_neg": [], "shill_samples": []}
    if not comments:
        return result
    own_text = "、".join(sorted(own_brands)) if own_brands else "无"
    batches = [comments[i:i + COMMENT_BATCH_SIZE]
               for i in range(0, len(comments), COMMENT_BATCH_SIZE)]
    for batch in batches:
        lines = "\n".join(f"{i+1}. {c[:100]}" for i, (_l, c) in enumerate(batch))
        prompt = (
            "你是小红书舆情分析专家。逐条分析下面评论区每条评论。\n"
            '只输出一行 JSON：{"negs": [负面评论序号], "poss": [正面评论序号], '
            '"shills": [{"no": 序号, "brand": "被推荐的竞品品牌名"}]}\n'
            f"本品牌（自己家的，提到它们或其产品型号都不算竞品）：{own_text}\n"
            "负面=吐槽差评质疑避雷；竞品引导(shills)=推荐/暗示购买**其他品牌**、贬低本品捧其他品牌"
            "（注意：提到上面列出的自家品牌不算竞品；用户单纯问'有没有别的推荐'不算，"
            "明确带其他品牌名的推荐才算）。其余视为中性。\n\n"
            f"评论列表：\n{lines}"
        )
        try:
            d = extract_json(llm_call(MODEL_TEXT, [{"role": "user", "content": prompt}]))
            negs = set(int(x) for x in d.get("negs", []) if str(x).isdigit() or isinstance(x, int))
            poss = set(int(x) for x in d.get("poss", []) if str(x).isdigit() or isinstance(x, int))
            for shill in d.get("shills", []):
                no = int(shill.get("no", 0))
                brand = str(shill.get("brand", "")).strip()[:20]
                if not (1 <= no <= len(batch) and brand):
                    continue
                # 二次校验：竞品品牌命中自家词库 → 剔除（防模型漏看白名单）
                bl = brand.lower()
                if any(own in bl or bl in own for own in own_brands):
                    continue
                result["shill_count"] += 1
                result["shill_brands"].add(brand)
                result["shill_samples"].append(f"「{batch[no-1][1][:60]}」→{brand}")
            for i, (_l, c) in enumerate(batch, 1):
                if i in negs:
                    result["neg_count"] += 1
                    if len(result["typical_neg"]) < 3:
                        result["typical_neg"].append(c[:60])
                elif i in poss:
                    result["pos_count"] += 1
                else:
                    result["neu_count"] += 1
        except Exception as e:
            log(f"  评论批判定失败（{str(e)[:40]}），本批按中性处理")
            result["neu_count"] += len(batch)
        time.sleep(SLEEP_BETWEEN_LLM)
    return result


# ============================================================
# 采集（双批：综合 + 最新）
# ============================================================

def set_config(kv):
    """往 MediaCrawler base_config.py 写入/更新配置项"""
    cfg = os.path.join(MEDIA_CRAWLER_DIR, "config", "base_config.py")
    if not os.path.exists(cfg):
        log(f"警告：找不到 {cfg}")
        return
    with open(cfg, encoding="utf-8") as f:
        lines = f.read().split("\n")
    for key, val in kv.items():
        new_line = f"{key} = {val}"
        found = False
        for i, line in enumerate(lines):
            if line.strip().startswith(key + " ") or line.strip().startswith(key + "="):
                lines[i] = new_line
                found = True
                break
        if not found:
            lines.insert(1, new_line)
    with open(cfg, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def fetch_keywords():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/keywords?select=name,own_brands&enabled=eq.true",
                     headers=HDRS, timeout=30)
    r.raise_for_status()
    kws = {row["name"]: (row.get("own_brands") or "").strip() for row in r.json()}
    log(f"从工作台同步到 {len(kws)} 个监控关键词: {', '.join(kws) or '(无)'}")
    return kws


def build_own_brands(keyword, manual_brands):
    """自家品牌词库 = 手动白名单 + 自动派生（关键词本身 + 首词品牌）"""
    own = set()
    for b in (manual_brands or "").replace("，", ",").split(","):
        b = b.strip()
        if b:
            own.add(b.lower())
    own.add(keyword.strip().lower())
    first = keyword.strip().split()[0] if keyword.strip() else ""
    if first:
        own.add(first.lower())
    return own


def run_crawl_batches(keywords):
    """双批采集：第1批综合排序，第2批最新排序。keywords: {名: 白名单}"""
    set_config({
        "KEYWORDS": f'"{",".join(keywords)}"',
        "CRAWLER_MAX_NOTES_COUNT": str(NOTES_PER_BATCH),
        "ENABLE_GET_COMMENTS": "True",
        "SAVE_DATA_OPTION": '"jsonl"',
        "SORT_TYPE": '""',
    })
    log(f"第 1 批采集：综合排序，每词最多 {NOTES_PER_BATCH} 篇…")
    subprocess.run([sys.executable, "main.py", "--platform", "xhs", "--lt", "qrcode", "--type", "search"],
                   cwd=MEDIA_CRAWLER_DIR)
    time.sleep(5)
    set_config({"SORT_TYPE": '"time_descending"'})
    log("第 2 批采集：最新发布排序…")
    subprocess.run([sys.executable, "main.py", "--platform", "xhs", "--lt", "qrcode", "--type", "search"],
                   cwd=MEDIA_CRAWLER_DIR)
    # 还原排序配置，避免影响其他用法
    set_config({"SORT_TYPE": '""'})


# ============================================================
# 数据读取（jsonl：contents + comments）
# ============================================================

def data_base():
    return os.path.join(MEDIA_CRAWLER_DIR, "data", "xhs")


def load_today_data():
    """读取最新一批 contents + 全部 comments（按最新修改时间定位）"""
    base = data_base()
    contents, comments = {}, {}   # note_id -> row
    for root, _dirs, files in os.walk(base):
        for f in files:
            path = os.path.join(root, f)
            try:
                if "contents" in f and f.endswith(".jsonl"):
                    with open(path, encoding="utf-8") as fp:
                        for line in fp:
                            if line.strip():
                                n = json.loads(line)
                                nid = n.get("note_id")
                                if nid and (nid not in contents or
                                            os.path.getmtime(path) > contents[nid]["_mtime"]):
                                    n["_mtime"] = os.path.getmtime(path)
                                    contents[nid] = n
                elif "comments" in f and f.endswith(".jsonl"):
                    with open(path, encoding="utf-8") as fp:
                        for line in fp:
                            if line.strip():
                                c = json.loads(line)
                                nid = c.get("note_id")
                                if nid:
                                    comments.setdefault(nid, []).append(
                                        (int(c.get("like_count") or 0), c.get("content") or ""))
            except (json.JSONDecodeError, OSError):
                continue
    return contents, comments


def normalize_time(raw):
    if raw is None:
        return datetime.datetime.now().isoformat()
    try:
        ts = float(raw)
        if ts > 1e12:
            ts /= 1000
        elif ts > 1e9:
            pass
        else:
            raise ValueError
        return datetime.datetime.fromtimestamp(ts).isoformat()
    except (TypeError, ValueError):
        pass
    s = str(raw).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    return datetime.datetime.now().isoformat()


# ============================================================
# 主分析流程
# ============================================================

SENT_CN = {"neg": "负面", "neu": "中性", "pos": "正面"}


def analyze_all(contents, comments, keywords):
    """keywords: {关键词名: 手动白名单字符串}"""
    items = []
    use_llm = bool(DASHSCOPE_API_KEY)
    log(f"判定引擎: {'通义千问 文本=' + MODEL_TEXT + ' 视觉=' + MODEL_VISION if use_llm else '（未配置 Key！）'}")
    if not use_llm:
        log("错误：本版本需要 DASHSCOPE_API_KEY（通义千问）。请按 SETUP.md 配置后重跑。")
        sys.exit(1)

    total = len(contents)
    for idx, (nid, n) in enumerate(contents.items(), 1):
        title = (n.get("title") or (n.get("desc") or "")[:50] or "").strip()
        if not title:
            continue
        desc = (n.get("desc") or "").strip()
        likes = int(n.get("liked_count") or 0)
        kw = n.get("source_keyword") or next(
            (k for k in keywords if k in title or k in desc), next(iter(keywords), "未分类"))
        own_brands = build_own_brands(kw, keywords.get(kw, ""))
        note_url = (n.get("note_url") or "").strip() or f"https://www.xiaohongshu.com/explore/{nid}"
        log(f"({idx}/{total}) {title[:30]}")

        # ① 笔记文字判定
        note_sent, note_reason = judge_note_text(title, desc)
        time.sleep(SLEEP_BETWEEN_LLM)

        # ② 图片视觉判定
        image_urls = []
        raw_imgs = n.get("image_list")
        if isinstance(raw_imgs, str):
            try:
                raw_imgs = json.loads(raw_imgs)
            except json.JSONDecodeError:
                raw_imgs = []
        if isinstance(raw_imgs, list):
            image_urls = [u for u in raw_imgs if isinstance(u, str) and u.startswith("http")]
        img_neg, img_reasons, img_descs = judge_note_images(image_urls)

        # 笔记综合情感：文字或图片任一负面 → 笔记负面
        if note_sent == "neg" or img_neg:
            final_note_sent = "neg"
        elif note_sent == "neu":
            final_note_sent = "neu"
        else:
            final_note_sent = "pos"

        # ③ 全量评论判定
        note_comments = comments.get(nid, [])
        cm = judge_comments(note_comments, own_brands)
        cm_total = cm["neg_count"] + cm["pos_count"] + cm["neu_count"]
        cm_neg_ratio = (cm["neg_count"] / cm_total) if cm_total else 0

        # 评论区独立标签：竞品≥1 或 负面占比≥30% → 评论负面
        shill_hit = cm["shill_count"] >= 1
        if shill_hit or cm_neg_ratio >= NEG_COMMENT_RATIO_LINE:
            comment_sent = "neg"
        elif cm_total == 0:
            comment_sent = "neu"
        elif cm_neg_ratio <= 0.1 and cm["pos_count"] > cm["neg_count"]:
            comment_sent = "pos"
        else:
            comment_sent = "neu"

        # 负面来源
        note_neg = final_note_sent == "neg"
        cmt_neg = comment_sent == "neg"
        if note_neg and cmt_neg:
            neg_source = "both"
        elif note_neg:
            neg_source = "note"
        elif cmt_neg:
            neg_source = "comment"
        else:
            neg_source = "none"

        # 综合情感（用于列表过滤）：任一负面即负面
        final_sent = "neg" if (note_neg or cmt_neg) else final_note_sent

        # 风险分级
        risk = "无"
        if final_sent == "neg":
            weight = (2 if note_neg else 0) + (2 if cmt_neg else 0) + (1 if shill_hit else 0)
            if weight >= 4 or likes > HIGH_LIKES:
                risk = "高"
            elif weight >= 2 or likes > MID_LIKES:
                risk = "中"
            else:
                risk = "低"

        # 摘要组装
        ex_lines = []
        ex_lines.append(f"【笔记·{SENT_CN[final_note_sent]}】{note_reason}")
        if img_neg:
            ex_lines.append(f"【图片·负面】{'；'.join(img_reasons)}")
        elif img_descs:
            pass
        if cm_total:
            ex_lines.append(f"【评论区·{SENT_CN[comment_sent]}】共{cm_total}条：正面{cm['pos_count']} 负面{cm['neg_count']}"
                            f"（{cm_neg_ratio:.0%}）疑似竞品{cm['shill_count']}条")
        else:
            ex_lines.append("【评论区】无评论")
        if cm["shill_samples"]:
            for s in cm["shill_samples"][:3]:
                ex_lines.append(f"  ⚠ 竞品引导: {s}")
        if cm["typical_neg"]:
            for s in cm["typical_neg"]:
                ex_lines.append(f"  ✎ 负评: {s}")
        ex_lines.append("")
        ex_lines.append(desc[:1500])
        excerpt = "\n".join(ex_lines)[:4000]

        items.append({
            "kw": kw,
            "title": title[:300],
            "author": (n.get("nickname") or "")[:100],
            "sent": final_sent,
            "note_sent": final_note_sent,
            "comment_sent": comment_sent,
            "neg_source": neg_source,
            "shill_count": cm["shill_count"],
            "shill_brands": "、".join(sorted(cm["shill_brands"])),
            "comment_neg_ratio": round(cm_neg_ratio, 3),
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


# ============================================================
# 写入工作台
# ============================================================

DB_FIELDS = {"kw", "title", "author", "sent", "note_sent", "comment_sent", "neg_source",
             "shill_count", "shill_brands", "comment_neg_ratio", "likes", "comments",
             "collects", "risk", "excerpt", "source", "note_url", "published_at"}


def push_to_workbench(items):
    if not items:
        log("没有可写入的数据")
        return
    rows = [{k: v for k, v in it.items() if k in DB_FIELDS} for it in items]
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/notes?source=eq.real", headers=HDRS, timeout=30)
    if r.status_code >= 400:
        log(f"清空旧数据失败 HTTP {r.status_code}: {r.text[:200]}")
        sys.exit(1)
    for i in range(0, len(rows), 50):
        r = requests.post(f"{SUPABASE_URL}/rest/v1/notes", headers=HDRS,
                          json=rows[i:i + 50], timeout=30)
        if r.status_code >= 400:
            log(f"写入失败 HTTP {r.status_code}: {r.text[:300]}")
            sys.exit(1)
    log(f"已写入 {len(rows)} 篇笔记到工作台")


# ============================================================
# 日报（含评论区风险章节）+ IM 推送
# ============================================================

def build_report(items):
    today = datetime.date.today().isoformat()
    neg = [x for x in items if x["sent"] == "neg"]
    note_neg = [x for x in items if x["neg_source"] in ("note", "both")]
    cmt_neg = [x for x in items if x["neg_source"] in ("comment", "both")]
    shill_notes = [x for x in items if x["shill_count"] >= 1]
    shill_total = sum(x["shill_count"] for x in shill_notes)
    shill_brands = sorted({b for x in shill_notes for b in x["shill_brands"].split("、") if b})
    high = [x for x in items if x["risk"] == "高"]

    lines = [f"【小红书舆情日报】{today}（自动采集+AI判定）",
             f"监控笔记 {len(items)} 篇 | 负面 {len(neg)} 篇（笔记本身 {len(note_neg)} / 评论区 {len(cmt_neg)}）| 高风险 {len(high)} 条",
             ""]
    lines.append("一、笔记内容负面 TOP3")
    top = sorted(note_neg, key=lambda x: -x["likes"])[:3]
    for i, t in enumerate(top, 1):
        lines.append(f'{i}. {t["title"]}（赞{t["likes"]} 风险:{t["risk"]}）')
    if not top:
        lines.append("无")
    lines.append("")
    lines.append("二、评论区风险")
    if shill_notes:
        lines.append(f"· 疑似竞品蹭评：{len(shill_notes)} 篇命中 / 共 {shill_total} 条"
                     f"（指向：{'、'.join(shill_brands)}）")
        for x in shill_notes[:5]:
            lines.append(f'  - {x["title"][:25]}（{x["shill_count"]}条）')
    else:
        lines.append("· 无竞品蹭评命中")
    cmt_only = [x for x in cmt_neg if x["neg_source"] == "comment"]
    if cmt_only:
        lines.append(f"· 评论区负面（笔记正常）：{len(cmt_only)} 篇")
        for x in sorted(cmt_only, key=lambda x: -x["comment_neg_ratio"])[:5]:
            lines.append(f'  - {x["title"][:25]}（负面占比 {x["comment_neg_ratio"]:.0%}）')
    lines.append("")
    lines.append("三、处置建议")
    if high:
        lines.append(f"· 高风险 {len(high)} 条，建议 24 小时内响应")
    if shill_notes:
        lines.append("· 竞品蹭评建议：核查评论账号，必要时官方评论引导/举报")
    if not high and not shill_notes:
        lines.append("· 风险可控，保持监测")
    return "\n".join(lines)


def save_report(content, items):
    today = datetime.date.today().isoformat()
    neg = sum(1 for x in items if x["sent"] == "neg")
    summary = f"笔记 {len(items)} 篇 · 负面 {neg} 篇（AI判定）"
    r = requests.post(f"{SUPABASE_URL}/rest/v1/reports?on_conflict=rep_date",
                      headers={**HDRS, "Prefer": "resolution=merge-duplicates"},
                      json=[{"rep_date": today, "content": content, "summary": summary}],
                      timeout=30)
    if r.status_code >= 400:
        log(f"日报写入失败 HTTP {r.status_code}: {r.text[:150]}")
    else:
        log("日报已写入工作台「上报中心」")


def push_report_to_im():
    """从数据库取今日最新日报，推送到工作台设置里配置的 IM Webhook（10:00 定时任务用）"""
    today = datetime.date.today().isoformat()
    r = requests.get(f"{SUPABASE_URL}/rest/v1/reports?rep_date=eq.{today}&select=content",
                     headers=HDRS, timeout=30)
    r.raise_for_status()
    rows = r.json()
    if not rows:
        log("今日无日报，跳过推送")
        return
    text = rows[0]["content"]
    s = requests.get(f"{SUPABASE_URL}/rest/v1/settings?id=eq.1&select=channel,webhook,dingtalk_secret",
                     headers=HDRS, timeout=30)
    s.raise_for_status()
    cfg = (s.json() or [{}])[0]
    channel, webhook = cfg.get("channel", "wecom"), (cfg.get("webhook") or "").strip()
    if not webhook:
        log("未配置 Webhook（工作台→上报设置），跳过推送")
        return
    if channel == "wecom":
        payload = {"msgtype": "markdown", "markdown": {"content": text}}
        url = webhook
    elif channel == "dingtalk":
        payload = {"msgtype": "markdown", "markdown": {"title": "小红书舆情日报", "text": text}}
        url = webhook
        secret = (cfg.get("dingtalk_secret") or "").strip()
        if secret:
            import hashlib, hmac as hmac_mod, base64 as b64, urllib.parse
            ts = str(round(time.time() * 1000))
            sign = b64.b64encode(hmac_mod.new(secret.encode(), f"{ts}\n{secret}".encode(),
                                              hashlib.sha256).digest())
            url += ("&" if "?" in url else "?") + "timestamp=" + ts + "&sign=" + urllib.parse.quote(sign)
    else:
        payload = {"msg_type": "text", "content": {"text": text}}
        url = webhook
    resp = requests.post(url, json=payload, timeout=15)
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    if resp.status_code == 200 and body.get("errcode", 0) == 0 and body.get("ok", True):
        log(f"日报已推送到 IM（{channel}）")
    else:
        log(f"IM 推送失败 HTTP {resp.status_code}: {str(body)[:150]}")


# ============================================================
# main
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-crawl", action="store_true")
    parser.add_argument("--push-only", action="store_true", help="只推送日报到 IM")
    args = parser.parse_args()

    if args.push_only:
        push_report_to_im()
        return

    log("=== 小红书舆情监控 · 一键采集 v3 开始 ===")
    keywords = fetch_keywords()
    if not keywords:
        log("工作台没有启用中的关键词")
        return

    if not args.skip_crawl:
        run_crawl_batches(keywords)

    contents, comments = load_today_data()
    if not contents:
        log("错误：没有采集数据（检查登录态/抓取结果）")
        sys.exit(1)
    log(f"加载采集数据：{len(contents)} 篇笔记 / {sum(len(v) for v in comments.values())} 条评论")

    items = analyze_all(contents, comments, keywords)
    neg = sum(1 for x in items if x["sent"] == "neg")
    shill = sum(1 for x in items if x["shill_count"] >= 1)
    log(f"判定完成：{len(items)} 篇 | 负面 {neg} 篇 | 竞品蹭评命中 {shill} 篇")

    push_to_workbench(items)
    report = build_report(items)
    save_report(report, items)
    log("=== 完成！打开工作台即可查看 ===")


if __name__ == "__main__":
    main()
