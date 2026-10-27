import { copyText } from "../lib";

const OS_PROJECTS = [
  {
    name: "MediaCrawler",
    stars: "57k+ Stars",
    role: "采集核心",
    desc: "多平台自媒体数据采集的事实标准，支持小红书关键词搜索、笔记与二级评论抓取、创作者主页采集；基于 Playwright/CDP 复用登录态、免 JS 逆向，自带 WebUI，数据可存 CSV/JSON/SQLite/MySQL。",
    why: "为什么选它：小红书支持最完整、社区最活跃，一条命令即可按关键词采集，是本工作台数据层的首选开源项目。注意其许可证仅限学习研究、禁止商用。",
    url: "https://github.com/NanmiCoder/MediaCrawler",
  },
  {
    name: "TrendRadar",
    stars: "53k+ Stars",
    role: "调度+推送",
    desc: "AI 驱动的舆情/热点监控框架：关键词精准筛选、AI 简报生成、情感分析，支持 GitHub Actions 免费定时运行（无需服务器），推送企业微信/钉钉/飞书/Telegram，512MB 内存即可跑，GPL-3.0 协议。",
    why: "为什么选它：现成的「每日定时 + 简报 + IM 推送」流水线，正好补齐「每日回传上报」这一环，可直接借用其调度与推送架构。",
    url: "https://github.com/sansan0/TrendRadar",
  },
  {
    name: "Spider_XHS",
    stars: "活跃维护",
    role: "小红书专用",
    desc: "专注小红书的数据采集与内容发布工具，覆盖笔记、评论、私信、直播等能力，并封装了内容发布接口，适合构建 AI 运营智能体。",
    why: "为什么选它：比通用爬虫更聚焦小红书、功能颗粒度更细，可作为 MediaCrawler 的补充或替代。",
    url: "https://github.com/cv-cat/Spider_XHS",
  },
  {
    name: "BettaFish（微舆）",
    stars: "多 Agent",
    role: "智能研判",
    desc: "多智能体舆情分析系统：像聊天一样提出分析需求，Agent 自动完成信息聚合、还原舆情原貌并预测走向，辅助决策。",
    why: "为什么选它：在工作台之上再加一层「AI 分析师」，对每日汇总数据做归因与趋势预测。",
    url: "https://github.com/666ghj/BettaFish",
  },
  {
    name: "思通舆情（yuqing）",
    stars: "开源免费",
    role: "整套系统",
    desc: "Java 系开源舆情系统，支持本地化部署，对海量舆情数据做多维交叉分析与深度挖掘，带完整后台管理。",
    why: "为什么选它：如果不想自己组装流水线，可评估这类整套开源舆情系统直接部署。",
    url: "https://github.com/javabloger/yuqing",
  },
  {
    name: "情感分析：SnowNLP / cnsenti / Senta",
    stars: "Python 生态",
    role: "情感打分",
    desc: "SnowNLP 轻量易上手（sentiments 返回 0~1 情感分）；cnsenti 整合多情感词典与模型；百度 Senta 提供 SKEP 预训练模型、精度更高但依赖 PaddlePaddle。",
    why: "为什么选它：对采集到的笔记/评论做正负面打分，是「负面预警」的核心。快速起步用 SnowNLP，追求精度用 Senta 或直接调用大模型。",
    url: "https://github.com/hidaDeng/cnsenti",
  },
];

const DEPLOY_CMD1 = [
  "# 1. 拉取采集器并安装依赖（Python 3.11+，Node.js >= 16）",
  "git clone https://github.com/NanmiCoder/MediaCrawler",
  "cd MediaCrawler && uv sync && uv run playwright install",
  "",
  "# 2. 在 config/base_config.py 中配置：",
  '#    KEYWORDS = "品牌名,产品名,客服投诉"   # 你的监控关键词',
  "#    ENABLE_GET_COMMENTS = True             # 开启评论采集",
  '#    SAVE_DATA_OPTION = "json"              # 输出 JSON 便于脚本处理',
  "",
  "# 3. 首次运行扫码登录（登录态会缓存复用）",
  "uv run main.py --platform xhs --lt qrcode --type search",
  "",
  "# 4. 安装情感分析依赖",
  "pip install snownlp requests",
].join("\n");

