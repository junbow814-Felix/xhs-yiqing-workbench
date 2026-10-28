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
  firstSeen?: string;
  lastSeen?: string;
  archived?: boolean;
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

export interface ManualNote {
  id: number;
  note_key: string;
  url: string;
  kw: string;
  title: string;
  note_desc: string;
  reporter: string;
  neg_type: string; // note/comment
  status: string;
  created_at: string;
}

export interface AppState {
  keywords: Keyword[];
  alerts: Record<string, string>;
  manualNotes: ManualNote[];
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
    first_seen?: string | null;
    last_seen?: string | null;
    archived?: boolean | null;
    published_at: string;
  }>;
}
