#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_key.py — 把 Supabase 连接密钥写入 key.txt（部署时注入真实值）"""
import os

SUPABASE_URL = "https://tqczpfzzlgtkrttndxlf.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY3pwZnp6bGd0a3J0dG5keGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTUxMDEsImV4cCI6MjEwODY3MTEwMX0.9uA6lKFGlma0LZRRQyfC9iLLRXKoMjaZMMcWkT8wuL0"


def write_key():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "key.txt"), "w", encoding="utf-8") as f:
        f.write(SUPABASE_ANON_KEY)
    # 同时更新 monitor.py 的配置区
    mp = os.path.join(here, "monitor.py")
    if os.path.exists(mp):
        with open(mp, "r", encoding="utf-8") as f:
            c = f.read()
        c = c.replace('SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tqczpfzzlgtkrttndxlf.supabase.co")',
                      f'SUPABASE_URL = os.environ.get("SUPABASE_URL", "{SUPABASE_URL}")')
        c = c.replace('SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")',
                      f'SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "{SUPABASE_ANON_KEY}")')
        with open(mp, "w", encoding="utf-8") as f:
            f.write(c)
    print("key.txt 已生成，monitor.py 配置已更新")


if __name__ == "__main__":
    write_key()
