# /recipes/ — ビーガン王子のレシピ

Cute, mobile-first page of simple plant-based **washoku** recipes, hosted by the
ビーガン王子 (Oji). Each recipe card exports a clean 1080×1350 share image.

Stack matches the rest of the site: plain HTML + Tailwind v4 browser CDN + inline
JS, Noto Sans JP, no build step. Export uses html2canvas (same pattern as
`/share-card-lab/`).

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Fetches `recipes.json`, renders the grid + filters, detail modal, and the html2canvas export card. |
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
  "time_min": 10,
  "servings": "2人分",
  "ingredients": [{ "item": "…ruby html…", "amount": "…ruby html…" }],
  "steps": ["…ruby html…"],
  "source_name": "Just One Cookbook — …",
  "source_url": "https://…",                   // ✅ every URL fetch-verified
  "tips": ["…ruby html…"],                     // Oji's tips
  "created_at": "2026-06-21",
  "published": true
}
```

No furigana (per request): all text is plain Japanese. The export card runs
text through a small normalizer (`cardText`) that swaps full-width parens
（） → () because html2canvas drops the opening （.

Assets: 18 hero photos + 3 chibi-sticker section icons (`icon-zairyo`,
`icon-tsukurikata`, `icon-sprout`) + 8 watercolor hero backgrounds live under
`/images/recipes/` (icons are transparent PNG; photos/bgs are JPG). Regenerate
with `.claude/gen-recipes-batch2.sh`. Pick the hero background in
`/recipes/bg-lab/` and set the `bg-N.jpg` filename in `index.html`.

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

## ⚠️ Go-live checklist (do these when ready to publish — left undone on purpose)

These touch **shared root files** outside `/recipes/`, left untouched so this
build doesn't collide with the parallel `/quiz/` build:

1. **Remove the stale redirect.** `_redirects` still has a line from the old
   WordPress retirement:
   ```
   /recipes/  /blog/  301
   ```
   It will redirect the new page away. Delete that one line.
   (Local preview ignores `_redirects`, so the page tested fine without this.)
2. **Drop the `noindex`.** `index.html` has
   `<meta name="robots" content="noindex, nofollow" />` while building — remove
   it to let the page be indexed.
3. Optional: add `/recipes/` to `sitemap.xml` and a nav entry in `mnav.js`.
