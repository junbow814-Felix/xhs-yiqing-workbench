import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import type { AppState, Keyword, ManualNote, Report, Sent, Settings } from "./types";

/* 配置解析：代码内配置优先，其次 localStorage（初始化配置界面写入） */

const LS_CONFIG = "xhs_yq_supabase_config";

export interface SupabaseConfig {
  url: string;
  key: string;
}

export function getStoredConfig(): SupabaseConfig | null {
  const builtin: SupabaseConfig = { url: SUPABASE_URL.trim(), key: SUPABASE_ANON_KEY.trim() };
  if (builtin.url && builtin.key) return builtin;
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupabaseConfig;
    if (parsed?.url && parsed?.key) return { url: parsed.url.trim(), key: parsed.key.trim() };
  } catch {
    /* ignore */
  }
  return null;
}

export function saveStoredConfig(cfg: SupabaseConfig) {
  localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
}

export function clearStoredConfig() {
  localStorage.removeItem(LS_CONFIG);
}

let client: any = null;
let clientKey = "";

function sb(): any {
  const cfg = getStoredConfig();
  if (!cfg) throw new Error("CONFIG_MISSING");
  const key = cfg.url + "|" + cfg.key;
  if (!client || clientKey !== key) {
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientKey = key;
  }
  return client;
}

export function configReady(): boolean {
  return getStoredConfig() !== null;
}

/* ---------- 数据操作 ---------- */

export async function getState(): Promise<AppState> {
  const c = sb();
  const [keywords, alerts, reports, settingsRows, realNotes, manualNotes] = await Promise.all([
    c.from("keywords").select("id,name,enabled,own_brands").order("id", { ascending: true }),
    c.from("alert_status").select("note_key,status"),
    c
      .from("reports")
      .select("id,rep_date,content,summary,created_at")
      .order("rep_date", { ascending: false })
      .limit(200),
    c.from("settings").select("report_time,channel,webhook").eq("id", 1).maybeSingle(),
  c
      .from("notes")
      .select("id,kw,title,author,sent,note_sent,comment_sent,neg_source,shill_count,shill_brands,comment_neg_ratio,likes,comments,collects,risk,excerpt,source,note_url,first_seen,last_seen,archived,published_at")
      .order("likes", { ascending: false })
      .limit(500),
    c.from("manual_notes").select("id,note_key,url,kw,title,note_desc,reporter,neg_type,status,created_at").limit(200),
  ]);
  const err = keywords.error || alerts.error || reports.error || settingsRows.error || realNotes.error || manualNotes.error;
  if (err) throw err;
  return {
    keywords: keywords.data ?? [],
    alerts: Object.fromEntries(((alerts.data ?? []) as Array<{ note_key: string; status: string }>).map((a) => [a.note_key, a.status])),
    reports: (reports.data ?? []) as Report[],
    settings: (settingsRows.data as Settings | null) ?? { report_time: "09:00", channel: "wecom", webhook: "" },
    realNotes: realNotes.data ?? [],
    manualNotes: ((manualNotes.data ?? []) as ManualNote[]).sort(
      (a, b) => b.created_at.localeCompare(a.created_at),
    ),
  };
}

export async function addKeyword(name: string): Promise<Keyword | { error: string }> {
  const c = sb();
  const { data, error } = await c
    .from("keywords")
    .insert({ name, enabled: true })
    .select()
    .single();
  if (error) {
    const code = String(error.code ?? "");
    if (code === "23505" || /duplicate/i.test(error.message ?? "")) return { error: "keyword_exists" };
    throw error;
  }
  return data as Keyword;
}

export async function saveOwnBrands(id: number, ownBrands: string) {
  const c = sb();
  const { error } = await c.from("keywords").update({ own_brands: ownBrands.slice(0, 300) }).eq("id", id);
  if (error) throw error;
}

/* ---------- 手动上报负面笔记 ---------- */