const DEPLOY_CMD2 = [
  "#!/usr/bin/env python3",
  "# daily_monitor.py — 情感分析 + 写入工作台(Supabase) + IM 推送",
  "import json, glob, datetime, requests",
  "from snownlp import SnowNLP",
  "",
  'SUPABASE_URL = "https://xxxx.supabase.co"      # 你的 Supabase Project URL',
  'SUPABASE_KEY = "eyJ..."                       # 你的 anon key（与工作台一致）',
  'WEBHOOK = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key"',
  'DATA_DIR = "MediaCrawler/data/xhs/"           # MediaCrawler 输出目录',
  "NEG_THRESHOLD = 0.4                          # 情感分低于该值判为负面",
  "HIGH_LIKES = 2500                            # 负面且点赞超此值 -> 高风险",
  "",
  "HDRS = {\"apikey\": SUPABASE_KEY,",
  '         "Authorization": "Bearer " + SUPABASE_KEY,',
  '         "Content-Type": "application/json"}',
  "",
  "def load_notes():",
  "    files = sorted(glob.glob(DATA_DIR + \"*.json\"))",
  "    notes = []",
  "    for f in files[-1:]:                     # 取最新一批",
  "        with open(f, encoding=\"utf-8\") as fp:",
  "            for line in fp:",
  "                line = line.strip()",
  "                if line:",
  "                    notes.append(json.loads(line))",
  "    return notes",
  "",
  "def analyze(notes):",
  "    result = []",
  "    for n in notes:",
  "        title = n.get(\"title\", \"\") or n.get(\"desc\", \"\")[:50]",
  "        score = SnowNLP(title).sentiments     # 0~1，越低越负面",
  "        sent = \"neg\" if score < NEG_THRESHOLD else (\"pos\" if score > 0.6 else \"neu\")",
  "        likes = int(n.get(\"liked_count\", 0) or 0)",
  "        risk = \"高\" if (sent == \"neg\" and likes > HIGH_LIKES) else (\"中\" if sent == \"neg\" else \"无\")",
  "        result.append({\"kw\": n.get(\"source_keyword\", \"\"), \"title\": title,",
  '                       "author": n.get("nickname", ""), "sent": sent,',
  '                       "likes": likes, "comments": int(n.get("total_comment_num", 0) or 0),',
  '                       "collects": int(n.get("collected_count", 0) or 0), "risk": risk,',
  '                       "excerpt": (n.get("desc", "") or "")[:500],',
  '                       "published_at": n.get("time", "") or n.get("publish_time", ""),',
  '                       "source": "real"})',
  "    return result",
  "",
  "def push_to_workbench(items):",
  "    # 写入工作台数据库：先清空上一批真实笔记，再整批插入",
  "    requests.delete(SUPABASE_URL + \"/rest/v1/notes?source=eq.real\",",
  "                    headers=HDRS, timeout=15)",
  "    for i in range(0, len(items), 100):       # 分批插入",
  "        requests.post(SUPABASE_URL + \"/rest/v1/notes\", headers=HDRS,",
  "                      json=items[i:i+100], timeout=15)",
  "",
  "def push_to_im(text):",
  "    # 企业微信机器人格式；钉钉/飞书仅需改 payload 结构",
  "    # 也可以不在脚本里推，直接用工作台「上报中心」的推送按钮",
  "    requests.post(WEBHOOK, json={\"msgtype\": \"markdown\",",
  "        \"markdown\": {\"content\": text}}, timeout=10)",
  "",
  'if __name__ == "__main__":',
  "    items = analyze(load_notes())",
  "    today = datetime.date.today().isoformat()",
  "    neg = [x for x in items if x[\"sent\"] == \"neg\"]",
  "    high = [x for x in items if x[\"risk\"] == \"高\"]",
  "    lines = [f\"【小红书舆情日报】{today}\",",
  "             f\"监控笔记 {len(items)} 篇 | 负面 {len(neg)} 篇 | 高风险 {len(high)} 条\", \"\"]",
  "    for i, t in enumerate(sorted(neg, key=lambda x: -x[\"likes\"])[:3], 1):",
  "        lines.append(f'{i}. {t[\"title\"]}（赞 {t[\"likes\"]} | 风险 {t[\"risk\"]}）')",
  "    if high:",
  "        lines.append(f'⚠️ 高风险 {len(high)} 条，请 24 小时内响应')",
  "    push_to_workbench(items)                  # 先写工作台数据库",
  "    push_to_im(\"\\n\".join(lines))            # 再推 IM 群",
].join("\n");

const DEPLOY_CMD3 = [
  "# crontab -e 添加以下行：每天 08:00 采集，08:40 分析并推送",
  "0 8 * * * cd /path/to/MediaCrawler && uv run main.py --platform xhs --lt cookie --type search >> /var/log/xhs_crawl.log 2>&1",
  "40 8 * * * cd /path/to && python3 daily_monitor.py >> /var/log/xhs_report.log 2>&1",
  "",
  "# 无服务器方案：Fork TrendRadar 仓库，用 GitHub Actions 免费定时运行，",
  "# 在 config.yaml 配置关键词与推送渠道即可获得同类每日简报能力",
].join("\n");

