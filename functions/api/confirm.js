// GET /api/confirm?token=...  —  double opt-in, step 2.
//
// Verifies the signed token from the confirmation email, then adds the contact
// to the Resend audience. Redirects to a friendly thank-you page either way.
//
// Required env:
//   RESEND_API_KEY      (secret)
//   CONFIRM_SECRET      (secret) — must match the one used in subscribe.js
//   RESEND_AUDIENCE_ID  the "王子通信 / Vegan Oji newsletter" audience id
//   SITE_URL            e.g. "https://veganoji.jp" (optional)

function b64urlToStr(b) {
  b = b.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function bytesToB64url(bytes) {
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
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

export async function onRequestGet({ request, env }) {
  const site = env.SITE_URL || "https://veganoji.jp";
  const seeOther = (path) => Response.redirect(site + path, 302);

  const token = new URL(request.url).searchParams.get("token") || "";
  const dot = token.lastIndexOf(".");
  if (dot < 1) return seeOther("/newsletter/expired/");

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  if (!env.CONFIRM_SECRET) return seeOther("/newsletter/expired/");
  const expected = await sign(env.CONFIRM_SECRET, payload);
  if (!timingSafeEqual(sig, expected)) return seeOther("/newsletter/expired/");

  let data;
  try { data = JSON.parse(b64urlToStr(payload)); } catch { return seeOther("/newsletter/expired/"); }
  if (!data || !data.e || !data.x || Date.now() > data.x) return seeOther("/newsletter/expired/");

  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return seeOther("/newsletter/expired/");

  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email: data.e, unsubscribed: false }),
    },
  );

  // 2xx = added; an "already exists" conflict is also a success from the user's view.
  if (res.ok) return seeOther("/newsletter/confirmed/");
  const detail = await res.text().catch(() => "");
  if (res.status === 409 || /exist/i.test(detail)) return seeOther("/newsletter/confirmed/");
  console.log("resend add-contact failed", res.status, detail);
  return seeOther("/newsletter/error/");
}
