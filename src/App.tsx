import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Keyword, Note, Report, Settings } from "./types";
import { copyText, fmtToday, genMockNotes, todayStr } from "./lib";
import {
  addKeyword as dbAddKeyword,
  configReady,
  deleteKeyword as dbDeleteKeyword,
  getState,
  saveReport as dbSaveReport,
  saveSettings as dbSaveSettings,
  saveStoredConfig,
  setAlertStatus as dbSetAlertStatus,
  toggleKeyword as dbToggleKeyword,
} from "./db";
import { pushToIm } from "./push";
import { Overview } from "./components/Overview";
import { Notes, exportCsv } from "./components/Notes";
import { Alerts } from "./components/Alerts";
import { Report as ReportTab } from "./components/Report";
import { Opensource, Deploy } from "./components/InfoTabs";
import { Drawer } from "./components/ui";

const PAGES = ["overview", "notes", "alerts", "report", "opensource", "deploy"] as const;
type Page = (typeof PAGES)[number];

const CHANNEL_NAMES: Record<string, string> = {
  wecom: "企业微信",
  dingtalk: "钉钉",
  feishu: "飞书",
  email: "邮件",
};

const EMPTY_SETTINGS: Settings = { report_time: "09:00", channel: "wecom", webhook: "" };

function SetupScreen({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    const u = url.trim().replace(/\/$/, "");
    const k = key.trim();
    if (!/^https:\/\/[\w.-]+\.supabase\.co$/.test(u)) {
      setMsg("Project URL 格式不对，应为 https://xxxxx.supabase.co");
      return;
    }
    if (!k) {
      setMsg("请填写 anon key");
      return;
    }
    setTesting(true);
    setMsg("");
    try {
      const res = await fetch(`${u}/rest/v1/keywords?select=id&limit=1`, {
        headers: { apikey: k, Authorization: `Bearer ${k}` },
      });
      if (!res.ok) {
        setMsg(res.status === 401 || res.status === 403 ? "连接被拒绝：请确认 anon key 正确，且已在 Supabase 运行过 schema.sql 建表" : `连接失败（HTTP ${res.status}），请检查 URL 与 key`);
        return;
      }
      saveStoredConfig({ url: u, key: k });
      onSaved();
    } catch {
      setMsg("网络错误，无法连接 Supabase，请检查 URL");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="app">
      <header className="hd">
        <div className="logo">舆</div>
        <div>
          <h1>
            小红书舆情监控工作台 <span className="hd-ver">在线协作版</span>
          </h1>
          <div className="sub">首次使用需连接团队共享数据库（Supabase）</div>
        </div>
      </header>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h3>初始化配置</h3>
        <div className="setting-row">
          <label>Project URL</label>
          <input
            type="text"
            placeholder="https://xxxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label>anon key</label>
          <input
            type="text"
            placeholder="eyJhbGciOi...（Project Settings → API 页）"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <button className="btn btn-primary" onClick={save} disabled={testing}>
            {testing ? "正在验证连接…" : "保存并进入工作台"}
          </button>
        </div>
        {msg && <div className="empty" style={{ color: "var(--neg)" }}>{msg}</div>}
        <div className="notice mt">
          <b>这两项从哪里拿？</b>
          登录 supabase.com → 打开你的项目 → Project Settings → API 页：Project URL 与
          anon public key。配置仅保存在当前浏览器；管理员也可把这两项写入仓库
          src/config.ts，团队成员打开即可直接使用。
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(configReady());
  const [tab, setTab] = useState<Page>("overview");
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const [drawerNote, setDrawerNote] = useState<Note | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2400);
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => toast((e as CustomEvent<string>).detail);
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, [toast]);

  const refresh = useCallback(async (silent = false): Promise<AppState | null> => {
    try {
      const data = await getState();
      setState(data);
      setLoadError(false);
      return data;
    } catch {
      if (!silent) setLoadError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  /* 轮询：每 30 秒静默同步一次团队其他人的变更 */
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void refresh(true), 30_000);
    return () => window.clearInterval(timer);
  }, [ready, refresh]);

  /* notes: 真实采集优先，否则确定性演示数据 */
  const notes: Note[] = useMemo(() => {
    if (!state) return [];
    if (state.realNotes.length > 0) {
      return state.realNotes.map((n) => ({
        key: `r${n.id}`,
        kw: n.kw,
        title: n.title,
        author: n.author ?? "",
        sent: n.sent,
        noteSent: (n as { note_sent?: string | null }).note_sent ?? undefined,
        commentSent: (n as { comment_sent?: string | null }).comment_sent ?? undefined,
        negSource: (n as { neg_source?: string | null }).neg_source ?? undefined,
        shillCount: (n as { shill_count?: number | null }).shill_count ?? undefined,
        shillBrands: (n as { shill_brands?: string | null }).shill_brands ?? undefined,
        commentNegRatio: (n as { comment_neg_ratio?: number | null }).comment_neg_ratio ?? undefined,
        likes: n.likes,
        comments: n.comments,
        collects: n.collects,
        time: new Date(n.published_at),
        risk: n.risk,
        excerpt: n.excerpt ?? "",
        source: "real",
        noteUrl: (n as { note_url?: string | null }).note_url || undefined,
      }));
    }
    return genMockNotes(state.keywords);
  }, [state]);

  const alertTodo = useMemo(
    () =>
      notes.filter((n) => n.risk !== "无" && (state?.alerts[n.key] ?? "待处理") === "待处理")
        .length,
    [notes, state],
  );

  const withBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const addKeyword = (name: string) =>
    withBusy(async () => {
      try {
        const r = await dbAddKeyword(name);
        if ("error" in r && r.error === "keyword_exists") {
          toast("该关键词已存在");
          return;
        }
        toast(`已添加关键词：${name}（团队共享）`);
        await refresh(true);
      } catch {
        toast("添加失败，请检查数据库配置");
      }
    });

  const toggleKeyword = (k: Keyword) =>
    withBusy(async () => {
      try {
        await dbToggleKeyword(k.id, !k.enabled);
        toast(`${k.enabled ? "已暂停" : "已开启"}关键词：${k.name}`);
        await refresh(true);
      } catch {
        toast("操作失败，请检查数据库配置");
      }
    });

  const deleteKeyword = (k: Keyword) =>
    withBusy(async () => {
      try {
        await dbDeleteKeyword(k.id);
        toast(`已删除关键词：${k.name}`);
        await refresh(true);
      } catch {
        toast("删除失败，请检查数据库配置");
      }
    });

  const setAlertStatus = (key: string, status: string) =>
    withBusy(async () => {
      try {
        await dbSetAlertStatus(key, status);
        toast(
          status === "处理中"
            ? "已转入处理中（全员可见）"
            : status === "已闭环"
              ? "预警已闭环（全员可见）"
              : "已重新打开该预警",
        );
        await refresh(true);
      } catch {
        toast("操作失败，请检查数据库配置");
      }
    });

  const generateReport = (text: string) =>
    withBusy(async () => {
      const date = todayStr();
      const total = notes.length;
      const neg = notes.filter((n) => n.sent === "neg").length;
      try {
        const rep = await dbSaveReport(date, text, `笔记 ${total} 篇 · 负面 ${neg} 篇`);
        setCurrentReport(rep);
        toast("今日上报已生成并同步给全团队");
        await refresh(true);
        setTab("report");
      } catch {
        toast("生成失败，请检查数据库配置");
      }
    });

  const saveSettings = (s: Settings) =>
    withBusy(async () => {
      try {
        await dbSaveSettings(s);
        toast("上报设置已保存（全团队生效）");
        await refresh(true);
      } catch {
        toast("保存失败，请检查数据库配置");
      }
    });

  const pushReport = (content: string) =>
    withBusy(async () => {
      const settings = state?.settings ?? EMPTY_SETTINGS;
      const r = await pushToIm(content, settings);
      if (r.ok && r.channel) {
        toast(`已真实推送到 ${CHANNEL_NAMES[r.channel] ?? "IM"}群`);
      } else if (r.error === "webhook_missing") {
        toast("请先到「上报设置」填写 Webhook 地址");
      } else if (r.error === "email_not_supported") {
        toast("邮件渠道暂未实现，请选择群机器人渠道");
      } else if (r.error === "push_rejected") {
        toast("推送被 IM 拒绝：请检查 Webhook 地址/机器人安全设置（钉钉加签需填 Secret）");
      } else if (r.error === "push_network") {
        toast("浏览器直推被拦截（CORS）：请改用仓库 daily-push 定时推送，或复制文本发群");
      } else {
        toast("推送失败，请稍后再试");
      }
    });

  const copyReport = async (text: string) => {
    if (await copyText(text)) toast("已复制到剪贴板");
    else toast("复制失败，请手动选择文本复制");
  };

  const exportNotes = (list: Note[]) => {
    if (!list.length) {
      toast("当前没有可导出的笔记");
      return;
    }
    const blob = new Blob([exportCsv(list)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "小红书舆情笔记-导出.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 300);
    toast(`已导出 ${list.length} 条笔记（CSV）`);
  };

  const [syncing, setSyncing] = useState(false);

  const manualSync = async () => {
    setSyncing(true);
    try {
      const before = state?.realNotes.length ?? -1;
      const data = await getState();
      setState(data);
      setLoadError(false);
      const after = data.realNotes.length;
      if (before >= 0 && after !== before) {
        toast(after > before ? `已同步：新增 ${after - before} 篇采集笔记` : "已同步：采集笔记有更新");
      } else {
        toast("已同步最新团队数据");
      }
    } catch {
      toast("同步失败，请稍后再试");
    } finally {
      setSyncing(false);
    }
  };

  if (!ready) return <SetupScreen onSaved={() => setReady(true)} />;

  const isReal = (state?.realNotes.length ?? 0) > 0;
  const settings = state?.settings ?? EMPTY_SETTINGS;
  const reports = state?.reports ?? [];
  const keywords = state?.keywords ?? [];
  const alerts = state?.alerts ?? {};

  return (
    <div className="app">
      <header className="hd">
        <div className="logo">舆</div>
        <div>
          <h1>
            小红书舆情监控工作台 <span className="hd-ver">在线协作版</span>
          </h1>
          <div className="sub">
            {fmtToday()} · 每日 {settings.report_time} 自动巡检 · 数据全员共享
          </div>
        </div>
        <span className={isReal ? "badge-real" : "badge-demo"}>
          {isReal ? `真实采集 · ${state?.realNotes.length ?? 0} 篇` : "演示数据 · 采集链路未接入"}
        </span>
        <button
          className="btn btn-ghost btn-sm sync-btn"
          onClick={manualSync}
          disabled={syncing}
          title="立即从团队数据库拉取最新采集数据"
        >
          {syncing ? "同步中…" : "↻ 立即同步"}
        </button>
      </header>

      <nav className="tabs">
        {PAGES.map((p, i) => (
          <button key={p} className={tab === p ? "on" : ""} onClick={() => setTab(p)}>
            {["舆情总览", "笔记列表", "预警中心", "上报中心", "开源方案", "部署方案"][i]}
          </button>
        ))}
      </nav>

      {state === null && !loadError && (
        <div className="loading">
          <i />
          正在加载团队数据…
        </div>
      )}
      {loadError && (
        <div className="card">
          <div className="empty">
            数据加载失败（请确认 Supabase 项目可用、已运行 schema.sql）
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => void refresh()}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {state && tab === "overview" && (
        <Overview
          keywords={keywords}
          notes={notes}
          reports={reports}
          alertTodo={alertTodo}
          onAddKw={addKeyword}
          onToggleKw={toggleKeyword}
          onDeleteKw={deleteKeyword}
          busy={busy}
        />
      )}
      {state && tab === "notes" && (
        <Notes keywords={keywords} notes={notes} onOpenNote={setDrawerNote} onExport={exportNotes} />
      )}
      {state && tab === "alerts" && (
        <Alerts
          notes={notes}
          alerts={alerts}
          onSetStatus={setAlertStatus}
          onOpenNote={setDrawerNote}
          busy={busy}
        />
      )}
      {state && tab === "report" && (
        <ReportTab
          notes={notes}
          keywords={keywords}
          alerts={alerts}
          reports={reports}
          settings={settings}
          current={currentReport}
          onGenerate={generateReport}
          onSaveSettings={saveSettings}
          onPush={pushReport}
          onCopy={copyReport}
          busy={busy}
        />
      )}
      {tab === "opensource" && <Opensource />}
      {tab === "deploy" && <Deploy />}

      <Drawer note={drawerNote} onClose={() => setDrawerNote(null)} />
      <div className={"toast" + (toastMsg ? " show" : "")}>{toastMsg}</div>
    </div>
  );
}