function CopyBtn({ target }: { target: string }) {
  return (
    <button
      className="btn btn-ghost btn-sm copy-cmd"
      onClick={async () => {
        const el = document.getElementById(target);
        if (el && (await copyText(el.textContent ?? ""))) {
          window.dispatchEvent(new CustomEvent("app-toast", { detail: "代码已复制到剪贴板" }));
        }
      }}
    >
      复制
    </button>
  );
}

export function Opensource() {
  return (
    <section>
      <div className="card">
        <h3>推荐落地架构（基于成熟开源项目组装）</h3>
        <div className="arch">
          {[
            ["数据采集层 · MediaCrawler / Spider_XHS", "按关键词每日定时抓取小红书笔记与评论，落库 CSV/JSON/SQLite/MySQL"],
            ["情感分析层 · SnowNLP / cnsenti / 百度 Senta", "对笔记与评论做正负面情感打分，识别负面预警内容"],
            ["调度与聚合层 · cron / GitHub Actions", "每日固定时间跑「采集 → 分析 → 汇总」流水线；TrendRadar 提供现成的定时 + 推送框架可直接借用"],
            ["展示与上报层 · 本工作台（在线版）", "看板呈现 + 生成每日上报文本，通过 Webhook 推送到企业微信/钉钉/飞书"],
          ].map(([t, s], i) => (
            <div className="arch-step" key={i}>
              <div className="arch-line">
                <div className="arch-dot">{i + 1}</div>
                <div className="arch-v" />
              </div>
              <div className="arch-bd">
                <div className="t">{t}</div>
                <div className="s">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="os-grid mt">
        {OS_PROJECTS.map((p) => (
          <div className="os-card" key={p.name}>
            <h4>
              <span>{p.name}</span>
              <span className="stars">{p.stars}</span>
              <span className="role">{p.role}</span>
            </h4>
            <p>{p.desc}</p>
            <div className="why">{p.why}</div>
            <a href={p.url} target="_blank" rel="noopener">
              {p.url}
            </a>
          </div>
        ))}
      </div>
      <div className="notice mt">
        <b>合规提醒</b>
        MediaCrawler 等项目仅限学习研究用途、禁止商用；采集需遵守小红书用户协议及《个人信息保护法》，控制频率、不抓取个人隐私数据。商业场景建议评估官方开放能力或采购合规数据服务。
      </div>
    </section>
  );
}

export function Deploy() {
  return (
    <section>
      <div className="card">
        <h3>真实数据接入：每日自动监控 + 上报脚本</h3>
        <p style={{ fontSize: 13, color: "#4b505c" }}>
          以下是一套可直接落地的最小方案：MediaCrawler 负责采集，SnowNLP 负责情感打分，脚本汇总后「写入本工作台 + 推送群机器人」，用
          crontab 实现每日自动运行。三段代码均可一键复制。
        </p>
        <div className="cmd-hd">
          <b>① 环境准备</b>
          <CopyBtn target="cmd1" />
        </div>
        <div className="cmd" id="cmd1">{DEPLOY_CMD1}</div>
        <div className="cmd-hd">
          <b>② daily_monitor.py（情感分析 + 写入工作台 + IM 推送）</b>
          <CopyBtn target="cmd2" />
        </div>
        <div className="cmd" id="cmd2">{DEPLOY_CMD2}</div>
        <div className="cmd-hd">
          <b>③ crontab 每日定时（早 8 点采集并推送）</b>
          <CopyBtn target="cmd3" />
        </div>
        <div className="cmd" id="cmd3">{DEPLOY_CMD3}</div>
        <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 10 }}>
          说明：脚本 push_to_workbench() 通过 Supabase REST API 整体替换真实笔记
          （表 notes 中 source=real 的记录），同事打开工作台即刻看到最新采集数据；
          若需更高精度的情感判断，可把 SnowNLP 替换为百度 Senta（SKEP）或直接调用大模型 API。
          页面更新只需 git push，GitHub Actions 会自动重新构建发布。
        </p>
      </div>
      <div className="card mt">
        <h3>与本工作台的衔接</h3>
        <div className="arch">
          {[
            ["脚本产出分析结果并写入 Supabase notes 表", "把每篇笔记的标题、作者、互动数、情感、风险级写入共享数据库（每天整体替换 source=real 的记录）"],
            ["看板自动切换为真实数据", "工作台检测到真实笔记后，顶部标识变为「真实采集」，总览/列表/预警全部基于真实数据"],
            ["上报自动化", "脚本可同时推 IM 群；本页「上报中心」留作人工复核与补报入口，处理状态团队共享"],
          ].map(([t, s], i) => (
            <div className="arch-step" key={i}>
              <div className="arch-line">
                <div className="arch-dot">{i + 1}</div>
                <div className="arch-v" />
              </div>
              <div className="arch-bd">
                <div className="t">{t}</div>
                <div className="s">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
