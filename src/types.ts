export type Sent = "neg" | "pos" | "neu";

export interface Keyword {
  id: number;
  name: string;
  enabled: boolean;
}

export interface Note {
  key: string; // 演示: m<id>，真实: r<id>
  kw: string;
  title: string;
  author: string;
  sent: Sent;
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
