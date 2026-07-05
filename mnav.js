/* ════════ Vegan Oji — mobile hamburger nav (shared) ════════
   Pair with /mnav.css and a <button id="mnav-open" class="mnav-burger"> in the
   bar (add .mnav-float on pages with no header). This script injects the sheet
   markup once and wires open/close/Esc/scroll-lock/smooth-scroll. */
(function () {
  var openBtn = document.getElementById('mnav-open');
  if (!openBtn || document.getElementById('mnav-sheet')) return;

  var sheet = document.createElement('div');
  sheet.id = 'mnav-sheet';
  sheet.className = 'mnav-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'メニュー');
  sheet.innerHTML = `
    <div class="mnav-top">
      <img class="mnav-logo" src="/images/voji-logos/vegan-oji-logo.png" alt="ビーガン王子" />
      <button id="mnav-close" type="button" class="mnav-x" aria-label="閉じる">
        <svg width="20" height="20" viewBox="0 0 20 20"><g stroke="#1F1812" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></g></svg>
      </button>
    </div>

    <div class="mnav-soc" aria-label="SNS">
      <a href="https://instagram.com/veganoji" target="_blank" rel="noopener" aria-label="Instagram"><img src="/images/social/ig.png" alt="" /></a>
      <a href="https://www.youtube.com/@veganoji" target="_blank" rel="noopener" aria-label="YouTube"><img src="/images/social/yt.png" alt="" /></a>
      <a href="https://www.tiktok.com/@veganoji" target="_blank" rel="noopener" aria-label="TikTok"><img src="/images/social/tt.png" alt="" /></a>
      <a href="https://x.com/VeganOji" target="_blank" rel="noopener" aria-label="X"><img src="/images/social/x.png" alt="" /></a>
      <a href="https://www.linkedin.com/in/vegan-oji-alex-derycz/" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="/images/social/li.png" alt="" /></a>
      <a href="https://store.line.me/stickershop/author/veganoji" target="_blank" rel="noopener" aria-label="LINE"><img src="/images/social/line.png" alt="" /></a>
    </div>

    <div class="mnav-label">メニュー</div>
    <div class="mnav-quick">
      <a href="/#top">ホーム</a>
      <a href="/#character">プロフィール</a>
      <a href="/#services">できること</a>
      <a href="/#work">活動</a>
      <a href="/blog/">ブログ</a>
      <a href="/links/">リンク集</a>
    </div>

    <div class="mnav-label">とっておき</div>
    <a class="mnav-card" href="https://veganmapjapan.org" target="_blank" rel="noopener">
      <img src="/images/mascot/map-japan.png" alt="" />
      <span class="b"><span class="t">日本ビーガンマップ</span><span class="s">Japan Vegan Map · 全国2,300店</span></span>
      <span class="c">›</span>
    </a>
    <a class="mnav-card" href="/vegfit/">
      <img src="/images/vegfit/logo-icon.png" alt="" />
      <span class="b"><span class="t">ベジトレClub</span><span class="s">Plant-based fitness</span></span>
      <span class="c">›</span>
    </a>
    <button type="button" class="mnav-card mnav-acc" aria-expanded="false" aria-controls="mnav-why">
      <img src="/images/vegan-to-chikyu/icon-globe-earth.png" alt="" />
      <span class="b"><span class="t">なぜビーガン？</span><span class="s">地球・海・体の3つの物語</span></span>
      <span class="c mnav-chev">›</span>
    </button>
    <div class="mnav-sub" id="mnav-why">
      <a href="/vegan-and-earth/"><img src="/images/vegan-to-chikyu/icon-globe-earth.png" alt="" /><span class="st">ビーガンと地球</span><span class="sg">PLANET</span></a>
      <a href="/fish-and-life/"><img src="/images/vegan-to-chikyu/icon-fish-eyed.png" alt="" /><span class="st">魚の環境といのち</span><span class="sg">OCEAN</span></a>
      <a href="/vegan-and-health/"><img src="/images/vegan-to-chikyu/icon-heart.png" alt="" /><span class="st">ビーガンと健康</span><span class="sg">BODY</span></a>
    </div>

    <div class="mnav-cta">
      <a class="primary" href="/#booking">王子に依頼</a>
      <a class="gold" href="/#donate">応援する</a>
    </div>

    <img class="mnav-oji" src="/images/oji/oji_sleeping_cloud.png" alt="ビーガン王子" loading="lazy" />

    <div class="mnav-lang">
      <span class="lab">言語 / Language</span>
      <button type="button" class="on">🇯🇵 日本語</button>
      <button type="button" class="soon">🇺🇸 English <span class="so">準備中</span></button>
      <button type="button" class="soon">🇫🇷 Français <span class="so">準備中</span></button>
      <button type="button" class="soon">🇪🇸 Español <span class="so">準備中</span></button>
      <button type="button" class="soon">🇩🇪 Deutsch <span class="so">準備中</span></button>
      <button type="button" class="soon">🇨🇳 中文 <span class="so">準備中</span></button>
    </div>`;
  document.body.appendChild(sheet);

  var closeBtn = sheet.querySelector('#mnav-close');
  function set(open) {
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    sheet.classList.toggle('is-open', open);
    document.body.classList.toggle('mnav-lock', open);
  }
  openBtn.addEventListener('click', function () { set(openBtn.getAttribute('aria-expanded') !== 'true'); });
  if (closeBtn) closeBtn.addEventListener('click', function () { set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });

  // "なぜビーガン？" accordion → reveals the 3 story pages (planet / ocean / body)
  var acc = sheet.querySelector('.mnav-acc');
  if (acc) {
    var sub = sheet.querySelector('#' + acc.getAttribute('aria-controls'));
    acc.addEventListener('click', function () {
      var open = acc.getAttribute('aria-expanded') === 'true';
      acc.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (sub) sub.classList.toggle('is-open', !open);
    });
  }

  sheet.querySelectorAll('a[href]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var url = new URL(a.href, location.href);
      if (url.pathname === location.pathname && url.hash) {
        var target = document.querySelector(url.hash);
        if (target) {
          e.preventDefault();
          set(false);
          var y = target.getBoundingClientRect().top + window.pageYOffset - 76;
          setTimeout(function () { window.scrollTo({ top: y, behavior: 'smooth' }); }, 60);
          history.pushState(null, '', url.hash);
          return;
        }
      }
      set(false);
    });
  });
})();
