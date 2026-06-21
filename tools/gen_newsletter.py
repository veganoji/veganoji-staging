#!/usr/bin/env python3
"""Generate a 王子通信 (Vegan Oji) newsletter DRAFT — email-safe HTML + plaintext.

Milestone 1 of the newsletter system: GENERATE + PREVIEW only. This never sends.
It assembles a draft from the same content the site already maintains, writes it to
the noindex preview lab, and you review / edit / approve before anything goes out
(mirrors the post-creator's approve-before-publish flow).

Reads:
  activity/items.json   -> ① この一週間の王子   (latest N 活動)
  blog/posts.json       -> ② 今週のニュース      (newest pick; hook for the news feed)
  recipes/recipes.json  -> ③ 王子のキッチン      (rotates, featured-first)
  YouTube Data API      -> ④ うごく王子          (latest @veganoji upload, via curl*)
  static links          -> ⑤ いっしょに

Writes (into newsletter-lab/):
  issue-YYYYMMDD.html   dated archive of this draft (full preview page)
  index.html            "latest draft" — stable review URL /newsletter-lab/
  issue-YYYYMMDD.txt    plaintext fallback
  issue-YYYYMMDD.json   machine-readable record of what was picked (for the send step)

* macOS system Python can't verify TLS certs (urllib fails), so the YouTube call
  shells out to `curl`, per the house gotcha. If it fails, the video section is
  omitted gracefully — the draft still builds.

Usage:
  python3 tools/gen_newsletter.py                      # today's draft, auto picks
  python3 tools/gen_newsletter.py --date 2026-06-21    # pin the issue date
  python3 tools/gen_newsletter.py --recipe nasu-miso   # override the recipe pick
  python3 tools/gen_newsletter.py --news fda-approved-cultivated-salmon-hits-san-francisco-restaurant
  python3 tools/gen_newsletter.py --activity 3         # show 3 活動 instead of 2
  python3 tools/gen_newsletter.py --with-bonus         # include サポーター限定 block (future)
"""
import argparse
import html
import json
import pathlib
import subprocess
import sys
from datetime import date, datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
ACTIVITY_JSON = ROOT / "activity" / "items.json"
POSTS_JSON = ROOT / "blog" / "posts.json"
RECIPES_JSON = ROOT / "recipes" / "recipes.json"
OUT_DIR = ROOT / "newsletter-lab"

SITE = "https://veganoji.jp"
SENDER = "oji@veganoji.jp"                         # confirm vs info@veganoji.jp
YT_KEY_FILE = pathlib.Path.home() / ".config" / "oji-keys" / "youtube"
YT_UPLOADS = "UUBlnTs4Ir-70FN1IHMSkI9A"           # @veganoji uploads playlist (UC->UU)

# Issue numbering: anchor + cadence. Bi-weekly to start (ramp to weekly later by
# setting CADENCE_DAYS = 7 — the masthead itself stays cadence-agnostic).
ISSUE_ANCHOR = date(2026, 6, 21)
CADENCE_DAYS = 14

# Free-to-everyone for now; the supporter-bonus variant stays behind this flag
# until the supporter segment + vegfit Stripe sync land (see --with-bonus).
INCLUDE_BONUS_DEFAULT = False

CATEGORY_JP = {
    "shusai": "主菜", "fukusai": "副菜", "gohanmen": "ごはん・麺",
    "shirumono": "汁もの", "sweets": "デザート",
}

# Brand palette (veganoji homepage tokens) — hardcoded hex for email safety.
INK = "#1F1812"; INK_SOFT = "#3C2E22"; PAPER = "#FFF9EE"; CREAM = "#FDF1DA"
ROYAL = "#C9223A"; GOLD = "#D4A847"; GOLD_DEEP = "#9C7E2A"; GOLD_SOFT = "#E8C76F"
MUTED = "#786148"; LEAF = "#6C9560"; LEAF_DEEP = "#3F6A3A"; CANVAS = "#EDE3CF"
FONT = ("-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',"
        "'Hiragino Sans',Meiryo,'Noto Sans JP',sans-serif")


# ─────────────────────────── helpers ───────────────────────────
def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def esc(s):
    return html.escape(s or "", quote=True)


def trim(s, n):
    """Trim to ~n chars on the first line, add an ellipsis if cut."""
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[:n].rstrip() + "…"


