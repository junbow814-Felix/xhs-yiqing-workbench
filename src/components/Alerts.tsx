import { useState } from "react";
import type { Keyword, ManualNote, Note } from "../types";
import { AlertLine, NoteTags } from "./ui";

export function Alerts({
  notes,
  keywords,
  manualNotes,
  alerts,
  onSetStatus,
  onOpenNote,
  onAddManual,
  onSetManualStatus,
  onDeleteManual,
  busy,
}: {
  notes: Note[];
  keywords: Keyword[];
  manualNotes: ManualNote[];
  alerts: Record<string, string>;
  onSetStatus: (key: string, status: string) => void;
  onOpenNote: (n: Note) => void;
  onAddManual: (input: { url: string; kw: string; title: string; note_desc: string; reporter: string; neg_type: string }) => void;
  onSetManualStatus: (id: number, status: string) => void;
  onDeleteManual: (id: number) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [kwFilter, setKwFilter] = useState("all");
  const [negFilter, setNegFilter] = useState("all"); // all/note/comment
  const [showForm, setShowForm] = useState(false);

  const st = (key: string) => alerts[key] ?? "待处理";

  const autoList = notes
    .filter((n) => n.risk !== "无" || n.sent === "neg")
    .filter((n) => filter === "all" || st(n.key) === filter)
    .filter((n) => kwFilter === "all" || n.kw === kwFilter)
    .filter((n) => {
      if (negFilter === "all") return true;
      if (negFilter === "note") return n.negSource === "note" || n.negSource === "both";
      if (negFilter === "comment") return n.negSource === "comment" || n.negSource === "both";
      return true;
    })
    .sort((a, b) => {
      const w: Record<string, number> = { 高: 2, 中: 1, 低: 0 };
      return (w[b.risk] - w[a.risk]) || (b.likes - a.likes);
    });

  const manualList = manualNotes
    .filter((m) => filter === "all" || m.status === filter)
    .filter((m) => kwFilter === "all" || m.kw === kwFilter)
    .filter((m) => negFilter === "all" || m.neg_type === negFilter);

  return (
    <section>
      {/* 手动上报 */}
      <div className="card">
        <h3>
          手动上报负面笔记 <span className="tag">团队共享</span>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowForm(!showForm)}>
            {showForm ? "收起" : "+ 上报链接"}
          </button>
        </h3>
        {showForm && <ManualForm keywords={keywords} onSubmit={onAddManual} busy={busy} />}
        <div className="setting-row" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 12, color: "var(--sub)" }}>
            在小红书刷到负面笔记但还没被自动采集覆盖？粘贴链接登记进来，团队一起跟进处理。
          </span>
        </div>
      </div>

      <div className="card mt">
        <h3>
          风险预警 <span className="tag">处理状态团队共享 · 自动 {autoList.length} 条 / 人工 {manualList.length} 条</span>
        </h3>
        <div className="filters">
          <select aria-label="按预警状态筛选" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">全部状态</option>
            <option value="待处理">待处理</option>
            <option value="处理中">处理中</option>
            <option value="已闭环">已闭环</option>
          </select>
          <select aria-label="按关键词筛选" value={kwFilter} onChange={(e) => setKwFilter(e.target.value)}>
            <option value="all">全部关键词</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.name}>{k.name}</option>
            ))}
          </select>
          <select aria-label="按负面类型筛选" value={negFilter} onChange={(e) => setNegFilter(e.target.value)}>
            <option value="all">全部负面类型</option>
            <option value="note">笔记负面</option>
            <option value="comment">评论区负面</option>
          </select>
        </div>
        <div>
          {manualList.map((m) => (
            <div key={m.id} className={"alert-item" + (m.neg_type === "comment" ? " mid" : "") + (m.status === "已闭环" ? " done" : "")}>
              <div className="alert-bd">
                <div className="t">{'📌 ' + (m.title || "（未填标题）")}</div>
                <div className="s">
                  {m.kw || "未分类"} · 人工上报 · {m.neg_type === "comment" ? "评论区负面" : "笔记负面"}
                  {m.reporter ? ` · 上报人：${m.reporter}` : ""}
                  {m.note_desc ? ` · ${m.note_desc.slice(0, 80)}` : ""}
                </div>
              </div>
              <div className="alert-acts">
                <span className={"st-chip " + (m.status === "待处理" ? "st-todo" : m.status === "处理中" ? "st-doing" : "st-finish")}>
                  {m.status}
                </span>
                <span className="chip chip-kw">人工上报</span>
                {m.status === "待处理" && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetManualStatus(m.id, "处理中")}>开始处理</button>
                )}
                {m.status === "处理中" && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSetManualStatus(m.id, "已闭环")}>标记闭环</button>
                )}
                {m.status === "已闭环" && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetManualStatus(m.id, "待处理")}>重新打开</button>
                )}
                <a className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }} href={m.url} target="_blank" rel="noopener noreferrer">↗ 查看原文</a>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onDeleteManual(m.id)} title="删除这条上报">删除</button>
              </div>
            </div>
          ))}
        </div>
        <div>
          {autoList.map((n) => {
            const s = st(n.key);
            return (
              <div key={n.key} className={"alert-item" + (n.risk === "中" ? " mid" : "") + (s === "已闭环" ? " done" : "")}>
                <div className="alert-bd">
                  <div className="t">{n.title}</div>
                  <div className="s">
                    <AlertLine note={n} />
                    {!!n.shillCount && n.shillCount >= 1 && (
                      <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                        {" "}⚠ 疑似竞品蹭评 {n.shillCount} 条{n.shillBrands ? `（指向：${n.shillBrands}）` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="alert-acts">
                  <span className={"st-chip " + (s === "待处理" ? "st-todo" : s === "处理中" ? "st-doing" : "st-finish")}>{s}</span>
                  <NoteTags note={n} />
                  <span className="chip chip-risk">风险:{n.risk}</span>
                  {s === "待处理" && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "处理中")}>开始处理</button>
                  )}
                  {s === "处理中" && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "已闭环")}>标记闭环</button>
                  )}
                  {s === "已闭环" && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "待处理")}>重新打开</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => onOpenNote(n)}>详情</button>
                </div>
              </div>
            );
          })}
        </div>
        {autoList.length === 0 && manualList.length === 0 && (
          <div className="empty">没有符合条件的预警，风险可控</div>
        )}
      </div>
    </section>
  );
}

