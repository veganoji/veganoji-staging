# 王子通信 newsletter — setup & activation

The code is built and deployed. These are the **dashboard steps** to switch it on
(it's inert until the env vars are set — like a built-but-not-wired feature).

## What's already done (in code / by Claude)
- **Generator** `tools/gen_newsletter.py` → draft preview at `/newsletter-lab/` (M1).
- **Signup endpoint** (Pages Functions, double opt-in, no DB):
  - `POST /api/subscribe` → validates + emails a confirmation link (honeypot-protected).
  - `GET /api/confirm?token=…` → verifies the signed token, adds the contact to Resend, redirects to a thank-you page.
- **Form wired** on the homepage (footer `#newsletter` + the donate "登録する" button scrolls to it).
- **Thank-you pages**: `/newsletter/confirmed/`, `/newsletter/expired/`, `/newsletter/error/`.
- **Resend audience created**: `王子通信 / Vegan Oji newsletter`
  - **id: `052db315-1c1d-4349-bd4b-8b0d6f900499`**
- Homepage copy updated monthly → **隔週 (bi-weekly)**.

## Steps to activate

### 1. Verify `veganoji.jp` as a Resend sending domain
Resend → Domains → Add `veganoji.jp` (only `ojidigital.com` + `inboxoji.com` are verified today).
Add the DNS records it shows you in **Cloudflare DNS** (DKIM CNAMEs + a `send.veganoji.jp`
MX/SPF for the return-path + DMARC). Wait for "Verified".
- Small list → verifying the **root** domain is fine; Resend isolates bounces on `send.veganoji.jp` automatically.
- If the list grows large, switch to a dedicated subdomain (e.g. `news.veganoji.jp`).

### 2. Pick + create the "From" address (Google Workspace)
`oji@veganoji.jp` does **not** exist yet — `info@veganoji.jp` is the only real mailbox.
Recommended: create a Workspace **alias** so the friendly From is real and replies land in `info@`.
Good options: `oji@`, `hello@`, `prince@`, `letter@`, or just use `info@`.
(Admin console → Users → info@ → Alternate emails, or a group alias.)

### 3. Set Pages environment variables
Pages project → Settings → Environment variables → **Production** (and Preview if you want):

| Name | Type | Value |
|------|------|-------|
| `RESEND_API_KEY` | **Secret** | your Resend key (`~/.config/oji-keys/resend`) |
| `CONFIRM_SECRET` | **Secret** | random string — generate with `openssl rand -hex 32` |
| `RESEND_AUDIENCE_ID` | Plain | `052db315-1c1d-4349-bd4b-8b0d6f900499` |
| `NEWSLETTER_FROM` | Plain | `ビーガン王子 Vegan Oji <oji@veganoji.jp>` (or your chosen address) |
| `NEWSLETTER_REPLY_TO` | Plain | `info@veganoji.jp` |
| `SITE_URL` | Plain | `https://veganoji.jp` |

Redeploy after setting them (or push any commit).

### 4. SPF note (separate hygiene)
Current `veganoji.jp` SPF is `v=spf1 include:_spf.wpcloud.com ~all` — it authorizes
WordPress.com only, **not** Google Workspace. Resend uses its own DKIM/return-path so the
newsletter is fine, but you may want to fix the root SPF for your normal Workspace mail
(e.g. `v=spf1 include:_spf.google.com ~all`). Do this deliberately — don't break sending.

### 5. Test the full loop
1. Submit your own email in the footer form → expect "確認メールを送りました ✉️".
2. Receive the confirmation email → click **登録を完了する** → lands on `/newsletter/confirmed/`.
3. Resend → Audiences → confirm your email now appears in the list.

## Health check (before activation)
`POST /api/subscribe` returns `{"ok":false,"error":"not_configured"}` until step 3 is done —
that means the function is deployed and running, just waiting for secrets.

## Next (M3 — send with approval)
Worker/Function admin route (behind Cloudflare Access) that takes an approved draft from
`tools/gen_newsletter.py` and creates a **Resend Broadcast as a draft** to the audience —
you press send. Unsubscribe/preferences use Resend's managed links (the `{{unsubscribe_url}}`
tokens already in the template).
