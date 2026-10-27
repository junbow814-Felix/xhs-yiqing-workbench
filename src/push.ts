import type { Settings } from "./types";

/* 浏览器直连 IM 群机器人推送
 *
 * - 企业微信 / 飞书：Webhook 支持 CORS，可从浏览器直接发送
 * - 钉钉：支持 CORS；若机器人启用了「加签」安全设置，需要填写 secret，
 *   这里用 Web Crypto 计算 timestamp + sign 拼接到 URL
 * - 若某渠道被 CORS 拦截，返回 push_network，前端提示改用
 *   GitHub Actions 每日定时推送（见仓库 .github/workflows/daily-push.yml）
 */

export interface PushResult {
  ok?: boolean;
  channel?: string;
  error?: "webhook_missing" | "email_not_supported" | "push_rejected" | "push_failed" | "push_network";
}

async function dingtalkSignedUrl(webhook: string, secret: string): Promise<string> {
  const ts = Date.now();
  const stringToSign = `${ts}\n${secret}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(stringToSign));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const sign = encodeURIComponent(b64);
  return `${webhook}${webhook.includes("?") ? "&" : "?"}timestamp=${ts}&sign=${sign}`;
}

export async function pushToIm(text: string, settings: Settings): Promise<PushResult> {
  const channel = settings.channel ?? "wecom";
  const webhook = (settings.webhook ?? "").trim();
  if (!webhook) return { error: "webhook_missing" };
  if (channel === "email") return { error: "email_not_supported" };

  let url = webhook;
  let payload: Record<string, unknown>;
  if (channel === "wecom") {
    payload = { msgtype: "markdown", markdown: { content: text } };
  } else if (channel === "dingtalk") {
    payload = { msgtype: "markdown", markdown: { title: "小红书舆情日报", text } };
    if ((settings.dingtalk_secret ?? "").trim()) {
      url = await dingtalkSignedUrl(webhook, settings.dingtalk_secret!.trim());
    }
  } else {
    payload = { msg_type: "text", content: { text } };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: "push_network" };
  }

  if (!res.ok) return { error: "push_failed" };
  try {
    const parsed = (await res.json()) as { errcode?: number; ok?: boolean };
    if (typeof parsed.errcode === "number" && parsed.errcode !== 0) return { error: "push_rejected" };
    if (parsed.ok === false) return { error: "push_rejected" };
  } catch {
    /* 非 JSON 响应，按 HTTP 状态处理 */
  }
  return { ok: true, channel };
}
