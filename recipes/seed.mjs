#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  Tiny seed script — upserts recipes.json into the Supabase `recipes` table.
//  ⚠️  TODO: NOT WIRED YET. No Supabase project is connected to this site;
//      the live page reads recipes.json directly. This is here so the swap is
//      one command away once a project exists. See recipes/README.md.
//
//  Usage:
//    SUPABASE_URL="https://xxxx.supabase.co" \
//    SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
//    node recipes/seed.mjs
//
//  Requires Node 18+ (global fetch). No npm install needed.
// ════════════════════════════════════════════════════════════════════════
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  console.error('  (Supabase is not wired yet — see recipes/README.md)');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(await readFile(join(here, 'recipes.json'), 'utf8'));

// PostgREST bulk upsert, conflict on the unique slug.
const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?on_conflict=slug`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});

if (!res.ok) {
  console.error('✗ Seed failed:', res.status, await res.text());
  process.exit(1);
}
console.log(`✓ Seeded ${rows.length} recipes into Supabase.`);
