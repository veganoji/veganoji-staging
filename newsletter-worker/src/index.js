// veganoji-newsletter — signup capture Worker (double opt-in, no DB).
//
// Routes:
//   POST /subscribe        validate email + email a signed confirm link (honeypot)
//   GET  /confirm?token=…   verify token + add contact to Resend audience, redirect
//   GET  /health            quick status (does NOT reveal secrets)
//
// Why a Worker (not Pages Functions): veganoji.jp is served by a Worker, not a
// Pages project, so a functions/ dir never runs. This mirrors the other oji
// projects (almostjp/castingoji/…), each a standalone wrangler Worker.
//
// Env: RESEND_API_KEY (secret), CONFIRM_SECRET (secret), RESEND_AUDIENCE_ID,
//      NEWSLETTER_FROM, NEWSLETTER_REPLY_TO, SITE_URL, ALLOWED_ORIGINS.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return json({ ok: true, configured: !!(env.RESEND_API_KEY && env.CONFIRM_SECRET) }, 200, cors);
    if (url.pathname === "/subscribe" && request.method === "POST") return subscribe(request, env, cors);
    if (url.pathname === "/confirm" && request.method === "GET") return confirm(request, env);
    return json({ ok: false, error: "not_found" }, 404, cors);
  },
};

// ───────── helpers ─────────
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}
function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToStr(b) {
  b = b.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const strToB64url = (s) => bytesToB64url(new TextEncoder().encode(s));
async function sign(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return bytesToB64url(new Uint8Array(sig));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ───────── POST /subscribe ─────────
async function subscribe(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400, cors); }
  if (body.hp) return json({ ok: true }, 200, cors); // honeypot

  const email = String(body.email || "").trim().toLowerCase();
  const lang = ["ja", "en", "both"].includes(body.lang) ? body.lang : "both";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 422, cors);
  if (!env.RESEND_API_KEY || !env.CONFIRM_SECRET) return json({ ok: false, error: "not_configured" }, 503, cors);

  const exp = Date.now() + 1000 * 60 * 60 * 48;
  const payload = strToB64url(JSON.stringify({ e: email, l: lang, x: exp }));
  const token = `${payload}.${await sign(env.CONFIRM_SECRET, payload)}`;
  // /confirm is served by THIS worker, so build the link from the worker's own origin.
  const self = new URL(request.url).origin;
  const confirmUrl = `${self}/confirm?token=${encodeURIComponent(token)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.NEWSLETTER_FROM || "ビーガン王子 Vegan Oji <oji@ojidigital.com>",
      reply_to: env.NEWSLETTER_REPLY_TO || "info@veganoji.jp",
      to: email,
      subject: "【ご確認ください】王子通信のご登録 / Confirm your Vegan Oji subscription",
      html: confirmEmailHtml(confirmUrl),
      text: confirmEmailText(confirmUrl),
    }),
  });
  if (!res.ok) {
    console.log("resend send failed", res.status, await res.text().catch(() => ""));
    return json({ ok: false, error: "send_failed" }, 502, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ───────── GET /confirm ─────────
async function confirm(request, env) {
  const site = env.SITE_URL || "https://veganoji.jp";
  const go = (path) => Response.redirect(site + path, 302);

  const token = new URL(request.url).searchParams.get("token") || "";
  const dot = token.lastIndexOf(".");
  if (dot < 1 || !env.CONFIRM_SECRET) return go("/newsletter/expired/");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!timingSafeEqual(sig, await sign(env.CONFIRM_SECRET, payload))) return go("/newsletter/expired/");

  let data;
  try { data = JSON.parse(b64urlToStr(payload)); } catch { return go("/newsletter/expired/"); }
  if (!data || !data.e || !data.x || Date.now() > data.x) return go("/newsletter/expired/");
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return go("/newsletter/error/");

  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email: data.e, unsubscribed: false }),
    },
  );
  if (res.ok) return go("/newsletter/confirmed/");
  const detail = await res.text().catch(() => "");
  if (res.status === 409 || /exist/i.test(detail)) return go("/newsletter/confirmed/");
  console.log("resend add-contact failed", res.status, detail);
  return go("/newsletter/error/");
}

// ───────── confirmation email ─────────
function confirmEmailHtml(url) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE3CF;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFF9EE;border:2.5px solid #1F1812;border-radius:20px;overflow:hidden;font-family:-apple-system,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;">
<tr><td style="background:#C9223A;padding:20px 28px;"><div style="font-size:11px;letter-spacing:.22em;color:#E8C76F;font-weight:700;">VEGAN OJI NEWSLETTER</div><div style="font-size:26px;font-weight:900;color:#FFF9EE;margin-top:4px;">王子通信</div></td></tr>
<tr><td style="height:5px;background:#D4A847;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:26px 30px 6px;"><table role="presentation" width="100%"><tr>
<td width="84" valign="top"><img src="https://veganoji.jp/images/oji/oji_welcoming.png" alt="ビーガン王子" width="74" style="display:block;width:74px;height:auto;"></td>
<td valign="top" style="padding-left:12px;"><p style="margin:0;font-size:15px;line-height:1.9;color:#3C2E22;">ご登録ありがとうございます！🌱<br>下のボタンを押して、登録を完了してください。</p></td>
</tr></table></td></tr>
<tr><td align="center" style="padding:18px 30px 8px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#C9223A" style="border-radius:12px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:-apple-system,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;font-size:15px;font-weight:800;color:#FFF9EE;text-decoration:none;border:2px solid #1F1812;border-radius:12px;">登録を完了する / Confirm →</a>
</td></tr></table></td></tr>
<tr><td style="padding:8px 30px 4px;"><p style="margin:0;font-size:12px;line-height:1.8;color:#786148;">ボタンが押せないときは、このリンクを開いてください：<br><a href="${url}" style="color:#C9223A;word-break:break-all;">${url}</a></p></td></tr>
<tr><td style="padding:14px 30px 0;"><p style="margin:0;font-size:13px;line-height:1.85;color:#3C2E22;">Thanks for signing up! Tap the button above to confirm your subscription to 王子通信 (Vegan Oji Newsletter). This link expires in 48 hours.</p></td></tr>
<tr><td style="padding:18px 30px 26px;"><p style="margin:0;font-size:11px;line-height:1.7;color:#9b8a72;">心当たりがない場合は、このメールを無視してください（登録は完了しません）。<br>If you didn't request this, simply ignore this email.<br>ビーガン王子 ・ <a href="https://veganoji.jp/" style="color:#9b8a72;">veganoji.jp</a></p></td></tr>
</table></td></tr></table>`;
}
function confirmEmailText(url) {
  return [
    "王子通信 / Vegan Oji Newsletter", "",
    "ご登録ありがとうございます！下のリンクを開いて、登録を完了してください。",
    "Thanks for signing up! Open the link below to confirm your subscription.", "",
    url, "",
    "このリンクは48時間で無効になります。/ This link expires in 48 hours.",
    "ビーガン王子 ・ veganoji.jp",
  ].join("\n");
}
