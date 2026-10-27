import { useState } from "react";
import type { Note } from "../types";
import { AlertLine } from "./ui";

export function Alerts({
  notes,
  alerts,
  onSetStatus,
  onOpenNote,
  busy,
}: {
  notes: Note[];
  alerts: Record<string, string>;
  onSetStatus: (key: string, status: string) => void;
  onOpenNote: (n: Note) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState("all");

  const st = (key: string) => alerts[key] ?? "待处理";
  const list = notes
    .filter((n) => n.risk !== "无")
    .filter((n) => filter === "all" || st(n.key) === filter)
    .sort((a, b) => {
      const w: Record<string, number> = { 高: 2, 中: 1, 低: 0 };
      return w[b.risk] - w[a.risk] || b.likes - a.likes;
    });

  return (
    <section>
      <div className="card">
        <h3>
          风险预警 <span className="tag">处理状态团队共享</span>
        </h3>
        <div className="filters">
          <select aria-label="按预警状态筛选" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">全部状态</option>
            <option value="待处理">待处理</option>
            <option value="处理中">处理中</option>
            <option value="已闭环">已闭环</option>
          </select>
        </div>
        <div>
          {list.map((n) => {
            const s = st(n.key);
            return (
              <div
                key={n.key}
                className={
                  "alert-item" +
                  (n.risk === "中" ? " mid" : "") +
                  (s === "已闭环" ? " done" : "")
                }
              >
                <div className="alert-bd">
                  <div className="t">{n.title}</div>
                  <div className="s">
                    <AlertLine note={n} />
                  </div>
                </div>
                <div className="alert-acts">
                  <span className={"st-chip " + (s === "待处理" ? "st-todo" : s === "处理中" ? "st-doing" : "st-finish")}>
                    {s}
                  </span>
                  <span className="chip chip-risk">风险:{n.risk}</span>
                  {s === "待处理" && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "处理中")}>
                      开始处理
                    </button>
                  )}
                  {s === "处理中" && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "已闭环")}>
                      标记闭环
                    </button>
                  )}
                  {s === "已闭环" && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSetStatus(n.key, "待处理")}>
                      重新打开
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => onOpenNote(n)}>
                    详情
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {list.length === 0 && <div className="empty">没有符合条件的预警，风险可控</div>}
      </div>
    </section>
  );
}
