# 王子通信 newsletter — setup & status

## Architecture (decided after probing the live site)
veganoji.jp is served by a **Worker**, not a Cloudflare Pages project (there is no
Pages project for it), so a `functions/` dir would never run. The signup endpoint is
therefore a **standalone Worker** — same pattern as almostjp / castingoji / distributors.

```
homepage form  ──POST /subscribe──▶  veganoji-newsletter (Worker)  ──▶ Resend: send confirm email
   visitor clicks confirm link  ──GET /confirm──▶  same Worker  ──▶ Resend: add contact to audience
                                                                  └─▶ redirect to /newsletter/confirmed/
```
Double opt-in, no database: the pending signup rides in a signed (HMAC) token.

## ✅ Live & tested
- **Worker**: `veganoji-newsletter` → `https://veganoji-newsletter.alexderycz.workers.dev`
  (source: `newsletter-worker/`). Secrets `RESEND_API_KEY` + `CONFIRM_SECRET` are set.
- **Resend audience**: `王子通信 / Vegan Oji newsletter` → id `052db315-1c1d-4349-bd4b-8b0d6f900499`
- **Homepage form** posts to the Worker (footer `#newsletter` + donate "登録する" scrolls to it). Honeypot added.
- **Thank-you pages**: `/newsletter/confirmed/`, `/newsletter/expired/`, `/newsletter/error/`
- Copy reconciled monthly → **隔週 (bi-weekly)**.
- End-to-end verified (sink addresses, contact added then deleted): health, send, confirm→add, CORS, error paths.

## ⚠️ Two follow-ups before public launch
1. **Brand the sender.** Right now the confirmation email is sent **from `oji@ojidigital.com`**
   (the only veganoji-relevant domain verified in Resend). To send from `@veganoji.jp`:
   - Resend → Domains → add **`veganoji.jp`** → add the DKIM/return-path DNS records it gives you
     in Cloudflare DNS → wait "Verified".
   - Create a Google Workspace alias (e.g. `oji@veganoji.jp` → forwards to `info@`), or use `info@`.
   - Update the Worker var and redeploy:
     `newsletter-worker/wrangler.jsonc` → `NEWSLETTER_FROM: "ビーガン王子 Vegan Oji <oji@veganoji.jp>"`
     then `cd newsletter-worker && npx wrangler deploy`.
   - **Email address answer:** `oji@veganoji.jp` did **not** exist (I invented it for the sample);
     `info@veganoji.jp` is the only real mailbox. Good friendly options: `oji@`, `hello@`,
     `prince@`, `letter@` — all easy aliases to `info@`.
2. **(Optional) Clean endpoint domain.** The form currently calls the `*.workers.dev` URL
   (cross-origin, works fine via CORS). For a tidy same-brand endpoint, map a route/subdomain
   like `news.veganoji.jp` to the Worker (needs a DNS record on the veganoji.jp zone — dashboard,
   since the local token is zone-read-only here), then update `ENDPOINT` in `index.html` and
   `ALLOWED_ORIGINS` in `wrangler.jsonc`.

## SPF note (separate hygiene)
`veganoji.jp` SPF is `v=spf1 include:_spf.wpcloud.com ~all` — authorizes WordPress.com only,
not Google Workspace. Resend uses its own DKIM/return-path so the newsletter is unaffected, but
you may want to fix the root SPF for normal Workspace mail (deliberately — don't break sending).

## Operate the Worker
- Logs: `cd newsletter-worker && npx wrangler tail`
- Change a var: edit `wrangler.jsonc` → `npx wrangler deploy`
- Rotate a secret: `printf %s "VALUE" | npx wrangler secret put NAME`

## Next (M3 — send with approval)
Admin route (behind Cloudflare Access) that takes an approved draft from
`tools/gen_newsletter.py` and creates a **Resend Broadcast as a draft** to the audience —
you press send. Unsubscribe/preferences use Resend's managed links (the `{{unsubscribe_url}}`
tokens are already in the template).
