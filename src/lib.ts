import type { Keyword, Note, Sent } from "./types";

/* 与 v2 一致的确定性演示数据生成器（固定种子，全员一致） */

const NOTE_TPL: Record<Sent, string[]> = {
  neg: ["用了两周闷痘了，避雷", "客服态度真的很差，投诉无门", "发货慢还不给退款，体验糟糕", "成分表看不懂，感觉被割韭菜", "包装破损没人管，售后形同虚设", "价格降了不给保价，太坑了"],
  pos: ["无限回购！真的好用", "客服小姐姐超耐心，好评", "质地清爽，敏感肌也可以", "性价比很高，不输大牌", "物流很快，包装也精致", "坚持用了一个月，皮肤稳定多了"],
  neu: ["有人用过这个吗？求真实反馈", "今天开箱，先记录一下", "对比了三个牌子，各有优劣", "蹲一个测评，观望中", "新品首发入手，用后再来追评", "整理了一份成分分析，仅供参考"],
};

const AUTHORS = ["小鹿爱分享", "Momo酱", "护肤研究所", "日常碎碎念", "阿圆不圆", "桃子汽水", "成分党Lily", "爱购物的猫", "素颜小姐", "南山南", "一颗甜豆", "橘子海"];

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function genMockNotes(keywords: Keyword[]): Note[] {
  const rnd = seededRand(20261027);
  const kws = keywords.filter((k) => k.enabled);
  const list = kws.length ? kws : [{ id: 0, name: "未设置关键词", enabled: false }];
  const notes: Note[] = [];
  let id = 1;
  list.forEach((k) => {
    const n = 8 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const r = rnd();
      const sent: Sent = r < 0.22 ? "neg" : r < 0.62 ? "pos" : "neu";
      const tpls = NOTE_TPL[sent];
      const title = `[${k.name}] ${tpls[Math.floor(rnd() * tpls.length)]}`;
      const likes = Math.floor(rnd() * 4800) + (sent === "neg" ? 300 : 0);
      const comments = Math.floor(likes * (0.05 + rnd() * 0.15));
      const collects = Math.floor(likes * (0.2 + rnd() * 0.4));
      const hoursAgo = Math.floor(rnd() * 72);
      const risk = sent === "neg" ? (likes > 2500 ? "高" : likes > 800 ? "中" : "低") : "无";
      notes.push({
        key: `m${id++}`,
        kw: k.name,
        title,
        sent,
        author: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
        likes,
        comments,
        collects,
        time: new Date(Date.now() - hoursAgo * 3600 * 1000),
        risk,
        excerpt:
          title.replace(/^\[[^\]]+\]\s*/, "") +
          "。……（演示内容：此处为笔记正文摘要，接入采集链路后将展示真实抓取文本）",
        source: "mock",
      });
    }
  });
  return notes;
}

export function genTrend(): Array<{ label: string; mentions: number; neg: number }> {
  const rnd = seededRand(888);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const m = 90 + Math.floor(rnd() * 80) + (6 - i) * 8;
    const neg = Math.floor(m * (0.15 + rnd() * 0.15));
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, mentions: m, neg });
  }
  return days;
}

export function timeAgo(t: Date): string {
  const h = Math.floor((Date.now() - t.getTime()) / 3600000);
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export function sentName(s: Sent): string {
  return s === "neg" ? "负面" : s === "pos" ? "正面" : "中性";
}

export function fmtToday(): string {
  const d = new Date();
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}
