import type { Note, Sent } from "../types";
import { timeAgo } from "../lib";

export function SentChip({ sent }: { sent: Sent }) {
  const cls = sent === "neg" ? "chip chip-neg" : sent === "pos" ? "chip chip-pos" : "chip chip-neu";
  return <span className={cls}>{sent === "neg" ? "负面" : sent === "pos" ? "正面" : "中性"}</span>;
}

export function NoteMeta({ note }: { note: Note }) {
  return (
    <div className="note-meta">
      <span className="chip chip-kw">{note.kw}</span>
      <SentChip sent={note.sent} />
      {note.risk !== "无" && <span className="chip chip-risk">风险:{note.risk}</span>}
      {note.source === "real" && <span className="chip chip-pos">真实采集</span>}
    </div>
  );
}

export function Drawer({
  note,
  onClose,
}: {
  note: Note | null;
  onClose: () => void;
}) {
  const show = note !== null;
  return (
    <>
      <div
        className={"drawer-mask" + (show ? " show" : "")}
        onClick={onClose}
      />
      <aside className={"drawer" + (show ? " show" : "")} aria-label="笔记详情">
        <div className="drawer-hd">
          <h3>笔记详情</h3>
          <button className="drawer-close" aria-label="关闭" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="drawer-bd">
          {note && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{note.title}</div>
              <div style={{ marginBottom: 6 }}>
                <NoteMeta note={note} />
              </div>
              <div className="kv"><span className="k">作者</span><span>{note.author || "—"}</span></div>
              <div className="kv"><span className="k">发布时间</span><span>{note.time.toLocaleString("zh-CN")}</span></div>
              <div className="kv"><span className="k">点赞</span><span>{note.likes} 次</span></div>
              <div className="kv"><span className="k">评论</span><span>{note.comments} 条</span></div>
              <div className="kv"><span className="k">收藏</span><span>{note.collects} 次</span></div>
              <div className="kv"><span className="k">数据来源</span><span>{note.source === "real" ? "真实采集" : "演示数据"}</span></div>
              <div className="excerpt">{note.excerpt || "（暂无摘要）"}</div>
              {note.noteUrl && (
                <a
                  className="btn btn-primary"
                  style={{ display: "inline-block", marginTop: 4, textDecoration: "none" }}
                  href={note.noteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ↗ 在小红书查看原文
                </a>
              )}
              <div style={{ fontSize: 12, color: "#9aa0a8", marginTop: 10 }}>
                {note.source === "real"
                  ? "数据来自采集链路写入，每日自动更新。摘要开头为 AI 情感判定依据。"
                  : "接入采集链路后，这里将展示真实笔记正文、评论区情感分布与原文链接。"}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function AlertLine({ note }: { note: Note }) {
  return (
    <span>
      {note.kw} · {note.author} · 赞 {note.likes} / 评 {note.comments} · {timeAgo(note.time)}
    </span>
  );
}