export function extractNoteId(url: string): string | null {
  const m = /(?:xhslink\.com\/[A-Za-z0-9]+|(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([0-9a-f]{16,}))/.exec(url.trim());
  if (m) return m[1] ?? m[0];
  if (/^[0-9a-f]{16,}$/.test(url.trim())) return url.trim();
  return null;
}

export async function addManualNote(input: {
  url: string;
  kw: string;
  title: string;
  note_desc: string;
  reporter: string;
  neg_type: string;
}): Promise<ManualNote | { error: string }> {
  const c = sb();
  const noteId = extractNoteId(input.url);
  if (!noteId) return { error: "bad_url" };
  const noteKey = `manual-${noteId.slice(-24)}`;
  const { data, error } = await c
    .from("manual_notes")
    .insert({
      note_key: noteKey,
      url: input.url.trim().slice(0, 500),
      kw: input.kw.slice(0, 50),
      title: (input.title || "（未填标题）").slice(0, 200),
      note_desc: input.note_desc.slice(0, 1000),
      reporter: input.reporter.slice(0, 50),
      neg_type: input.neg_type === "comment" ? "comment" : "note",
    })
    .select()
    .single();
  if (error) {
    if (String(error.code) === "23505" || /duplicate/i.test(error.message ?? "")) return { error: "exists" };
    throw error;
  }
  return data as ManualNote;
}

export async function setManualNoteStatus(id: number, status: string) {
  const c = sb();
  const { error } = await c.from("manual_notes").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteManualNote(id: number) {
  const c = sb();
  const { error } = await c.from("manual_notes").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleKeyword(id: number, enabled: boolean) {
  const c = sb();
  const { error } = await c.from("keywords").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function deleteKeyword(id: number) {
  const c = sb();
  const { error } = await c.from("keywords").delete().eq("id", id);
  if (error) throw error;
}

export async function setAlertStatus(noteKey: string, status: string) {
  const c = sb();
  const { error } = await c
    .from("alert_status")
    .upsert({ note_key: noteKey, status, updated_at: new Date().toISOString() }, { onConflict: "note_key" });
  if (error) throw error;
}

export async function saveReport(date: string, content: string, summary: string): Promise<Report> {
  const c = sb();
  const { data, error } = await c
    .from("reports")
    .upsert({ rep_date: date, content, summary }, { onConflict: "rep_date" })
    .select()
    .single();
  if (error) throw error;
  return data as Report;
}

export async function saveSettings(s: Settings & { dingtalk_secret?: string }) {
  const c = sb();
  const { error } = await c
    .from("settings")
    .upsert(
      {
        id: 1,
        report_time: s.report_time,
        channel: s.channel,
        webhook: s.webhook,
        dingtalk_secret: s.dingtalk_secret ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw error;
}

export async function replaceRealNotes(rawList: Array<Record<string, unknown>>): Promise<number> {
  const c = sb();
  const rows = rawList.map(sanitizeNote).filter(Boolean) as Array<Record<string, unknown>>;
  if (!rows.length) return 0;
  const del = await c.from("notes").delete().eq("source", "real");
  if (del.error) throw del.error;
  const { data, error } = await c.from("notes").insert(rows).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

function sanitizeNote(raw: Record<string, unknown>): Record<string, unknown> | null {
  const title = String(raw.title ?? "").slice(0, 300).trim();
  if (!title) return null;
  const sent: Sent = ["neg", "pos", "neu"].includes(String(raw.sent)) ? (raw.sent as Sent) : "neu";
  const risk = ["高", "中", "低", "无"].includes(String(raw.risk)) ? String(raw.risk) : "无";
  const num = (v: unknown) => Math.max(0, Math.min(9_999_999, Math.floor(Number(v) || 0)));
  const publishedAt =
    raw.published_at && !Number.isNaN(Date.parse(String(raw.published_at)))
      ? new Date(String(raw.published_at)).toISOString()
      : new Date().toISOString();
  return {
    kw: String(raw.kw ?? "未分类").slice(0, 50),
    title,
    author: String(raw.author ?? "").slice(0, 100),
    sent,
    likes: num(raw.likes),
    comments: num(raw.comments),
    collects: num(raw.collects),
    risk,
    excerpt: String(raw.excerpt ?? "").slice(0, 2000),
    source: "real",
    published_at: publishedAt,
  };
}