function ManualForm({
  keywords,
  onSubmit,
  busy,
}: {
  keywords: Keyword[];
  onSubmit: (input: { url: string; kw: string; title: string; note_desc: string; reporter: string; neg_type: string }) => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  const [kw, setKw] = useState(keywords[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [reporter, setReporter] = useState("");
  const [negType, setNegType] = useState("note");

  return (
    <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 12, marginBottom: 10 }}>
      <div className="setting-row">
        <label>笔记链接 *</label>
        <input type="text" placeholder="https://www.xiaohongshu.com/explore/xxxx 或分享短链 https://xhslink.com/xxxx" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="setting-row">
        <label>关联关键词</label>
        <select value={kw} onChange={(e) => setKw(e.target.value)}>
          <option value="">不关联</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.name}>{k.name}</option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <label>笔记标题</label>
        <input type="text" placeholder="粘贴笔记标题（便于识别）" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="setting-row">
        <label>负面类型</label>
        <select value={negType} onChange={(e) => setNegType(e.target.value)}>
          <option value="note">笔记内容负面</option>
          <option value="comment">评论区负面/竞品蹭评</option>
        </select>
      </div>
      <div className="setting-row">
        <label>情况说明</label>
        <input type="text" placeholder="一句话描述（如：评论区大量引导至竞品XX）" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="setting-row">
        <label>上报人</label>
        <input type="text" placeholder="你的名字（团队可见）" value={reporter} onChange={(e) => setReporter(e.target.value)} />
      </div>
      <div className="setting-row">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !url.trim()}
          onClick={() => {
            onSubmit({ url, kw, title, note_desc: desc, reporter, neg_type: negType });
            setUrl(""); setTitle(""); setDesc(""); setReporter("");
          }}
        >
          提交上报
        </button>
        <span style={{ fontSize: 12, color: "var(--sub)" }}>提交后立即同步给全团队，进入下方预警列表流转处理。</span>
      </div>
    </div>
  );
}
