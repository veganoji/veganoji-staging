#!/usr/bin/env python3
"""Regenerate blog/feed.xml from blog/posts.json (the no-build blog's RSS).

This is the canonical feed generator for the veganoji blog. posts.json is the
source of truth for both content and ordering; this script mirrors that order
into an RSS 2.0 feed that matches the hand-maintained format byte-for-byte
(only <lastBuildDate> changes between runs).

Usage:
  python3 tools/gen_feeds.py            # rewrite blog/feed.xml in place
  python3 tools/gen_feeds.py --check    # print diff vs current feed, write nothing
"""
import json
import sys
import pathlib
from datetime import datetime, timezone, timedelta

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "blog" / "posts.json"
FEED_XML = ROOT / "blog" / "feed.xml"

# --- channel constants (must match the live feed exactly) ---------------------
BASE = "https://veganoji-staging.ojidigital.com"
CH_TITLE = "王子通信 — ビーガン王子のブログ"
CH_DESC = ("ビーガン、食、環境、多文化のことを、王子の言葉で発信。"
           "世界のうごき／研究室から／王子の暮らし／王子の食べ歩き。")

WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}


def rfc822_from_date(datestr: str) -> str:
    """'2026-01-20' -> 'Tue, 20 Jan 2026 00:00:00 +0000' (locale-independent)."""
    y, m, d = (int(x) for x in datestr.split("-"))
    dt = datetime(y, m, d, tzinfo=timezone.utc)
    return f"{WD[dt.weekday()]}, {d:02d} {MO[m - 1]} {y} 00:00:00 +0000"


def rfc822_now() -> str:
    dt = datetime.now(timezone.utc)
    return (f"{WD[dt.weekday()]}, {dt.day:02d} {MO[dt.month - 1]} {dt.year} "
            f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} +0000")


def mime_for(hero: str) -> str:
    ext = hero.rsplit(".", 1)[-1].lower() if "." in hero else ""
    return MIME.get(ext, "image/png")


def item_block(p: dict) -> str:
    slug = p["slug"]
    link = f"{BASE}/blog/?post={slug}"
    lines = [
        "    <item>",
        f"      <title><![CDATA[{p.get('title', '')}]]></title>",
        f"      <link>{link}</link>",
        f'      <guid isPermaLink="true">{link}</guid>',
        f"      <pubDate>{rfc822_from_date(p['date'])}</pubDate>",
        f"      <description><![CDATA[{p.get('excerpt', '')}]]></description>",
        f"      <category><![CDATA[{p.get('category_display', '')}]]></category>",
    ]
    hero = p.get("hero")
    if hero:
        lines.append(f'      <enclosure url="{hero}" type="{mime_for(hero)}"/>')
    lines.append("    </item>")
    return "\n".join(lines)


def build_feed(posts: list, build_date: str) -> str:
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
        'xmlns:content="http://purl.org/rss/1.0/modules/content/">\n'
        "  <channel>\n"
        f"    <title><![CDATA[{CH_TITLE}]]></title>\n"
        f"    <link>{BASE}/blog/</link>\n"
        f"    <description><![CDATA[{CH_DESC}]]></description>\n"
        "    <language>ja</language>\n"
        f'    <atom:link href="{BASE}/blog/feed.xml" rel="self" type="application/rss+xml"/>\n'
        f"    <lastBuildDate>{build_date}</lastBuildDate>\n"
    )
    body = "\n".join(item_block(p) for p in posts)
    return header + body + "\n  </channel>\n</rss>\n"


def strip_build_date(xml: str) -> str:
    return "\n".join(l for l in xml.splitlines() if "<lastBuildDate>" not in l)


def main() -> int:
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    # Scheduled drip: never list a future-dated (not-yet-published) post in the feed.
    today_jst = (datetime.now(timezone.utc) + timedelta(hours=9)).date().isoformat()
    posts = [p for p in posts if p.get("date", "") <= today_jst]
    check = "--check" in sys.argv

    if check:
        current = FEED_XML.read_text(encoding="utf-8") if FEED_XML.exists() else ""
        # reuse the current build date so only real content diffs show
        cur_bd = next((l.split(">")[1].split("<")[0]
                       for l in current.splitlines() if "<lastBuildDate>" in l), rfc822_now())
        regen = build_feed(posts, cur_bd)
        if strip_build_date(current) == strip_build_date(regen):
            print(f"OK — regenerated feed matches current feed.xml ({len(posts)} items, "
                  "ignoring lastBuildDate).")
            return 0
        import difflib
        diff = difflib.unified_diff(current.splitlines(), regen.splitlines(),
                                    "current", "regenerated", lineterm="")
        print("\n".join(diff))
        return 1

    FEED_XML.write_text(build_feed(posts, rfc822_now()), encoding="utf-8")
    print(f"wrote {FEED_XML.relative_to(ROOT)} ({len(posts)} items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
