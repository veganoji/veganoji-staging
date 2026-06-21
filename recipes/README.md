# /recipes/ — ビーガン王子のレシピ

Cute, mobile-first page of simple plant-based **washoku** recipes, hosted by the
ビーガン王子 (Oji). Each recipe card exports a clean 1080×1350 share image.

Stack matches the rest of the site: plain HTML + Tailwind v4 browser CDN + inline
JS, Noto Sans JP, no build step. Export uses html2canvas (same pattern as
`/share-card-lab/`).

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Fetches `recipes.json`, renders the sections (おすすめ + category shelves, horizontal scrollers), detail modal, and the html2canvas export card. |
| `recipes.json` | **Current data source.** Array of recipes in the exact Supabase shape. |
| `schema.sql` | The `recipes` table DDL for Supabase/Postgres. **Not applied yet.** |
| `seed.mjs` | Tiny script to upsert `recipes.json` → Supabase. **Not wired yet.** |

## Data shape

Each recipe (one row of the future `recipes` table):

```jsonc
{
  "id": 1,
  "slug": "spinach-gomaae",
  "title_jp": "ほうれん草の胡麻和え",
  "hero_image_url": "/images/recipes/spinach-gomaae.jpg",
  "category": "fukusai",                       // shusai | fukusai | shirumono | gohanmen | sweets
  "featured": true,                            // optional — also shown in the おすすめ shelf
  "time_min": 10,
  "servings": "2人分",
  "ingredients": [{ "item": "ほうれん草", "amount": "1束（約200g）" }],
  "steps": ["鍋にお湯を沸かし…"],
  "source_name": "Just One Cookbook — …",
  "source_url": "https://…",                   // ✅ every URL fetch-verified
  "tips": ["…Oji's tip…"],
  "created_at": "2026-06-21",
  "published": true
}
```

No furigana (per request): all text is plain Japanese. The export card runs
text through a small normalizer (`cardText`) that swaps full-width parens
（） → () because html2canvas drops the opening （.

Assets: 36 hero photos + 4 chibi-sticker icons (`icon-zairyo`, `icon-tsukurikata`,
`icon-sprout`, `icon-timer`) + 8 watercolor backgrounds live under
`/images/recipes/` (icons are transparent PNG; photos/bgs are JPG). Regenerate
with `.claude/gen-recipes-batch{2,3}.sh`. **Hero uses `bg/bg-1.jpg`, footer uses
`bg/bg-6.jpg`**; the other `bg-N.jpg` options are kept for reuse. (The bg-lab
picker page has been removed now that the backgrounds are chosen.)

## Content / legal

- Recipes are **rewritten in our own words** from real Japanese recipes — no
  source text or photos are copied.
- Hero photos are **our own**, generated with gpt-image-1
  (`.claude/gen-recipes-heroes.sh` → `/images/recipes/<slug>.png`). Re-run that
  script to regenerate or add images.
- Every recipe **credits + links its source**, and every `source_url` was
  fetch-verified to load and match the dish (2026-06-21).
- Two dishes have genuinely contested ratios, handled in Oji's tips rather than
  guessed: **nasu-miso** (miso saltiness varies → taste-adjust) and
  **kinpira-gobo** (mirin/carrot optional — we include both, JOC-style).

## Switch to Supabase (when a project exists)

1. Run `schema.sql` in the Supabase SQL editor.
2. `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node recipes/seed.mjs`
3. In `index.html`, find `loadRecipes()` and swap the `fetch('./recipes.json')`
   line for the Supabase REST call shown in the `TODO(supabase)` comment right
   above it. (Anon key + `?published=eq.true&order=created_at.desc`.)

Until then, edit `recipes.json` and the page updates — no DB needed.

## Go-live checklist

1. ~~Remove the stale `/recipes/ → /blog/ 301` in `_redirects`~~ — **done** (the
   page is now reachable live).
2. **Drop the `noindex`** in `index.html` (`<meta name="robots" ...>`) when fully
   launching. Kept ON for now — the page is live-but-unindexed for iteration.
3. Optional: add `/recipes/` to `sitemap.xml` and a nav entry in `mnav.js`.
