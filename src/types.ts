export type Sent = "neg" | "pos" | "neu";

export interface Keyword {
  id: number;
  name: string;
  enabled: boolean;
  own_brands?: string;
}

export interface Note {
  key: string; // 演示: m<id>，真实: r<id>
  kw: string;
  title: string;
  author: string;
  sent: Sent;
  noteSent?: string;      // 笔记本身情感（真实采集）
  commentSent?: string;   // 评论区情感
  negSource?: string;     // note/comment/both/none
  shillCount?: number;    // 疑似竞品引导评论数
  shillBrands?: string;   // 涉及竞品品牌
  commentNegRatio?: number;
  likes: number;
  comments: number;
  collects: number;
  time: Date;
  risk: string;
  excerpt: string;
  source: "mock" | "real";
  noteUrl?: string;
}

export interface Report {
  id: number;
  rep_date: string;
  content: string;
  summary: string;
  created_at: string;
}

export interface Settings {
  report_time: string;
  channel: string;
  webhook: string;
  dingtalk_secret?: string;
}

export interface AppState {
  keywords: Keyword[];
  alerts: Record<string, string>;
  reports: Report[];
  settings: Settings;
  realNotes: Array<{
    id: number;
    kw: string;
    title: string;
    author: string | null;
    sent: Sent;
    note_sent?: string | null;
    comment_sent?: string | null;
    neg_source?: string | null;
    shill_count?: number | null;
    shill_brands?: string | null;
    comment_neg_ratio?: number | null;
    likes: number;
    comments: number;
    collects: number;
    risk: string;
    excerpt: string | null;
    source?: string;
    note_url?: string | null;
    published_at: string;
  }>;
}
