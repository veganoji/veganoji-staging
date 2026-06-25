# Blog banner generator — "Editorial #2"

The standard Vegan Oji blog hero/thumbnail banner: a full-bleed photo (or video
thumbnail) with a bottom gradient scrim, a category-coloured pill, a `VEGANOJI.JP`
eyebrow, a kicker + two-line headline, and the chibi prince mascot. **1200×900**
(your standard blog thumbnail size — cards are `aspect-ratio:4/3 object-fit:contain`).

This replaced the older centred-band banner. Design chosen 2026-06-25.

## Files
- **`banner.html`** — the template. Pure HTML/CSS/JS, driven by URL query params. Open it
  in a browser to preview live (e.g. `/tools/banner/banner.html?cat=katsudou&title=...`).
- **`../gen_banner.mjs`** — rasterizes the template to a PNG (spawns its own static server
  + headless Chrome; needs only Node 18+ and Chrome).

## Generate a banner
```sh
node tools/gen_banner.mjs \
  --out images/blog/2026/<slug>.png \
  --cat sekai-no-ugoki \
  --title "肉なしで、|こんなに強い。" \         # "|" = line break (keep to 2 lines)
  --kicker "ビーガン vs 肉食、どっちが強い？" \   # optional small line above the title
  --photo "https://i.ytimg.com/vi/<id>/maxresdefault.jpg" \
  --mascot "/images/oji/oji_confident.png" \    # optional; "none" hides it
  --play 1 \                                    # 1 = show ▶ badge (video posts); 0 = hide
  --focus "center 28%"                          # optional photo crop position
```

For a YouTube post, the photo is the video thumbnail: `https://i.ytimg.com/vi/<VIDEO_ID>/maxresdefault.jpg`.

## Category colours (accent = pill + kicker tint)
| slug | colour | label |
|------|--------|-------|
| `sekai-no-ugoki`    | `#FFD661` yellow | 世界のうごき |
| `kenkyushitsu-kara` | `#3F6A3A` green  | 研究室から |
| `oji-no-kurashi`    | `#9C7E2A` gold   | 王子の暮らし |
| `oji-no-tabearuki`  | `#E55063` coral  | 王子の食べ歩き |
| `katsudou`          | `#C9223A` red    | 活動報告 |

Note: news (`sekai-no-ugoki`) banners are **yellow** by preference, while the post-page
category *chip* is red `#C9223A`. Unify in `blog/index.html` (`.cat-sekai-no-ugoki` +
`CAT_COLORS`) and here if you ever want them to match.
