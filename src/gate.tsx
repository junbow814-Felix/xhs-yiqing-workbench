import { useEffect, useState } from "react";
import { ACCESS_HASH } from "./access";

const LS_KEY = "xhs_yq_access_ok";

export function sha256(text: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buf) => {
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlock(): void {
  try {
    sessionStorage.setItem(LS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function lock(): void {
  try {
    sessionStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

export function PasswordGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // 已解锁（本会话内）直接放行
    if (isUnlocked()) onUnlocked();
  }, [onUnlocked]);

  const submit = async () => {
    setChecking(true);
    setErr("");
    try {
      const h = await sha256(pwd);
      if (h === ACCESS_HASH) {
        unlock();
        onUnlocked();
      } else {
        setErr("口令不正确，请向团队管理员获取");
      }
    } catch {
      setErr("校验失败，请刷新重试");
    } finally {
      setChecking(false);
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
          <div className="sub">访问需要口令 · 请向团队管理员获取</div>
        </div>
      </header>
      <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
        <h3>🔒 输入访问口令</h3>
        <div className="kw-row">
          <input
            type="password"
            placeholder="请输入访问口令"
            aria-label="访问口令"
            value={pwd}
            autoFocus
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="btn btn-primary" onClick={submit} disabled={checking || !pwd}>
            {checking ? "验证中…" : "进入工作台"}
          </button>
        </div>
        {err && (
          <div className="empty" style={{ color: "var(--neg)" }}>
            {err}
          </div>
        )}
        <div className="notice mt">
          <b>口令从哪里获取？</b>
          口令由团队管理员设置和发放。一个口令全员共用，本浏览器解锁后当天内不用重复输入。
        </div>
      </div>
    </div>
  );
}
