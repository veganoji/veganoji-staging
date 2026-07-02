/* ═══════════════════════════════════════════════════════════════════════
   Shared 認定証 share-card renderer (1080×1920).
   Loaded by BOTH the quiz results screen and /quiz-sharecard-lab/certificate
   so the two are guaranteed pixel-identical. Drawn on <canvas> (deterministic
   on every device — html2canvas rendered differently on iPhone vs desktop).
   API:  window.CertCard.draw(score, canvas?) → Promise<canvas>
         window.CertCard.blob(score)          → Promise<Blob(png)>
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var ASSETS = {
    frame: '/images/quiz-bg/cert-frame.jpg',
    logo:  '/images/quiz-bg/title.png',
    oji:   '/images/oji/oji_happy.png',
    seal:  '/images/quiz-bg/badge.png'
  };
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
  // cream outline behind a red fill = the "sticker on paper" look
  function sticker(g, txt, x, y) {
    g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = 13; g.strokeStyle = '#FFFBF0';
    g.strokeText(txt, x, y);
    g.fillStyle = '#C9223A'; g.fillText(txt, x, y);
  }
  function todayStr() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }

  // Draw onto `canvas` (or a fresh one). Resolves with the canvas.
  async function draw(score, canvas) {
    var ZEN = '"Zen Maru Gothic", sans-serif';
    // canvas silently falls back if the webfont isn't loaded yet
    try {
      await Promise.all([
        document.fonts.load('900 126px ' + ZEN),
        document.fonts.load('900 210px ' + ZEN),
        document.fonts.load('700 31px ' + ZEN),
        document.fonts.load('700 40px "Noto Sans JP"')
      ]);
    } catch (e) {}
    var imgs = await Promise.all([loadImg(ASSETS.frame), loadImg(ASSETS.logo), loadImg(ASSETS.oji), loadImg(ASSETS.seal)]);
    var frame = imgs[0], logo = imgs[1], oji = imgs[2], seal = imgs[3];

    var W = 1080, H = 1920, CX = 540;
    var cv = canvas || document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';

    g.drawImage(frame, 0, 0, W, H);

    // logo
    var lw = 400, lh = lw * logo.height / logo.width;
    g.drawImage(logo, CX - lw / 2, 206, lw, lh);

    // 認定証 (sticker) + gold sparkles
    g.textBaseline = 'middle';
    g.font = '900 126px ' + ZEN;
    var tW = g.measureText('認定証').width;
    sticker(g, '認定証', CX, 604);
    g.font = '900 52px ' + ZEN; g.fillStyle = '#D4A847';
    g.fillText('✦', CX - tW / 2 - 50, 604);
    g.fillText('✦', CX + tW / 2 + 50, 604);

    // prince
    var pw = 236, ph = pw * oji.height / oji.width;
    g.drawImage(oji, CX - pw / 2, 700, pw, ph);

    // seal — rotated ribbon stamp beside the score
    g.save(); g.translate(802, 1180); g.rotate(-8 * Math.PI / 180); g.drawImage(seal, -108, -108, 216, 216); g.restore();

    // score: N (red, outline) + " / 10" (grey), baseline-aligned, centred
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '900 210px ' + ZEN; var numTxt = String(score), numW = g.measureText(numTxt).width;
    g.font = '900 94px ' + ZEN; var denTxt = ' / 10', denW = g.measureText(denTxt).width;
    var sx = CX - (numW + denW) / 2, baseY = 1282;
    g.font = '900 210px ' + ZEN; sticker(g, numTxt, sx, baseY);
    g.font = '900 94px ' + ZEN; g.fillStyle = 'rgba(31,24,18,0.42)'; g.fillText(denTxt, sx + numW, baseY);
    g.textAlign = 'center';

    // attest (canvas-default tight spacing) / date / url
    g.fillStyle = '#3C2E22'; g.font = '700 31px ' + ZEN;
    g.fillText('上記の成績を収めたことを、ここに認定します。', CX, 1372);
    g.font = '700 37px ' + ZEN;
    g.fillText(todayStr(), CX, 1430);
    g.font = '700 40px "Noto Sans JP"'; g.fillStyle = '#C9223A';
    var url = 'veganoji.jp/quiz'; g.fillText(url, CX, 1494);
    var uW = g.measureText(url).width; g.strokeStyle = '#C9223A'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(CX - uW / 2, 1506); g.lineTo(CX + uW / 2, 1506); g.stroke();

    return cv;
  }
  function blob(score) {
    return draw(score).then(function (cv) {
      return new Promise(function (r) { cv.toBlob(r, 'image/png'); });
    });
  }
  window.CertCard = { draw: draw, blob: blob, assets: ASSETS };
})();