def md(datestr):
    """'2026-05-07' -> '5/7'."""
    y, m, d = datestr.split("-")
    return f"{int(m)}/{int(d)}"


def img(path):
    """Root-relative repo path -> absolute prod URL for the email."""
    return SITE + path if path.startswith("/") else path


def issue_number(d):
    return max(1, (d - ISSUE_ANCHOR).days // CADENCE_DAYS + 1)


# ─────────────────────────── content selection ───────────────────────────
def pick_activity(items, n):
    return sorted(items, key=lambda x: x.get("date", ""), reverse=True)[:n]


def pick_news(posts, slug=None, prefer="sekai-no-ugoki"):
    if slug:
        for p in posts:
            if p.get("slug") == slug:
                return p
    pool = [p for p in posts if p.get("category") == prefer] or posts
    return sorted(pool, key=lambda x: x.get("date", ""), reverse=True)[0]


def pick_recipe(recipes, issue, slug=None):
    pub = [r for r in recipes if r.get("published")]
    if slug:
        for r in pub:
            if r.get("slug") == slug:
                return r
    order = [r for r in pub if r.get("featured")] + [r for r in pub if not r.get("featured")]
    return order[(issue - 1) % len(order)] if order else None


def fetch_latest_video():
    try:
        key = YT_KEY_FILE.read_text().strip()
        url = ("https://www.googleapis.com/youtube/v3/playlistItems"
               f"?part=snippet,contentDetails&playlistId={YT_UPLOADS}&maxResults=1&key={key}")
        out = subprocess.run(["curl", "-s", url], capture_output=True,
                             text=True, timeout=25).stdout
        it = json.loads(out)["items"][0]
        sn, cd = it["snippet"], it["contentDetails"]
        th = sn.get("thumbnails", {})
        thumb = (th.get("maxres") or th.get("high") or th.get("medium") or {}).get("url", "")
        return {"title": sn["title"], "videoId": cd["videoId"],
                "url": f"https://www.youtube.com/watch?v={cd['videoId']}", "thumb": thumb}
    except Exception as e:  # noqa: BLE001 — never hard-fail the draft on a fetch issue
        print(f"  ! YouTube fetch failed ({e}); うごく王子 section omitted", file=sys.stderr)
        return None


# ─────────────────────────── HTML building blocks ───────────────────────────
def section_head(eyebrow, title, accent=ROYAL, accent_text=ROYAL):
    return (f'<tr><td style="padding:26px 28px 0;">'
            f'<div style="border-left:5px solid {accent}; padding-left:12px;">'
            f'<div style="font-size:11px; letter-spacing:.16em; color:{accent_text}; font-weight:800;">{eyebrow}</div>'
            f'<div style="font-size:20px; font-weight:900; color:{INK}; margin-top:2px;">{title}</div>'
            f'</div></td></tr>')


def activity_card(a):
    return (
        '<tr><td style="padding:12px 28px 0;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border:2px solid {INK}; border-radius:14px; overflow:hidden;"><tr>'
        f'<td width="168" valign="top" style="padding:0;"><img src="{esc(img(a["hero"]))}" alt="" width="168" style="display:block; width:168px; max-width:168px; height:auto;"></td>'
        '<td valign="top" style="padding:12px 14px;">'
        f'<div style="font-size:11px; color:{MUTED}; font-weight:700;">{esc(a.get("category_display","活動"))} ・ {md(a["date"])}</div>'
        f'<div style="font-size:14.5px; font-weight:800; color:{INK}; line-height:1.5; margin:3px 0 6px;">{esc(trim(a["title"],40))}</div>'
        f'<div style="font-size:12.5px; color:{INK_SOFT}; line-height:1.7;">{esc(trim(a.get("excerpt",""),48))}</div>'
        f'<a href="{esc(a["source"])}" target="_blank" style="display:inline-block; margin-top:7px; font-size:13px; font-weight:800; color:{ROYAL}; text-decoration:none;">読む →</a>'
        '</td></tr></table></td></tr>'
    )


def chip(text):
    return (f'<span style="display:inline-block; font-size:11.5px; font-weight:700; color:#6E5B45; '
            f'background:{CREAM}; border:1px solid #F0DDB0; border-radius:999px; padding:3px 10px; margin:0 4px 4px 0;">{text}</span>')


def button(label, url, bg=ROYAL, fg=PAPER):
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>'
        f'<td align="center" bgcolor="{bg}" style="border-radius:12px;">'
        f'<a href="{esc(url)}" target="_blank" style="display:inline-block; padding:11px 22px; font-family:{FONT}; '
        f'font-size:14px; font-weight:800; color:{fg}; text-decoration:none; border:2px solid {INK}; border-radius:12px;">{label}</a>'
        '</td></tr></table>'
    )


