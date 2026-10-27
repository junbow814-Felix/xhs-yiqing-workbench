#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""setup_check.py — 环境自检：确认依赖、MediaCrawler、登录态、数据库连通性"""
import os
import sys

print("=" * 50)
print(" 小红书舆情采集 · 环境自检")
print("=" * 50)

ok = True

# 1. Python 版本
v = sys.version_info
if v >= (3, 9):
    print(f"[OK] Python {v.major}.{v.minor}.{v.micro}")
else:
    print(f"[FAIL] Python 版本过低（{v.major}.{v.minor}），需要 3.9+")
    ok = False

# 2. 依赖
for mod, name in [("requests", "requests"), ("snownlp", "snownlp")]:
    try:
        __import__(mod)
        print(f"[OK] {name} 已安装")
    except ImportError:
        print(f"[FAIL] 缺少 {name} → 运行: pip install {name}")
        ok = False

# 3. MediaCrawler 目录
mc = os.environ.get("MEDIA_CRAWLER_DIR", "MediaCrawler")
if os.path.exists(os.path.join(mc, "main.py")):
    print(f"[OK] MediaCrawler 目录存在: {mc}/main.py")
else:
    print(f"[FAIL] 找不到 {mc}/main.py → 请按 SETUP.md 第 2 步安装 MediaCrawler")
    ok = False

# 4. Supabase 连通
url = os.environ.get("SUPABASE_URL", "https://tqczpfzzlgtkrttndxlf.supabase.co")
key = os.environ.get("SUPABASE_ANON_KEY", "")
if not key:
    # 从 monitor.py 同目录的 key.txt 读（setup.bat 会生成）
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.txt")
    if os.path.exists(p):
        key = open(p).read().strip()
if key:
    try:
        import requests
        r = requests.get(
            f"{url}/rest/v1/keywords?select=id&limit=1",
            headers={"apikey": key, "Authorization": "Bearer " + key},
            timeout=15,
        )
        if r.status_code == 200:
            print("[OK] 工作台数据库连接正常（Supabase）")
        else:
            print(f"[FAIL] 数据库连接失败 HTTP {r.status_code} → 检查 key.txt")
            ok = False
    except Exception as e:
        print(f"[FAIL] 数据库网络错误: {e}")
        ok = False
else:
    print("[FAIL] 没有 SUPABASE_ANON_KEY → 运行 setup.bat 自动生成 key.txt")
    ok = False

# 5. 小红书登录态（MediaCrawler 的浏览器数据目录）
login_dir = os.path.join(mc, "browser_data")
if os.path.exists(login_dir) and os.listdir(login_dir):
    print(f"[OK] 已有浏览器登录数据（首次采集后生成）: {login_dir}")
else:
    print(f"[提示] 尚无小红书登录态 → 首次运行「立即采集.bat」时会弹出扫码，扫一次即可")

print("=" * 50)
print("自检完成" + ("，全部就绪！可双击「立即采集.bat」开始首次采集" if ok else "，请先解决上面的 [FAIL] 项"))
