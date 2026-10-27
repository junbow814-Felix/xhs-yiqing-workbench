import { useEffect, useState } from "react";
import type { Note, Report, Settings } from "../types";
import { sentName, todayStr } from "../lib";

export function buildReportText(
  notes: Note[],
  keywords: Array<{ name: string; enabled: boolean }>,
  alerts: Record<string, string>,
): string {
  const ds = todayStr();
  const total = notes.length;
  const neg = notes.filter((n) => n.sent === "neg");
  const high = notes.filter((n) => n.risk === "高");
  const todo = high.filter((n) => (alerts[n.key] ?? "待处理") !== "已闭环").length;
  const kws = keywords.filter((k) => k.enabled).map((k) => k.name);
  const lines: string[] = [];
  lines.push(`【小红书舆情日报】${ds}`);
  lines.push(`监控关键词：${kws.join("、") || "（未设置）"}`);
  lines.push("");
  lines.push("一、总体概况");
  lines.push(`· 今日监控笔记 ${total} 篇，其中负面 ${neg.length} 篇（占比 ${total ? Math.round((neg.length / total) * 100) : 0}%）`);
  lines.push(`· 高风险预警 ${high.length} 条，其中未闭环 ${todo} 条${todo ? "，建议 24 小时内响应" : "，风险已受控"}`);
  lines.push("");
  lines.push("二、负面 TOP3 笔记");
  const top = [...neg].sort((a, b) => b.likes - a.likes).slice(0, 3);
  if (top.length) {
    top.forEach((n, i) =>
      lines.push(`${i + 1}. ${n.title}（${n.kw} | 赞 ${n.likes} / 评 ${n.comments} | 风险:${n.risk} | 状态:${alerts[n.key] ?? "待处理"}）`),
    );
  } else {
    lines.push("今日无显著负面笔记");
  }
  lines.push("");
  lines.push("三、处置建议");
  lines.push(todo ? "· 未闭环高风险笔记建议优先联系发布人、准备官方回应口径" : "· 保持日常监测频率，关注声量波动");
  const real = notes.some((n) => n.source === "real");
  lines.push(real ? "· 数据来自采集链路自动汇总" : "· 本报告基于演示数据生成，接入采集链路后为真实数据");
  return lines.join("\n");
}

export function Report({
  notes,
  keywords,
  alerts,
  reports,
  settings,
  current,
  onGenerate,
  onSaveSettings,
  onPush,
  onCopy,
  busy,
}: {
  notes: Note[];
  keywords: Array<{ name: string; enabled: boolean }>;
  alerts: Record<string, string>;
  reports: Report[];
  settings: Settings;
  current: Report | null;
  onGenerate: (text: string) => void;
  onSaveSettings: (s: Settings) => void;
  onPush: (text: string) => void;
  onCopy: (text: string) => void;
  busy: boolean;
}) {
  const [time, setTime] = useState(settings.report_time);
  const [channel, setChannel] = useState(settings.channel);
  const [webhook, setWebhook] = useState(settings.webhook);
  const [secret, setSecret] = useState(settings.dingtalk_secret ?? "");

  useEffect(() => {
    setTime(settings.report_time);
    setChannel(settings.channel);
    setWebhook(settings.webhook);
    setSecret(settings.dingtalk_secret ?? "");
  }, [settings]);

  const download = (r: Report) => {
    const blob = new Blob([r.content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `舆情日报-${r.rep_date}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 300);
  };

  const total = notes.length;
  const neg = notes.filter((n) => n.sent === "neg").length;

  return (
    <section>
      <div className="card">
        <h3>每日舆情上报</h3>
        <div className="report-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => onGenerate(buildReportText(notes, keywords, alerts))}>
            生成今日上报
          </button>
          {current && (
            <>
              <button className="btn btn-ghost" onClick={() => onCopy(current.content)}>复制上报文本</button>
              <button className="btn btn-ghost" onClick={() => download(current)}>下载 .txt</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => onPush(current.content)}>
                推送到 IM
              </button>
            </>
          )}
        </div>
        {current ? (
          <div className="report-preview">{current.content}</div>
        ) : (
          <div className="empty">
            尚未生成今日上报。点击「生成今日上报」自动汇总关键词声量、负面预警与代表笔记。
          </div>
        )}
      </div>

      <div className="card mt">
        <h3>
          上报设置 <span className="tag">团队共享 · 推送为真实发送</span>
        </h3>
        <div className="setting-row">
          <label htmlFor="setTime">每日上报时间</label>
          <input id="setTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="setting-row">
          <label htmlFor="setChannel">推送渠道</label>
          <select id="setChannel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="wecom">企业微信群机器人</option>
            <option value="dingtalk">钉钉群机器人</option>
            <option value="feishu">飞书群机器人</option>
            <option value="email">邮件（未实现）</option>
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="setWebhook">Webhook 地址</label>
          <input
            id="setWebhook"
            type="text"
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="setSecret">钉钉加签 Secret</label>
          <input
            id="setSecret"
            type="text"
            placeholder="仅钉钉机器人启用「加签」安全设置时需要填写，其余渠道留空"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => onSaveSettings({ report_time: time, channel, webhook, dingtalk_secret: secret })}
          >
            保存设置
          </button>
          <span style={{ fontSize: 12, color: "var(--sub)" }}>
            配置保存后全员生效，「推送到 IM」由浏览器直连群机器人真实发送。
          </span>
        </div>
      </div>

      <div className="card mt">
        <h3>
          历史上报记录 <span className="tag">团队共享</span>
        </h3>
        <div className="hist">
          {reports.map((r) => (
            <div className="hist-item" key={r.id}>
              <div>
                <div className="t">{r.rep_date} 舆情日报</div>
                <div className="s">{r.summary}</div>
              </div>
              <span className="hist-st st-done2">已上报</span>
              <a
                className="hist-act"
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(r.content)}`}
                download={`舆情日报-${r.rep_date}.txt`}
                onClick={(e) => {
                  e.preventDefault();
                  download(r);
                }}
              >
                下载
              </a>
            </div>
          ))}
        </div>
        {reports.length === 0 && <div className="empty">暂无历史上报记录</div>}
        <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>
          当前汇总：笔记 {total} 篇 · 负面 {neg} 篇（{sentName("neg")}）
        </div>
      </div>
    </section>
  );
}