def together_card(bg, title, body, link_label, link, title_c=INK, body_c=INK_SOFT, link_c=ROYAL, pad_r="5px", pad_l="0"):
    return (
        f'<td width="50%" valign="top" style="padding:0 {pad_r} 10px {pad_l};">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{bg}; border:2px solid {INK}; border-radius:12px;"><tr>'
        '<td style="padding:12px 14px;">'
        f'<div style="font-size:14px; font-weight:900; color:{title_c};">{title}</div>'
        f'<div style="font-size:12px; color:{body_c}; line-height:1.6; margin:3px 0 8px;">{body}</div>'
        f'<a href="{esc(link)}" target="_blank" style="font-size:12.5px; font-weight:800; color:{link_c}; text-decoration:none;">{link_label} →</a>'
        '</td></tr></table></td>'
    )


def en_block(eyebrow, body, accent=ROYAL):
    return (f'<tr><td style="padding:14px 28px 0;">'
            f'<div style="font-size:13px; font-weight:900; color:{accent}; letter-spacing:.04em;">{eyebrow}</div>'
            f'<p style="margin:5px 0 0; font-size:13.5px; line-height:1.85; color:{INK_SOFT};">{body}</p></td></tr>')


# ─────────────────────────── assemble the email ───────────────────────────
def build_email(ctx):
    acts = ctx["activity"]; news = ctx["news"]; rec = ctx["recipe"]
    vid = ctx["video"]; iso = ctx["date"]; issue = ctx["issue"]
    dot = iso.replace("-", ".")

    rows = []
    # masthead (cadence-agnostic — no "weekly"/"bi-weekly" baked in)
    rows.append(
        f'<tr><td style="background:{ROYAL}; padding:22px 28px 18px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        '<td valign="top">'
        f'<div style="font-size:11px; letter-spacing:.22em; color:{GOLD_SOFT}; font-weight:700;">VEGAN OJI NEWSLETTER</div>'
        f'<div style="font-size:30px; font-weight:900; color:{PAPER}; line-height:1.1; margin-top:5px;">王子通信</div>'
        '</td><td valign="bottom" align="right">'
        f'<div style="font-size:12px; color:{PAPER}; opacity:.85;">第 {issue} 号</div>'
        f'<div style="font-size:14px; color:{PAPER}; font-weight:800; letter-spacing:.04em;">{dot}</div>'
        '</td></tr></table></td></tr>'
        f'<tr><td style="height:5px; background:{GOLD}; font-size:0; line-height:0;">&nbsp;</td></tr>'
    )
    # intro
    rows.append(
        '<tr><td style="padding:24px 28px 4px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td width="84" valign="top"><img src="{SITE}/images/oji/oji_greeting.png" alt="ビーガン王子" width="74" style="display:block; width:74px; max-width:74px; height:auto;"></td>'
        f'<td valign="top" style="padding-left:12px;"><p style="margin:0; font-size:15px; line-height:1.95; color:{INK_SOFT};">{ctx["intro"]}</p></td>'
        '</tr></table></td></tr>'
    )
    # ① activity
    rows.append(section_head("THIS WEEK ・ 最近のできごと", "この一週間の王子"))
    rows += [activity_card(a) for a in acts]
    if ctx.get("upcoming"):
        rows.append(
            '<tr><td style="padding:12px 28px 0;">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CREAM}; border:2px solid #F0DDB0; border-radius:12px;"><tr>'
            f'<td style="padding:12px 16px; font-size:13px; line-height:1.8; color:{INK_SOFT};">{ctx["upcoming"]}</td>'
            '</tr></table></td></tr>'
        )
    # ② news
    rows.append(section_head("WORLD ・ 世界のうごき", "今週のニュース"))
    rows.append(
        '<tr><td style="padding:14px 28px 0;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border:2px solid {INK}; border-radius:14px; overflow:hidden;">'
        f'<tr><td style="padding:0;"><img src="{esc(img(news["hero"]))}" alt="" width="100%" style="display:block; width:100%; max-width:544px; height:auto;"></td></tr>'
        '<tr><td style="padding:14px 16px 16px;">'
        f'<div style="font-size:11px; color:{MUTED}; font-weight:700;">{esc(news.get("category_display","世界のうごき"))}</div>'
        f'<div style="font-size:16px; font-weight:900; color:{INK}; line-height:1.5; margin:4px 0 7px;">{esc(news["title"])}</div>'
        f'<div style="font-size:13px; color:{INK_SOFT}; line-height:1.8;">{esc(trim(news.get("excerpt",""),70))}</div>'
        f'<a href="{esc(news["source"])}" target="_blank" style="display:inline-block; margin-top:9px; font-size:13px; font-weight:800; color:{ROYAL}; text-decoration:none;">記事を読む →</a>'
        '</td></tr></table></td></tr>'
    )
    # ③ recipe
    rows.append(section_head("KITCHEN ・ 今週の一品", "王子のキッチン", accent=LEAF, accent_text=LEAF_DEEP))
    cat = CATEGORY_JP.get(rec.get("category"), "レシピ")
    tip = (rec.get("tips") or [""])[0]
    rows.append(
        '<tr><td style="padding:14px 28px 0;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border:2px solid {INK}; border-radius:14px; overflow:hidden;">'
        f'<tr><td style="padding:0;"><img src="{esc(img(rec["hero_image_url"]))}" alt="{esc(rec["title_jp"])}" width="100%" style="display:block; width:100%; max-width:544px; height:auto;"></td></tr>'
        f'<tr><td style="padding:14px 16px 4px;"><div style="font-size:17px; font-weight:900; color:{INK};">{esc(rec["title_jp"])}</div>'
        f'<div style="margin:8px 0 2px;">{chip("⏱ "+str(rec.get("time_min",""))+"分")}{chip("🍽 "+esc(rec.get("servings","")))}{chip(cat)}</div></td></tr>'
        '<tr><td style="padding:6px 16px 16px;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2FAEC; border-left:4px solid {LEAF}; border-radius:8px;"><tr>'
        f'<td style="padding:11px 14px; font-size:13px; line-height:1.85; color:{INK_SOFT};">💡 <b>王子のひとこと：</b>{esc(tip)}</td></tr></table>'
        f'{button("レシピを見る →", SITE + "/recipes/", bg=LEAF)}'
        '</td></tr></table></td></tr>'
    )
    # ④ video (optional)
    if vid:
        rows.append(section_head("WATCH ・ 最新動画", "うごく王子"))
        rows.append(
            '<tr><td style="padding:14px 28px 0;">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border:2px solid {INK}; border-radius:14px; overflow:hidden;">'
            f'<tr><td style="padding:0;"><a href="{esc(vid["url"])}" target="_blank" style="text-decoration:none;"><img src="{esc(vid["thumb"])}" alt="最新動画を見る" width="100%" style="display:block; width:100%; max-width:544px; height:auto;"></a></td></tr>'
            f'<tr><td style="padding:14px 16px 16px;"><div style="font-size:15px; font-weight:900; color:{INK}; line-height:1.55;">{esc(vid["title"])}</div>'
            f'{button("▶ YouTube で見る", vid["url"])}</td></tr></table></td></tr>'
        )
    # ⑤ together
    rows.append(section_head("TOGETHER", "いっしょに", accent=GOLD, accent_text=GOLD_DEEP))
    rows.append(
        '<tr><td style="padding:14px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        + together_card("#F2FAEC", "🥦 ベジトレClub", "ベジ × トレ × 仲間。走って、笑って、強くなろう。", "参加する", SITE + "/vegfit/", link_c=LEAF_DEEP, pad_r="5px", pad_l="0")
        + together_card(CREAM, "🧠 ごはんと地球のクイズ", "10問で「しらなかった！」に出会う、やさしいクイズ。", "挑戦する", SITE + "/quiz/", link_c=GOLD_DEEP, pad_r="0", pad_l="5px")
        + '</tr><tr>'
        + together_card("#FFFFFF", "🍳 王子のレシピ", "植物性の和ごはん。今日の一品が、きっと見つかる。", "ひらく", SITE + "/recipes/", link_c=ROYAL, pad_r="5px", pad_l="0")
        + together_card(ROYAL, "👑 応援する", "王子業の次の一歩を、いっしょに。", "応援する", SITE + "/#donate", title_c=PAPER, body_c=GOLD_SOFT, link_c=GOLD_SOFT, pad_r="0", pad_l="5px")
        + '</tr></table></td></tr>'
    )
    # sign-off
    rows.append(
        '<tr><td style="padding:26px 28px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td valign="top" style="padding-right:12px;"><p style="margin:0; font-size:15px; line-height:1.95; color:{INK_SOFT};">{ctx["signoff"]}</p>'
        f'<p style="margin:12px 0 0; font-size:15px; font-weight:900; color:{ROYAL};">— ビーガン王子 アレックス</p></td>'
        f'<td width="92" valign="top" align="right"><img src="{SITE}/images/oji/oji_writing.png" alt="ビーガン王子" width="84" style="display:block; width:84px; max-width:84px; height:auto;"></td>'
        '</tr></table></td></tr>'
    )
    # optional supporter bonus
    if ctx.get("bonus"):
        b = ctx["bonus"]
        rows.append(
            '<tr><td style="padding:18px 28px 0;">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF3DD; border:2.5px solid {GOLD}; border-radius:16px;">'
            f'<tr><td style="padding:16px 18px 4px;" align="center"><div style="font-size:12px; letter-spacing:.14em; color:{GOLD_DEEP}; font-weight:900;">✦ サポーター限定ボーナス ✦</div>'
            f'<div style="font-size:11.5px; color:{GOLD_DEEP};">応援サポーター ＆ ベジトレ会員のみなさんへ</div></td></tr>'
            f'<tr><td style="padding:10px 18px 16px;"><p style="margin:0; font-size:13px; line-height:1.85; color:{INK_SOFT};">{b}</p></td></tr>'
            '</table></td></tr>'
        )
    # english (condensed)
    rows.append('<tr><td style="padding:26px 28px 0;">'
                f'<div style="text-align:center; font-size:11px; letter-spacing:.28em; color:{MUTED}; font-weight:800; border-top:1px dashed #E9D9B5; padding-top:18px;">— ENGLISH —</div></td></tr>')
    rows.append(f'<tr><td style="padding:14px 28px 0;"><p style="margin:0; font-size:14px; line-height:1.9; color:{INK_SOFT};">{ctx["intro_en"]}</p></td></tr>')
    for eb in ctx["en"]:
        rows.append(en_block(eb[0], eb[1], accent=eb[2] if len(eb) > 2 else ROYAL))
    rows.append(f'<tr><td style="padding:16px 28px 0;"><p style="margin:0; font-size:13.5px; line-height:1.85; color:{INK_SOFT};">{ctx["signoff_en"]}<br><b style="color:{ROYAL};">— Vegan Oji, Alex</b></p></td></tr>')
    # footer
    rows.append(
        f'<tr><td style="padding:24px 28px 8px;"><div style="border-top:2px solid #E9D9B5;"></div></td></tr>'
        '<tr><td align="center" style="padding:6px 28px 26px;">'
        f'<img src="{SITE}/images/oji/oji_welcoming.png" alt="" width="58" style="display:block; width:58px; height:auto; margin:0 auto 10px;">'
        f'<div style="font-size:13px; font-weight:900; color:{INK};">ビーガン王子 ・ Vegan Oji</div>'
        f'<div style="font-size:12px; color:{MUTED}; margin-top:5px;"><a href="{SITE}/" target="_blank" style="color:{ROYAL}; text-decoration:none;">veganoji.jp</a> ・ お問い合わせ <a href="mailto:{SENDER}" style="color:{ROYAL}; text-decoration:none;">{SENDER}</a></div>'
        '<div style="font-size:11px; color:#9b8a72; margin-top:12px; line-height:1.8;">'
        'このメールは、veganoji.jp でニュースレターに登録された方にお送りしています。<br>'
        "You're receiving this because you signed up at veganoji.jp.<br>"
        '<a href="{{unsubscribe_url}}" style="color:#9b8a72; text-decoration:underline;">配信を停止する / Unsubscribe</a>'
        '&nbsp;・&nbsp;<a href="{{preferences_url}}" style="color:#9b8a72; text-decoration:underline;">言語・頻度の設定 / Preferences</a><br>'
        '<span style="color:#bcae93;">［差出人住所をここに記載 — 特定電子メール法／CAN-SPAM 対応］</span>'
        '</div></td></tr>'
    )

    body = "\n".join(rows)
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CANVAS};">'
        f'<tr><td align="center" style="padding:18px 12px 28px;">'
        f'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background:{PAPER}; border:2.5px solid {INK}; border-radius:20px; overflow:hidden;">'
        f'{body}</table></td></tr></table>'
    )


