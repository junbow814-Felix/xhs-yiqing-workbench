import { useEffect, useRef } from "react";
import { genTrend } from "../lib";
import type { Note, Sent } from "../types";

export function TrendChart() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const data = genTrend();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(cv.parentNode ? (cv.parentNode as HTMLElement).clientWidth : 600, 280);
    const h = 220;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 34, padR = 10, padT = 14, padB = 26;
    const maxV = Math.max(...data.map((d) => d.mentions)) * 1.15;
    const iw = w - padL - padR, ih = h - padT - padB;
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = padT + ih - (ih * g) / 4;
      ctx.strokeStyle = "#eef0f3";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(Math.round((maxV * g) / 4)), 4, y + 3);
    }
    const px = (i: number) => padL + (iw * i) / (data.length - 1);
    const py = (v: number) => padT + ih - (ih * v) / maxV;
    ctx.beginPath();
    data.forEach((d, i) => (i ? ctx.lineTo(px(i), py(d.mentions)) : ctx.moveTo(px(i), py(d.mentions))));
    ctx.strokeStyle = "#ff2442";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(px(data.length - 1), padT + ih);
    ctx.lineTo(px(0), padT + ih);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,36,66,.08)";
    ctx.fill();
    ctx.beginPath();
    data.forEach((d, i) => (i ? ctx.lineTo(px(i), py(d.neg)) : ctx.moveTo(px(i), py(d.neg))));
    ctx.strokeStyle = "#7c8291";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(px(i), py(d.mentions), 3, 0, 7);
      ctx.fillStyle = "#ff2442";
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.label, px(i), h - 8);
      ctx.textAlign = "left";
    });
  });

  return (
    <div className="chart-wrap">
      <canvas ref={ref} height={220} />
    </div>
  );
}

export function PieChart({ notes }: { notes: Note[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const counts: Record<Sent, number> = { pos: 0, neg: 0, neu: 0 };
  notes.forEach((n) => counts[n.sent]++);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(cv.parentNode ? (cv.parentNode as HTMLElement).clientWidth : 300, 240);
    const h = 220;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const total = counts.pos + counts.neg + counts.neu || 1;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 14, ir = r * 0.62;
    const segs = [
      { v: counts.pos, c: "#16a34a" },
      { v: counts.neg, c: "#dc2626" },
      { v: counts.neu, c: "#c3c7cf" },
    ];
    let a0 = -Math.PI / 2;
    segs.forEach((s) => {
      if (!s.v) return;
      const a1 = a0 + (2 * Math.PI * s.v) / total;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = s.c;
      ctx.fill();
      a0 = a1;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, 7);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.fillStyle = "#1c1e26";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(counts.pos + counts.neg + counts.neu), cx, cy + 2);
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "11px sans-serif";
    ctx.fillText("笔记总数", cx, cy + 20);
    ctx.textAlign = "left";
  });

  const total = counts.pos + counts.neg + counts.neu || 1;
  return (
    <div className="chart-wrap">
      <canvas ref={ref} height={220} />
      <div className="legend">
        <span><i style={{ background: "#16a34a" }} />正面 {counts.pos} 篇（{Math.round((counts.pos / total) * 100)}%）</span>
        <span><i style={{ background: "#dc2626" }} />负面 {counts.neg} 篇（{Math.round((counts.neg / total) * 100)}%）</span>
        <span><i style={{ background: "#c3c7cf" }} />中性 {counts.neu} 篇（{Math.round((counts.neu / total) * 100)}%）</span>
      </div>
    </div>
  );
}
