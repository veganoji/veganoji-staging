/* ═══════════════════════════════════════════════════════════════════════
   Shared 認定証 share-card renderer (1080×1920).
   Loaded by the quiz results screen, the sharecard preview, AND the layout
   editor — so all three are guaranteed pixel-identical. Drawn on <canvas>
   (deterministic on every device; html2canvas rendered differently per browser).

   Every position/size lives in LAYOUT below. draw() also records the box it
   drew each element into (window.CertCard.boxes()) so the editor can attach
   drag handles.

   API:  CertCard.draw(score, canvas?, override?) → Promise<canvas>
         CertCard.blob(score, override?)          → Promise<Blob(png)>
         CertCard.LAYOUT   (default coords, clone before editing)
         CertCard.META     (element list for the editor)
         CertCard.boxes()  (bounding boxes from the last draw, canvas coords)
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var W = 1080, H = 1920;
  var ASSETS = {
    frame: '/images/quiz-bg/cert-frame.jpg',
    logo:  '/images/quiz-bg/title.png',
    oji:   '/images/oji/oji_happy.png',
    seal:  '/images/quiz-bg/badge.png'
  };

  // ── every element's placement — this is the single source of truth ──
  var LAYOUT = {
    logo:   { cx: 540, y: 206,  w: 400 },                 // y = top
    title:  { cx: 540, y: 604,  size: 126, gap: 50 },     // y = vertical centre; gap = sparkle spacing
    oji:    { cx: 540, y: 700,  w: 236 },                 // y = top
    score:  { cx: 540, y: 1282, numSize: 210, denSize: 94 }, // y = baseline
    seal:   { cx: 545, cy: 1663, size: 354, rot: -8 },    // cx/cy = centre (big centred stamp, user layout)
    attest: { cx: 540, y: 1327, size: 31 },               // y = baseline
    date:   { cx: 540, y: 1381, size: 37 },               // y = baseline
    url:    { cx: 540, y: 1461, size: 55 }                // y = baseline
  };
  // element metadata for the drag editor (xk/yk = which keys a drag moves)
  var META = [
    { key: 'logo',   label: 'ロゴ',   xk: 'cx', yk: 'y',  sizeKey: 'w' },
    { key: 'title',  label: '認定証', xk: 'cx', yk: 'y',  sizeKey: 'size' },
    { key: 'oji',    label: '王子',   xk: 'cx', yk: 'y',  sizeKey: 'w' },
    { key: 'score',  label: 'スコア', xk: 'cx', yk: 'y',  sizeKey: 'numSize' },
    { key: 'seal',   label: '認定印', xk: 'cx', yk: 'cy', sizeKey: 'size', rotKey: 'rot' },
    { key: 'attest', label: '認定文', xk: 'cx', yk: 'y',  sizeKey: 'size' },
    { key: 'date',   label: '日付',   xk: 'cx', yk: 'y',  sizeKey: 'size' },
    { key: 'url',    label: 'URL',    xk: 'cx', yk: 'y',  sizeKey: 'size' }
  ];

  var cache = {};
  function loadImg(src) {
    if (cache[src]) return cache[src];
    return cache[src] = new Promise(function (res, rej) {
      var i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = function () { res(i); };
      i.onerror = function () { rej(new Error(src)); };
      i.src = src;
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, ov) {                     // per-element shallow merge
    var out = {};
    for (var k in base) {
      out[k] = {};
      for (var p in base[k]) out[k][p] = (ov && ov[k] && ov[k][p] != null) ? ov[k][p] : base[k][p];
    }
    return out;
  }
  function sticker(g, txt, x, y) {                // cream outline behind a red fill
    g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = 13; g.strokeStyle = '#FFFBF0';
    g.strokeText(txt, x, y);
    g.fillStyle = '#C9223A'; g.fillText(txt, x, y);
  }
  function todayStr() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
  // human-friendly saved-file name (shown on desktop download / Files / share targets)
  function filename(score) { return 'ビーガン王子認定証_' + score + '問正解.png'; }

  var lastBoxes = {};

  async function draw(score, canvas, override) {
    var L = merge(LAYOUT, override);
    var ZEN = '"Zen Maru Gothic", sans-serif';
    try {
      await Promise.all([
        document.fonts.load('900 126px ' + ZEN), document.fonts.load('900 210px ' + ZEN),
        document.fonts.load('700 31px ' + ZEN), document.fonts.load('700 40px "Noto Sans JP"')
      ]);
    } catch (e) {}
    var imgs = await Promise.all([loadImg(ASSETS.frame), loadImg(ASSETS.logo), loadImg(ASSETS.oji), loadImg(ASSETS.seal)]);
    var frame = imgs[0], logo = imgs[1], oji = imgs[2], seal = imgs[3];

    var CX = 540;
    var cv = canvas || document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var boxes = {};
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.drawImage(frame, 0, 0, W, H);

    // logo
    var lw = L.logo.w, lh = lw * logo.height / logo.width;
    g.drawImage(logo, L.logo.cx - lw / 2, L.logo.y, lw, lh);
    boxes.logo = { x: L.logo.cx - lw / 2, y: L.logo.y, w: lw, h: lh };

    // 認定証 (sticker) + gold sparkles
    g.textBaseline = 'middle';
    g.font = '900 ' + L.title.size + 'px ' + ZEN;
    var tW = g.measureText('認定証').width;
    sticker(g, '認定証', L.title.cx, L.title.y);
    var spk = Math.round(L.title.size * 0.413);
    g.font = '900 ' + spk + 'px ' + ZEN; g.fillStyle = '#D4A847';
    g.fillText('✦', L.title.cx - tW / 2 - L.title.gap, L.title.y);
    g.fillText('✦', L.title.cx + tW / 2 + L.title.gap, L.title.y);
    var tHalf = tW / 2 + L.title.gap + spk / 2;
    boxes.title = { x: L.title.cx - tHalf, y: L.title.y - L.title.size / 2, w: tHalf * 2, h: L.title.size };

    // prince
    var pw = L.oji.w, ph = pw * oji.height / oji.width;
    g.drawImage(oji, L.oji.cx - pw / 2, L.oji.y, pw, ph);
    boxes.oji = { x: L.oji.cx - pw / 2, y: L.oji.y, w: pw, h: ph };

    // seal — rotated ribbon stamp
    var ss = L.seal.size;
    g.save(); g.translate(L.seal.cx, L.seal.cy); g.rotate(L.seal.rot * Math.PI / 180); g.drawImage(seal, -ss / 2, -ss / 2, ss, ss); g.restore();
    boxes.seal = { x: L.seal.cx - ss / 2, y: L.seal.cy - ss / 2, w: ss, h: ss };

    // score: N (red, outline) + " / 10" (grey), baseline-aligned, centred
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '900 ' + L.score.numSize + 'px ' + ZEN; var numTxt = String(score), numW = g.measureText(numTxt).width;
    g.font = '900 ' + L.score.denSize + 'px ' + ZEN; var denTxt = ' / 10', denW = g.measureText(denTxt).width;
    var sx = CX - (numW + denW) / 2, baseY = L.score.y;   // note: score.cx currently unused (always centred)
    g.font = '900 ' + L.score.numSize + 'px ' + ZEN; sticker(g, numTxt, sx + (L.score.cx - CX), baseY);
    g.font = '900 ' + L.score.denSize + 'px ' + ZEN; g.fillStyle = 'rgba(31,24,18,0.42)'; g.fillText(denTxt, sx + numW + (L.score.cx - CX), baseY);
    g.textAlign = 'center';
    boxes.score = { x: sx + (L.score.cx - CX), y: baseY - L.score.numSize * 0.74, w: numW + denW, h: L.score.numSize * 0.8 };

    // attest / date / url
    g.fillStyle = '#3C2E22'; g.font = '700 ' + L.attest.size + 'px ' + ZEN;
    var at = '上記の成績を収めたことを、ここに認定します。';
    g.fillText(at, L.attest.cx, L.attest.y);
    boxes.attest = { x: L.attest.cx - g.measureText(at).width / 2, y: L.attest.y - L.attest.size * 0.82, w: g.measureText(at).width, h: L.attest.size };

    g.font = '700 ' + L.date.size + 'px ' + ZEN;
    var dt = todayStr();
    g.fillText(dt, L.date.cx, L.date.y);
    boxes.date = { x: L.date.cx - g.measureText(dt).width / 2, y: L.date.y - L.date.size * 0.82, w: g.measureText(dt).width, h: L.date.size };

    g.font = '700 ' + L.url.size + 'px "Noto Sans JP"'; g.fillStyle = '#C9223A';
    var url = 'veganoji.jp/quiz'; g.fillText(url, L.url.cx, L.url.y);
    var uW = g.measureText(url).width; g.strokeStyle = '#C9223A'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(L.url.cx - uW / 2, L.url.y + 12); g.lineTo(L.url.cx + uW / 2, L.url.y + 12); g.stroke();
    boxes.url = { x: L.url.cx - uW / 2, y: L.url.y - L.url.size * 0.82, w: uW, h: L.url.size + 12 };

    lastBoxes = boxes;
    return cv;
  }
  function blob(score, override) {
    return draw(score, null, override).then(function (cv) {
      return new Promise(function (r) { cv.toBlob(r, 'image/png'); });
    });
  }
  window.CertCard = {
    draw: draw, blob: blob, assets: ASSETS, filename: filename,
    LAYOUT: LAYOUT, META: META, W: W, H: H,
    boxes: function () { return clone(lastBoxes); },
    clone: clone
  };
})();
