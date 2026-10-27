import { useState } from "react";
import type { Keyword, Note, Report } from "../types";
import { PieChart, TrendChart } from "./Charts";

export function Overview({
  keywords,
  notes,
  reports,
  alertTodo,
  onAddKw,
  onToggleKw,
  onDeleteKw,
  busy,
}: {
  keywords: Keyword[];
  notes: Note[];
  reports: Report[];
  alertTodo: number;
  onAddKw: (name: string) => void;
  onToggleKw: (k: Keyword) => void;
  onDeleteKw: (k: Keyword) => void;
  busy: boolean;
}) {
  const [input, setInput] = useState("");
  const total = notes.length;
  const neg = notes.filter((n) => n.sent === "neg").length;
  const negPct = total ? Math.round((neg / total) * 100) : 0;
  const highRisk = notes.filter((n) => n.risk === "高").length;

  const kwCount: Record<string, number> = {};
  notes.forEach((n) => (kwCount[n.kw] = (kwCount[n.kw] ?? 0) + 1));
  const rank = Object.entries(kwCount)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);

  const submit = () => {
    const v = input.trim();
    if (!v) return;
    onAddKw(v);
    setInput("");
  };

  return (
    <section>
      <div className="grid g4">
        <div className="card stat">
          <div className="k">今日监控笔记</div>
          <div className="v">{total} 篇</div>
          <div className="d flat">数据来源见顶部标识</div>
        </div>
        <div className="card stat">
          <div className="k">负面占比</div>
          <div className="v">{negPct}%</div>
          <div className={"d " + (negPct > 25 ? "up" : "flat")}>{neg} 篇负面</div>
        </div>
        <div className="card stat">
          <div className="k">高风险预警</div>
          <div className="v">{highRisk} 条</div>
          <div className={"d " + (highRisk ? "up" : "down")}>
            风险待处理 {alertTodo} 条
          </div>
        </div>
        <div className="card stat">
          <div className="k">累计上报</div>
          <div className="v">{reports.length} 份</div>
          <div className="d flat">上报中心可查记录</div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h3>
            近 7 日声量与负面趋势 <span className="tag">提及量 / 负面量</span>
          </h3>
          <TrendChart />
          <div className="legend">
            <span><i style={{ background: "#ff2442" }} />提及量</span>
            <span><i style={{ background: "#7c8291" }} />负面量</span>
          </div>
        </div>
        <div className="card">
          <h3>今日情感分布</h3>
          <PieChart notes={notes} />
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h3>
            监控关键词 <span className="tag">团队共享</span>
          </h3>
          <div className="kw-row">
            <input
              type="text"
              placeholder="输入关键词，如：品牌名 / 产品名"
              maxLength={20}
              aria-label="新关键词"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              添加
            </button>
          </div>
          <div className="kw-list">
            {keywords.length === 0 && (
              <div className="empty">还没有关键词，先添加一个吧</div>
            )}
            {keywords.map((k) => (
              <span key={k.id} className={"kw" + (k.enabled ? "" : " off")}>
                <span>{k.name}</span>
                <button
                  title={k.enabled ? "暂停监控" : "开启监控"}
                  aria-label={(k.enabled ? "暂停" : "开启") + "关键词" + k.name}
                  onClick={() => onToggleKw(k)}
                  disabled={busy}
                >
                  {k.enabled ? "停" : "启"}
                </button>
                <button
                  title="删除关键词"
                  aria-label={"删除关键词" + k.name}
                  onClick={() => onDeleteKw(k)}
                  disabled={busy}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>
            关键词热度榜 <span className="tag">今日提及</span>
          </h3>
          <div className="rank">
            {rank.length === 0 && <div className="empty">开启关键词后展示热度</div>}
            {rank.map((it, i) => (
              <div className="rank-item" key={it.k}>
                <span className={"rank-no" + (i < 3 ? " top" : "")}>{i + 1}</span>
                <span className="rank-name">{it.k}</span>
                <div className="rank-bar">
                  <i style={{ width: Math.round((it.v / rank[0].v) * 100) + "%" }} />
                </div>
                <span className="rank-v">{it.v} 篇</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
