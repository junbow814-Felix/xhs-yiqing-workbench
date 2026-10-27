# 小红书舆情监控工作台（在线协作版）

团队共享的小红书舆情监控工作台：关键词监控、负面预警流转、每日舆情日报、IM 群推送。
页面托管在 **GitHub Pages**（免费），数据存放在 **Supabase** 免费数据库（团队全员实时共享）。

## 功能

- **舆情总览**：统计卡 / 7 日趋势 / 情感分布 / 关键词管理（团队共享）/ 热度榜
- **笔记列表**：筛选排序 / 详情抽屉 / CSV 导出
- **预警中心**：待处理 → 处理中 → 已闭环，状态全团队同步
- **上报中心**：生成日报 / 复制下载 / 真实推送到企业微信·钉钉·飞书群机器人 / 历史记录
- **开源方案 / 部署方案**：MediaCrawler + SnowNLP 采集链路指引
- 笔记数据为演示数据；接入采集脚本后自动切换为「真实采集」

## 部署步骤（约 10 分钟）

### 1. 创建 Supabase 项目

1. 注册/登录 [supabase.com](https://supabase.com)（可用 GitHub 账号登录，免费版即可）
2. New project → 区域选 Singapore/Tokyo → 设置数据库密码
3. 左侧 **SQL Editor** → 粘贴 `supabase/schema.sql` 全部内容 → **Run**（建成 5 张共享表 + 初始关键词）

### 2. 创建 GitHub 仓库并推送代码

1. 在 GitHub 新建一个**公开**仓库（如 `xhs-yq-workbench`）
2. 把本目录全部内容推上去：

```bash
git init
git add .
git commit -m "init: 舆情监控工作台在线协作版"
git remote add origin https://github.com/<你的用户名>/xhs-yq-workbench.git
git push -u origin main
```

### 3. （推荐）把 Supabase 配置写进代码

编辑 `src/config.ts`，填入 Project Settings → API 页的 **Project URL** 和 **anon key**，
提交推送。这样同事打开网页即可直接使用；不改代码也可以，每人首次打开时在
「初始化配置」界面粘贴一次（保存在各自浏览器）。

> anon key 本身就是面向前端的公开密钥，且本工作台定位公开访问、数据全共享；
> 表级安全由 schema.sql 中的 RLS 策略控制。请勿把 service_role key 放进前端。

### 4. 开启 GitHub Pages

仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
推送后 `.github/workflows/deploy.yml` 会自动构建发布，网址为
`https://<你的用户名>.github.io/xhs-yq-workbench/`，发给同事即可。

### 5. 配置 IM 推送（真实推送）

工作台「上报中心 → 上报设置」里保存群机器人 Webhook（团队共享）：

| 渠道 | Webhook 获取方式 | 备注 |
|---|---|---|
| 企业微信 | 群设置 → 群机器人 → 添加 → 复制 Webhook | 浏览器直推 |
| 钉钉 | 群设置 → 智能群助手 → 添加自定义机器人 | 安全设置选「自定义关键词」填 `舆情`，或「加签」并把 Secret 填到页面设置里 |
| 飞书 | 群设置 → 群机器人 → 添加自定义机器人 | 浏览器直推 |

若某渠道浏览器直推被 CORS 拦截，改用仓库自带的 `.github/workflows/daily-push.yml`
每日定时推送：在仓库 Settings → Secrets and variables → Actions 配置
`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`WEBHOOK_URL`、`CHANNEL`（及可选 `DINGTALK_SECRET`），
每天北京时间 09:00 自动把最新日报推到群里（也可在 Actions 页手动触发）。

## 接入真实采集数据（可选，后续升级）

按工作台「部署方案」页的三段代码部署 MediaCrawler + SnowNLP + crontab：
采集脚本每天把分析结果写入 Supabase `notes` 表，工作台自动切换为真实数据，
顶部标识变为「真实采集」。页面代码更新只需 `git push`，GitHub Actions 自动重新发布。

## 技术栈

React 18 + TypeScript + Vite + @supabase/supabase-js，纯静态构建，无服务端。