def build_text(ctx):
    acts = ctx["activity"]; news = ctx["news"]; rec = ctx["recipe"]; vid = ctx["video"]
    L = [f"王子通信 — 第{ctx['issue']}号 ／ {ctx['date'].replace('-', '.')}",
         "VEGAN OJI NEWSLETTER", "", ctx["intro_plain"], "",
         "──────────────────────", "■ この一週間の王子", "──────────────────────"]
    for a in acts:
        L += [f"・{trim(a['title'], 46)} ({md(a['date'])})", f"  {a['source']}"]
    if ctx.get("upcoming_plain"):
        L.append(f"・{ctx['upcoming_plain']}")
    L += ["", "──────────────────────", "■ 今週のニュース", "──────────────────────",
          news["title"], f"  {news['source']}", "",
          "──────────────────────",
          f"■ 王子のキッチン — {rec['title_jp']}（{rec.get('time_min','')}分／{rec.get('servings','')}）",
          "──────────────────────",
          f"王子のひとこと：{(rec.get('tips') or [''])[0]}",
          f"レシピ一覧 → {SITE}/recipes/", ""]
    if vid:
        L += ["──────────────────────", "■ うごく王子（最新動画）", "──────────────────────",
              vid["title"], f"  {vid['url']}", ""]
    L += ["──────────────────────", "■ いっしょに", "──────────────────────",
          f"ベジトレClub  {SITE}/vegfit/", f"クイズ        {SITE}/quiz/",
          f"レシピ        {SITE}/recipes/", f"応援する      {SITE}/#donate", "",
          ctx["signoff_plain"], "— ビーガン王子 アレックス", "",
          "- - - - - - - - - - - - - - - - - - - -",
          "ENGLISH", ctx["intro_en_plain"], ctx["signoff_en_plain"], "— Vegan Oji, Alex", "",
          "──────────────────────",
          "ビーガン王子 ・ Vegan Oji ・ veganoji.jp",
          "配信停止 / Unsubscribe: {{unsubscribe_url}}",
          "［差出人住所 — 特定電子メール法／CAN-SPAM 対応］"]
    return "\n".join(L)


