// POST /api/subscribe  —  double opt-in, step 1.
//
// Validates the email and emails a confirmation link. NOTHING is added to the
// Resend list here — the contact is only created after they click the link
// (see /api/confirm). The pending signup rides in a signed (HMAC) token, so
// there is no database to maintain. This is the capture half of newsletter M2.
//
// Required env (set in the Pages project → Settings → Environment variables):
//   RESEND_API_KEY      Resend API key (secret)
//   CONFIRM_SECRET      random string used to sign the confirm token (secret)
//   NEWSLETTER_FROM     e.g. "ビーガン王子 Vegan Oji <oji@veganoji.jp>"   (optional)
//   NEWSLETTER_REPLY_TO e.g. "info@veganoji.jp"                            (optional)
//   SITE_URL            e.g. "https://veganoji.jp"                          (optional)

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }

  // Honeypot: real users never fill this. Pretend success so bots learn nothing.
  if (body.hp) return json({ ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  const lang = ["ja", "en", "both"].includes(body.lang) ? body.lang : "both";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 422);

  if (!env.RESEND_API_KEY || !env.CONFIRM_SECRET) {
    // Endpoint is deployed but not yet activated — see newsletter-lab/SETUP.md
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const exp = Date.now() + 1000 * 60 * 60 * 48; // 48h
  const payload = strToB64url(JSON.stringify({ e: email, l: lang, x: exp }));
  const token = `${payload}.${await sign(env.CONFIRM_SECRET, payload)}`;

  const site = env.SITE_URL || "https://veganoji.jp";
  const confirmUrl = `${site}/api/confirm?token=${encodeURIComponent(token)}`;
  const from = env.NEWSLETTER_FROM || "ビーガン王子 Vegan Oji <oji@veganoji.jp>";
  const replyTo = env.NEWSLETTER_REPLY_TO || "info@veganoji.jp";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      reply_to: replyTo,
      to: email,
      subject: "【ご確認ください】王子通信のご登録 / Confirm your Vegan Oji subscription",
      html: confirmEmailHtml(confirmUrl),
      text: confirmEmailText(confirmUrl),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.log("resend send failed", res.status, detail);
    return json({ ok: false, error: "send_failed" }, 502);
  }
  return json({ ok: true });
}

// Reject non-POST cleanly.
export const onRequest = ({ request }) =>
  request.method === "POST" ? undefined : json({ ok: false, error: "method_not_allowed" }, 405);

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
<tr><td style="padding:18px 30px 26px;"><p style="margin:0;font-size:11px;line-height:1.7;color:#9b8a72;">心当たりがない場合は、このメールを無視してください（登録は完了しません）。<br>If you didn't request this, simply ignore this email — no subscription will be created.<br>ビーガン王子 ・ <a href="https://veganoji.jp/" style="color:#9b8a72;">veganoji.jp</a></p></td></tr>
</table></td></tr></table>`;
}

function confirmEmailText(url) {
  return [
    "王子通信 / Vegan Oji Newsletter",
    "",
    "ご登録ありがとうございます！下のリンクを開いて、登録を完了してください。",
    "Thanks for signing up! Open the link below to confirm your subscription.",
    "",
    url,
    "",
    "このリンクは48時間で無効になります。/ This link expires in 48 hours.",
    "心当たりがない場合は無視してください。/ If you didn't request this, ignore this email.",
    "ビーガン王子 ・ veganoji.jp",
  ].join("\n");
}
