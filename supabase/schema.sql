-- 小红书舆情监控工作台 · 共享数据库建表脚本
-- 用法：登录 supabase.com → 打开你的项目 → 左侧 SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：重复执行安全，不会破坏已有数据。

-- ---------- 关键词 ----------
create table if not exists public.keywords (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.keywords enable row level security;
drop policy if exists "anon full access keywords" on public.keywords;
create policy "anon full access keywords" on public.keywords
  for all to anon, authenticated using (true) with check (true);

-- ---------- 预警处理状态（note_key: 演示 m<id> / 真实 r<id>）----------
create table if not exists public.alert_status (
  note_key   text primary key,
  status     text not null default '待处理',
  updated_at timestamptz not null default now()
);
alter table public.alert_status enable row level security;
drop policy if exists "anon full access alert_status" on public.alert_status;
create policy "anon full access alert_status" on public.alert_status
  for all to anon, authenticated using (true) with check (true);

-- ---------- 每日上报记录 ----------
create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  rep_date   date not null unique,
  content    text not null,
  summary    text not null default '',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "anon full access reports" on public.reports;
create policy "anon full access reports" on public.reports
  for all to anon, authenticated using (true) with check (true);

-- ---------- 上报设置（单行，id=1）----------
create table if not exists public.settings (
  id               int primary key default 1,
  report_time      text not null default '09:00',
  channel          text not null default 'wecom',
  webhook          text not null default '',
  dingtalk_secret  text not null default '',
  updated_at       timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "anon full access settings" on public.settings;
create policy "anon full access settings" on public.settings
  for all to anon, authenticated using (true) with check (true);

-- ---------- 真实采集笔记（采集脚本每天整体替换）----------
create table if not exists public.notes (
  id            bigint generated always as identity primary key,
  kw            text not null default '未分类',
  title         text not null,
  author        text not null default '',
  sent          text not null default 'neu',
  likes         int not null default 0,
  comments      int not null default 0,
  collects      int not null default 0,
  risk          text not null default '无',
  excerpt       text not null default '',
  source        text not null default 'real',
  note_url      text not null default '',
  published_at  timestamptz not null default now()
);
alter table public.notes enable row level security;
drop policy if exists "anon full access notes" on public.notes;
create policy "anon full access notes" on public.notes
  for all to anon, authenticated using (true) with check (true);

-- ---------- 初始数据（仅首次插入）----------
insert into public.keywords (name, enabled) values
  ('品牌口碑', true),
  ('新品面霜', true),
  ('客服投诉', true),
  ('竞品对比', false)
on conflict (name) do nothing;

insert into public.settings (id, report_time, channel, webhook)
values (1, '09:00', 'wecom', '')
on conflict (id) do nothing;
