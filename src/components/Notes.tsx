import { useMemo, useState } from "react";
import type { Keyword, Note } from "../types";
import { sentName, timeAgo } from "../lib";
import { NoteMeta } from "./ui";

const RISK_W: Record<string, number> = { 高: 3, 中: 2, 低: 1, 无: 0 };

export function sortNotes(list: Note[], sortBy: string): Note[] {
  return [...list].sort((a, b) => {
    if (sortBy === "time") return b.time.getTime() - a.time.getTime();
    if (sortBy === "risk")
      return (RISK_W[b.risk] - RISK_W[a.risk]) || (b.likes - a.likes);
    return b.likes + b.comments * 3 - (a.likes + a.comments * 3);
  });
}

export function Notes({
  keywords,
  notes,
  onOpenNote,
  onExport,
}: {
  keywords: Keyword[];
  notes: Note[];
  onOpenNote: (n: Note) => void;
  onExport: (list: Note[]) => void;
}) {
  const [fKw, setFKw] = useState("all");
  const [fSent, setFSent] = useState("all");
  const [fSort, setFSort] = useState("heat");

  const list = useMemo(
    () =>
      sortNotes(
        notes.filter((n) => {
          if (fKw !== "all" && n.kw !== fKw) return false;
          if (fSent === "all") return true;
          if (fSent === "neg-note") return n.negSource === "note" || n.negSource === "both";
          if (fSent === "neg-comment") return n.negSource === "comment" || n.negSource === "both";
          return n.sent === fSent;
        }),
        fSort,
      ),
    [notes, fKw, fSent, fSort],
  );

  return (
    <section>
      <div className="card">
        <h3>
          监控到的笔记 <span className="tag">共 {list.length} 篇</span>
        </h3>
        <div className="filters">
          <select aria-label="按关键词筛选" value={fKw} onChange={(e) => setFKw(e.target.value)}>
            <option value="all">全部关键词</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.name}>
                {k.name}
              </option>
            ))}
          </select>
          <select aria-label="按情感筛选" value={fSent} onChange={(e) => setFSent(e.target.value)}>
            <option value="all">全部情感</option>
            <option value="neg">负面（综合）</option>
            <option value="neg-note">笔记负面</option>
            <option value="neg-comment">评论负面</option>
            <option value="pos">正面</option>
            <option value="neu">中性</option>
          </select>
          <select aria-label="排序方式" value={fSort} onChange={(e) => setFSort(e.target.value)}>
            <option value="heat">按互动热度</option>
            <option value="time">按发布时间</option>
            <option value="risk">按风险等级</option>
          </select>
          <button className="btn btn-ghost" onClick={() => onExport(list)}>
            导出 CSV
          </button>
        </div>
        <div className="notes">
          {list.map((n) => (
            <div className="note" key={n.key} onClick={() => onOpenNote(n)}>
              <div className="nt">{n.title}</div>
              <div className="nm">
                {n.author} · {timeAgo(n.time)}
              </div>
              <NoteMeta note={n} />
              <div className="note-meta" style={{ marginTop: 6 }}>
                <span className="nums">
                  <span>赞 {n.likes}</span>
                  <span>评 {n.comments}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        {list.length === 0 && (
          <div className="empty">没有符合条件的笔记，换个筛选试试</div>
        )}
      </div>
    </section>
  );
}

export function exportCsv(list: Note[]): string {
  const head = ["标题", "关键词", "作者", "情感", "风险", "点赞", "评论", "收藏", "发布时间", "来源"];
  const rows = list.map((n) =>
    [
      n.title,
      n.kw,
      n.author,
      sentName(n.sent),
      n.risk,
      n.likes,
      n.comments,
      n.collects,
      n.time.toLocaleString("zh-CN"),
      n.source === "real" ? "真实采集" : "演示数据",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return "\uFEFF" + head.join(",") + "\n" + rows.join("\n");
}
