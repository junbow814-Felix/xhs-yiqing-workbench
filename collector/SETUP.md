# 采集环境安装指引（macOS 版）

> 目标：在你的 Mac 上装好采集环境，之后 **双击/一条命令= 随时抓最新舆情**，**每天 8 点自动抓**。
> 全程只需要：装 2 个工具 + 扫 1 次码。每一步都有"怎么确认成功了"。

## 第 0 步：把 collector 文件夹放到 Mac 上

打开终端（聚焦搜索 `终端` / `Terminal`，或 应用程序→实用工具→终端），执行：

```bash
# 建个目录并下载（二选一：git 或 网页下载 ZIP）
mkdir -p ~/xhs-monitor && cd ~/xhs-monitor
git clone https://github.com/junbow814-Felix/xhs-yiqing-workbench.git
cd xhs-yiqing-workbench/collector
```

（如果没装 git，用网页方式：浏览器打开仓库 → Code → Download ZIP → 解压后把 `collector` 文件夹拖到 `~/xhs-monitor/` 下）

## 第 1 步：安装基础工具（5 分钟）

在终端逐条执行（遇到要密码就输开机密码，遇到要确认就回车）：

```bash
# 安装 Homebrew（Mac 的软件管家，已有就跳过）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 python 和 git
brew install python git
```

**确认成功**：

```bash
python3 --version    # 应显示 Python 3.9 以上
git --version        # 应显示 git version 2.x
```

## 第 2 步：一键配置（10 分钟）

```bash
cd ~/xhs-monitor/xhs-yiqing-workbench/collector   # 或你解压的 collector 目录
bash setup-mac.sh
```

脚本会自动：
1. 安装 Python 依赖（requests、snownlp 情感分析库）
2. 校验内置的数据库密钥（已配好，无需你操作）
3. 下载 MediaCrawler 爬虫到同目录并装依赖、装浏览器内核
4. 运行环境自检

**确认成功**：最后自检显示 `[OK] Python`、`[OK] requests`、`[OK] snownlp`、`[OK] MediaCrawler`、`[OK] 工作台数据库连接正常`。登录态显示 `[提示]` 是正常的，下一步才扫码。

## 第 3 步：首次采集 + 扫码登录（3 分钟）

```bash
python3 monitor.py
```

1. 会弹出浏览器窗口显示小红书登录二维码
2. 用**手机小红书 App 扫码**登录（和平时扫网页登录一样）
3. 之后全自动：读取工作台里的关键词（如"海尔美容仪"）→ 抓取小红书 → SnowNLP 情感分析 → 写入工作台数据库 → 自动生成日报

**确认成功**：终端最后显示 `=== 完成！打开工作台即可查看最新舆情 ===`。
打开 https://junbow814-felix.github.io/xhs-yiqing-workbench/ 点「↻ 立即同步」→
顶部绿色「真实采集 · N 篇」，笔记是真实小红书内容。**登录态自动缓存，以后不用再扫**。

## 第 4 步（可选）：每天自动采集

```bash
bash install-cron-mac.sh
```

装好后每天 08:00 自动采集（Mac 开机状态即可）。查看/删除：

```bash
crontab -l                            # 查看
crontab -r                            # 删除全部定时任务（慎用）
```

## 日常使用速查

| 想做什么 | 命令 |
|---|---|
| 临时看最新舆情 | `python3 monitor.py`，跑完打开工作台点「↻ 立即同步」 |
| 增删监控关键词 | 在工作台网页上直接加/删，下次采集自动生效 |
| 环境自检 | `python3 setup_check.py` |
| 看采集日志 | `cat monitor.log` |

## 常见问题

**Q：扫码后报错 / 抓不到数据？**
A：小红书风控偶尔变严。重跑 `python3 monitor.py`；持续失败时删除 `MediaCrawler/browser_data` 目录后重新扫码。

**Q：`brew` 下载很慢或失败？**
A：网络问题，可换手机热点，或使用国内镜像（终端执行 `export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"` 后重试）。

**Q：弹出"无法验证开发者"？**
A：系统设置 → 隐私与安全性 → 点「仍要打开」；或终端执行 `sudo spctl --masterdisable` 后再运行。

**Q：合规提醒**
A：仅供内部舆情监控学习研究，控制采集频率（每天 1 次足够），不抓取用户个人信息，遵守小红书用户协议。

---

## Windows 用户

请看仓库 `collector/` 下 Windows 版脚本（一键配置.bat / 立即采集.bat / 安装定时任务.bat）。
