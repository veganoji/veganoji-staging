#!/usr/bin/env node
// Render tools/banner/banner.html (the category-coloured "Editorial #2" blog banner)
// to a 1200×900 PNG. Self-contained: serves the repo over a tiny static server, lets
// headless Chrome screenshot it, and downscales with `sips`. macOS + Chrome + Node 18+.
//
// Uses Chrome's one-shot `--screenshot` (NOT the devtools protocol) — on this machine
// Node runs under Rosetta and CDP screenshots are unreliable, so we force Chrome
// arm64-native and let it render+exit on its own.
//
// Usage:
//   node tools/gen_banner.mjs \
//     --out images/blog/2026/<slug>.png \
//     --cat sekai-no-ugoki \
//     --title "肉なしで、|こんなに強い。" \         # "|" = line break (keep to 2 lines)
//     --kicker "ビーガン vs 肉食、どっちが強い？" \  # optional
//     --photo "https://i.ytimg.com/vi/<id>/maxresdefault.jpg" \
//     --mascot "/images/oji/oji_confident.png" \    # optional; "none" hides
//     --play 1 \                                    # 0 hides the ▶ badge
//     --focus "center 28%"
//
// cat ∈ sekai-no-ugoki | kenkyushitsu-kara | oji-no-kurashi | oji-no-tabearuki | katsudou
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SRV_PORT = 8791;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- args ---
const A = {};
for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!A.out) { console.error('error: --out <path> is required'); process.exit(1); }
const qs = new URLSearchParams();
for (const k of ['cat', 'title', 'kicker', 'photo', 'mascot', 'focus', 'eyebrow', 'play']) if (A[k] != null) qs.set(k, A[k]);
const URL = `http://localhost:${SRV_PORT}/tools/banner/banner.html?${qs.toString()}`;
const TMP = `/tmp/oji-banner-2x-${process.pid}.png`;
const PROFILE = `/tmp/oji-banner-prof-${process.pid}`;
const OUT = resolve(ROOT, A.out);

// --- tiny static server (repo root) ---
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const buf = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    res.writeHead(200, { 'content-type': MIME[extname(req.url.split('?')[0])] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(SRV_PORT, r));

function run(cmd, args) { return new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: 'ignore' });
  const t = setTimeout(() => { try { p.kill(); } catch {} res('timeout'); }, 35000);
  p.on('exit', code => { clearTimeout(t); res(code); });
  p.on('error', rej);
}); }

try {
  rmSync(TMP, { force: true });
  // arch -arm64 → render native (Rosetta-spawned x64 Chrome is unstable); --screenshot exits on its own
  await run('arch', ['-arm64', CHROME, '--headless=new', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--window-size=1200,900', '--virtual-time-budget=15000',
    `--user-data-dir=${PROFILE}`, `--screenshot=${TMP}`, URL]);
  if (!existsSync(TMP)) throw new Error('Chrome did not produce a screenshot');
  // 2400×1800 → 1200×900 (sips ships with macOS; -z is height width)
  await run('sips', ['-z', '900', '1200', TMP, '--out', OUT]);
  if (!existsSync(OUT)) throw new Error('sips resize failed');
  console.log('wrote', A.out, '(1200×900)  cat=' + (A.cat || 'sekai-no-ugoki'));
} catch (e) {
  console.error('FAILED:', e.message); server.close();
  rmSync(TMP, { force: true }); rmSync(PROFILE, { recursive: true, force: true });
  process.exit(1);
}
server.close();
rmSync(TMP, { force: true }); rmSync(PROFILE, { recursive: true, force: true });
process.exit(0);