def build_page(ctx, email_html):
    """Wrap the email in the review page (dev meta band + preview + plaintext)."""
    s_a, s_b = ctx["subjects"]
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>王子通信 第{ctx['issue']}号 — draft preview</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    body{{ margin:0; background:{CANVAS}; font-family:{FONT}; }}
    .meta{{ max-width:600px; margin:24px auto 10px; background:#fff; border:1px solid #d8d2be; border-radius:12px; padding:16px 20px; font-size:13.5px; color:#333; line-height:1.7; }}
    .meta div{{ margin:3px 0; }} .meta b{{ color:#111; }}
    .meta .tag{{ display:inline-block; font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background:{CREAM}; color:{GOLD_DEEP}; border:1px solid {GOLD_SOFT}; margin-right:6px; }}
    .meta .note{{ margin-top:10px; color:#7a7a7a; font-size:12.5px; }}
    .meta hr{{ border:none; border-top:1px dashed #ddd; margin:12px 0; }}
    .frame{{ max-width:600px; margin:0 auto 16px; }}
    details{{ max-width:600px; margin:0 auto 50px; background:#fff; border:1px solid #d8d2be; border-radius:12px; padding:8px 20px; font-size:13px; color:#333; }}
    summary{{ cursor:pointer; font-weight:700; padding:8px 0; }}
    pre.plain{{ white-space:pre-wrap; word-wrap:break-word; font-family:ui-monospace,Menlo,monospace; font-size:12px; line-height:1.6; color:#222; background:#FBF7EE; padding:14px; border-radius:8px; }}
  </style>
</head>
<body>
  <div class="meta">
    <div><b>From:</b> ビーガン王子 Vegan Oji &lt;{SENDER}&gt;</div>
    <div><b>件名 A:</b> {esc(s_a)}</div>
    <div><b>件名 B:</b> {esc(s_b)}</div>
    <div><b>プリヘッダー:</b> {esc(ctx['preheader'])}</div>
    <hr>
    <div><span class="tag">AUTO-GENERATED</span> tools/gen_newsletter.py が生成した draft（第{ctx['issue']}号 ・ {ctx['date']}）。編集してから承認してください。</div>
    <div><span class="tag">LIVE FETCH</span> うごく王子 = YouTube Data API の最新（{esc(ctx['video']['title']) if ctx['video'] else '取得失敗 — 省略'}）。</div>
    <div><span class="tag">🔌 PLUG-IN</span> 今週のニュース枠は news 自動取り込みと差し替え可能（--news SLUG / pick_news で制御）。</div>
    <div class="note">↓ 承認前のサンプル draft。送信していません。差し替え: --recipe / --news / --activity N。</div>
  </div>
  <div class="frame">{email_html}</div>
  <details>
    <summary>📄 プレーンテキスト版（plaintext fallback）を見る</summary>
    <pre class="plain">{esc(ctx['plaintext'])}</pre>
  </details>
</body>
</html>
"""


# ─────────────────────────── voice (editable copy) ───────────────────────────
def voice(ctx):
    rec = ctx["recipe"]; news = ctx["news"]; vid = ctx["video"]
    ctx["intro"] = ("こんにちは、ビーガン王子です🌱<br>東京は、そろそろ梅雨入り。雨の音を聞きながら台所で"
                    "コトコト煮物をするのが、この季節のひそかな楽しみだったりします。")
    ctx["intro_plain"] = ("こんにちは、ビーガン王子です。\n東京はそろそろ梅雨入り。"
                          "雨の音を聞きながら台所でコトコト煮物をするのが、この季節のひそかな楽しみです。")
    ctx["upcoming"] = "📅 <b>来週は 6/28・函館マラソン</b> に出走予定。函館のみなさん、沿道で会えたらうれしいです！"
    ctx["upcoming_plain"] = "[予定] 6/28 函館マラソンに出走します。沿道で会えたらうれしいです！"
    ctx["signoff"] = ("今週も読んでくれて、ありがとう。<br>あなたの一日に、植物のやさしさが少しでも届きますように。"
                      "<br>また次回、お手紙を書きます。")
    ctx["signoff_plain"] = ("今週も読んでくれてありがとう。\nあなたの一日に、植物のやさしさが少しでも届きますように。また次回。")
    ctx["intro_en"] = ("Hi, it's Vegan Oji 🌱 The rainy season is settling over Tokyo, and simmering "
                       "something slow in the kitchen while the rain falls has quietly become a favorite "
                       "ritual this time of year. Here's a little of what's been happening around me.")
    ctx["intro_en_plain"] = "Hi, it's Vegan Oji. Rainy season is here in Tokyo. Here's a little of this issue."
    ctx["signoff_en"] = "Thanks for reading. May a little plant-kindness reach your day. I'll write again soon."
    ctx["signoff_en_plain"] = "Thanks for reading. — Vegan Oji, Alex"
    ctx["en"] = [
        ("THIS WEEK", "Recent activity, plus what's coming up next — say hi if you spot me at a race!"),
        ("WORLD", f'{esc(trim(news["title"],60))} <a href="{esc(news["source"])}" target="_blank" style="color:{ROYAL}; font-weight:700;">Read →</a>'),
        ("KITCHEN", f'<b>{esc(rec["title_jp"])}</b> — {rec.get("time_min","")} min. <a href="{SITE}/recipes/" target="_blank" style="color:{LEAF_DEEP}; font-weight:700;">More recipes →</a>', LEAF_DEEP),
    ]
    if vid:
        ctx["en"].append(("WATCH", f'New video up now. <a href="{esc(vid["url"])}" target="_blank" style="color:{ROYAL}; font-weight:700;">Watch →</a>'))
    ctx["en"].append(("TOGETHER", f'Join <a href="{SITE}/vegfit/" target="_blank" style="color:{LEAF_DEEP}; font-weight:700;">VegFit Club</a> ・ <a href="{SITE}/quiz/" target="_blank" style="color:{GOLD_DEEP}; font-weight:700;">quiz</a> ・ <a href="{SITE}/recipes/" target="_blank" style="color:{ROYAL}; font-weight:700;">recipes</a> ・ <a href="{SITE}/#donate" target="_blank" style="color:{ROYAL}; font-weight:700;">support</a>.', GOLD_DEEP))
    s_a = f"🌱 王子通信 第{ctx['issue']}号｜{rec['title_jp']}と、今週の王子"
    s_b = "ビーガン王子からお手紙が届きました（今週のレシピ＆動画）"
    ctx["subjects"] = (s_a, s_b)
    vt = f"／{trim(vid['title'],14)}" if vid else ""
    ctx["preheader"] = f"今週の王子：{rec['title_jp']}{vt}／函館マラソンまであと少し。"
    if ctx.get("include_bonus"):
        ctx["bonus"] = ("① <b>早期アクセス</b>：このお手紙、いちばん最初にあなたに届いています☺️<br>"
                        "② <b>もう一品レシピ</b>・③ <b>王子の裏話</b>・④ <b>今月の深掘り</b>・⑤ <b>shoutout</b> をここに。")


# ─────────────────────────── main ───────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Generate a 王子通信 newsletter draft (no send).")
    ap.add_argument("--date", help="issue date YYYY-MM-DD (default: today)")
    ap.add_argument("--issue", type=int, help="override issue number")
    ap.add_argument("--activity", type=int, default=2, help="number of 活動 cards (default 2)")
    ap.add_argument("--recipe", help="recipe slug to feature (default: rotate)")
    ap.add_argument("--news", help="blog slug to feature (default: newest 世界のうごき)")
    ap.add_argument("--with-bonus", action="store_true", help="include supporter-bonus block")
    ap.add_argument("--no-youtube", action="store_true", help="skip the YouTube fetch")
    args = ap.parse_args()

    iso = args.date or date.today().isoformat()
    d = date.fromisoformat(iso)
    issue = args.issue or issue_number(d)

    activity = load(ACTIVITY_JSON)
    posts = load(POSTS_JSON)
    recipes = load(RECIPES_JSON)

    rec = pick_recipe(recipes, issue, slug=args.recipe)
    if rec is None:
        sys.exit("No published recipes found.")

    ctx = {
        "date": iso, "issue": issue,
        "activity": pick_activity(activity, args.activity),
        "news": pick_news(posts, slug=args.news),
        "recipe": rec,
        "video": None if args.no_youtube else fetch_latest_video(),
        "include_bonus": args.with_bonus or INCLUDE_BONUS_DEFAULT,
    }
    voice(ctx)

    email_html = build_email(ctx)
    ctx["plaintext"] = build_text(ctx)
    page = build_page(ctx, email_html)

    OUT_DIR.mkdir(exist_ok=True)
    stamp = iso.replace("-", "")
    (OUT_DIR / f"issue-{stamp}.html").write_text(page, encoding="utf-8")
    (OUT_DIR / "index.html").write_text(page, encoding="utf-8")          # latest draft
    (OUT_DIR / f"issue-{stamp}.txt").write_text(ctx["plaintext"], encoding="utf-8")
    record = {
        "issue": issue, "date": iso, "generated_at": datetime.now(timezone.utc).isoformat(),
        "subjects": ctx["subjects"], "preheader": ctx["preheader"],
        "activity": [{"slug": a["slug"], "title": a["title"]} for a in ctx["activity"]],
        "news": {"slug": ctx["news"]["slug"], "title": ctx["news"]["title"]},
        "recipe": {"slug": rec["slug"], "title": rec["title_jp"]},
        "video": ctx["video"], "include_bonus": ctx["include_bonus"],
    }
    (OUT_DIR / f"issue-{stamp}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"王子通信 第{issue}号 ({iso})  →  newsletter-lab/")
    print(f"  • issue-{stamp}.html  +  index.html (latest)")
    print(f"  • issue-{stamp}.txt  (plaintext)  •  issue-{stamp}.json (record)")
    print(f"  recipe: {rec['title_jp']}  |  news: {trim(ctx['news']['title'],30)}  |  "
          f"video: {'✓' if ctx['video'] else '— (omitted)'}  |  bonus: {ctx['include_bonus']}")
    print("  preview → https://veganoji.jp/newsletter-lab/  (after push)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
