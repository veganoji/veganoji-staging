/* ════════════════════════════════════════════════════════════════════════
   Vegan Oji — shared bottom-of-page navigation card.
   Drop into ANY page with two lines:
       <div id="oji-footer-nav"></div>
       <script src="/oji-footer.js" defer></script>
   Edit THIS file once → the card updates on every page that includes it.
   (If the <div> is omitted, the card auto-inserts just before the page's
    <footer>.) Self-contained: injects its own <style>, no dependencies
    except Noto Sans JP, which every page already loads.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  if (document.getElementById('ojf-style')) return; // guard against double-include

  // ---- Stripe support links — product "支援金額" (verified active, JPY, monthly recurring).
  //      NOT the ベジトレClub product. Edit here to change the support tiers. ----
  var STRIPE = {
    t500:  'https://buy.stripe.com/6oU5kC6QadQT39xf0Lao80e', // ¥500/月  (price_1TlMd5…)
    t1000: 'https://buy.stripe.com/7sI03zbyj33T7WE144',      // ¥1,000/月 (price_1OfzCL…)
    t2000: 'https://buy.stripe.com/00g03z59Vawl2Ck8wx'       // ¥2,000/月 (price_1OfzIK…)
  };

  var css = `
  .ojf-card{box-sizing:border-box;max-width:440px;margin:0 auto;
    font-family:"Noto Sans JP",sans-serif;color:#1F1812;text-align:left;
    background:#FFF9EE;border:3px solid #1F1812;border-radius:28px;
    box-shadow:7px 7px 0 #1F1812;padding:24px 18px 26px;}
  .ojf-card *{box-sizing:border-box;}
  .ojf-h{text-align:center;font-size:22px;font-weight:900;margin:0 0 14px;}
  .ojf-social{display:flex;justify-content:center;gap:14px;margin-bottom:20px;}
  .ojf-social a{display:block;transition:transform .15s ease;}
  .ojf-social a:hover{transform:translateY(-3px) scale(1.08);}
  .ojf-social img{width:42px;height:42px;object-fit:contain;display:block;}
  .ojf-btn{display:flex;align-items:center;gap:14px;width:100%;border:2.5px solid #1F1812;
    border-radius:18px;box-shadow:4px 4px 0 #1F1812;padding:14px 18px;text-decoration:none;color:#fff;
    margin-bottom:13px;font-weight:900;font-size:17px;
    transition:transform .14s ease,box-shadow .14s ease,filter .14s ease;}
  .ojf-btn:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 #1F1812;filter:brightness(1.06) saturate(1.05);}
  .ojf-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 #1F1812;}
  .ojf-btn img{width:46px;height:46px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.22));}
  .ojf-btn .ojf-ar{margin-left:auto;font-size:19px;opacity:.9;}
  .ojf-recipe{background:linear-gradient(135deg,#86AD79,#3F6A3A);}
  .ojf-map{background:linear-gradient(135deg,#E8C76F,#B98F2E);}
  .ojf-vegfit{background:linear-gradient(135deg,#A3C49A,#5C8451);}
  .ojf-sectitle{text-align:center;font-size:18px;font-weight:900;color:#1F1812;margin:14px 0 12px;}
  .ojf-tri{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px;margin-bottom:6px;}
  .ojf-tri a{display:flex;flex-direction:column;align-items:center;gap:6px;border:2.5px solid #1F1812;
    border-radius:16px;box-shadow:3px 3px 0 #1F1812;padding:14px 4px 12px;text-decoration:none;color:#fff;
    transition:transform .14s ease,box-shadow .14s ease,filter .14s ease;}
  .ojf-tri a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 #1F1812;filter:brightness(1.07);}
  .ojf-tri a:active{transform:translate(3px,3px);box-shadow:0 0 0 #1F1812;}
  .ojf-tri img{width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.22));}
  .ojf-tri .ojf-t{font-size:14px;font-weight:900;}
  .ojf-tri .ojf-g{font-size:9px;font-weight:700;letter-spacing:.12em;opacity:.8;}
  .ojf-earth{background:linear-gradient(135deg,#86AD79,#3F6A3A);}
  .ojf-ocean{background:linear-gradient(135deg,#5AA0CE,#1B5C8B);}
  .ojf-body{background:linear-gradient(135deg,#E5728A,#9C1428);}
  .ojf-duo{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:13px;}
  .ojf-duo .ojf-btn{margin-bottom:0;font-size:15px;gap:9px;padding:13px 12px;}
  .ojf-duo .ojf-btn img{width:38px;height:38px;}
  .ojf-news{background:linear-gradient(135deg,#9477B5,#574277);}
  .ojf-report{background:linear-gradient(135deg,#E0915A,#C9532C);}
  /* newsletter */
  .ojf-nl{background:#FDF1DA;border:2.5px solid #1F1812;border-radius:18px;
    box-shadow:4px 4px 0 #1F1812;padding:15px 16px;margin-bottom:13px;}
  .ojf-nl-lbl{display:flex;align-items:center;justify-content:center;gap:7px;font-size:15px;font-weight:900;color:#1F1812;margin-bottom:11px;}
  .ojf-nl-lbl img{width:26px;height:26px;object-fit:contain;}
  .ojf-nl form{display:flex;gap:8px;}
  .ojf-nl input{flex:1;min-width:0;border:2px solid #1F1812;border-radius:12px;padding:11px 13px;
    font-family:inherit;font-size:14px;background:#fff;color:#1F1812;}
  .ojf-nl input:focus{outline:none;box-shadow:0 0 0 3px rgba(108,149,96,.3);}
  .ojf-nl button{border:2.5px solid #1F1812;border-radius:12px;background:linear-gradient(135deg,#86AD79,#3F6A3A);
    color:#fff;font-family:inherit;font-weight:900;font-size:14px;padding:0 18px;cursor:pointer;white-space:nowrap;
    box-shadow:3px 3px 0 #1F1812;transition:transform .14s ease,box-shadow .14s ease,filter .14s ease;}
  .ojf-nl button:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 #1F1812;filter:brightness(1.06);}
  .ojf-nl button:active{transform:translate(3px,3px);box-shadow:0 0 0 #1F1812;}
  .ojf-nl-done{text-align:center;font-weight:900;color:#3F6A3A;padding:6px 0;}
  /* support + stripe tiers */
  .ojf-support{background:linear-gradient(135deg,#FBE9EB,#F7D7DC);border:2.5px solid #1F1812;border-radius:18px;
    box-shadow:4px 4px 0 #1F1812;padding:15px 16px;margin-bottom:0;}
  .ojf-support-head{display:flex;align-items:center;justify-content:center;gap:9px;font-size:16px;font-weight:900;color:#9C1428;margin-bottom:11px;}
  .ojf-support-head img{width:34px;height:34px;object-fit:contain;}
  .ojf-tiers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;}
  .ojf-tier{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
    background:#fff;border:2.5px solid #1F1812;border-radius:14px;box-shadow:3px 3px 0 #9C1428;
    padding:11px 4px;text-decoration:none;color:#9C1428;
    transition:transform .14s ease,box-shadow .14s ease,filter .14s ease;}
  .ojf-tier:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 #9C1428;filter:brightness(1.02);}
  .ojf-tier:active{transform:translate(3px,3px);box-shadow:0 0 0 #9C1428;}
  .ojf-tier b{font-size:19px;font-weight:900;line-height:1;}
  .ojf-tier span{font-size:10px;font-weight:700;color:#786148;}
  `;

  var style = document.createElement('style');
  style.id = 'ojf-style';
  style.textContent = css;
  document.head.appendChild(style);

  var html =
    '<div class="ojf-card">' +
      '<div class="ojf-h">つぎは、どこへ？</div>' +
      '<div class="ojf-social">' +
        '<a href="https://instagram.com/veganoji" target="_blank" rel="noopener" aria-label="Instagram"><img src="/images/social/ig.png" alt=""></a>' +
        '<a href="https://x.com/VeganOji" target="_blank" rel="noopener" aria-label="X"><img src="/images/social/x.png" alt=""></a>' +
        '<a href="https://www.youtube.com/@veganoji" target="_blank" rel="noopener" aria-label="YouTube"><img src="/images/social/yt.png" alt=""></a>' +
        '<a href="https://www.tiktok.com/@veganoji" target="_blank" rel="noopener" aria-label="TikTok"><img src="/images/social/tt.png" alt=""></a>' +
        '<a href="https://www.linkedin.com/in/vegan-oji-alex-derycz/" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="/images/social/li.png" alt=""></a>' +
      '</div>' +
      '<a class="ojf-btn ojf-recipe" href="/recipes/"><img src="/images/vegan-to-chikyu/food-onigiri.png" alt="">美味しいレシピ<span class="ojf-ar">→</span></a>' +
      '<a class="ojf-btn ojf-map" href="https://japanveganmap.org" target="_blank" rel="noopener"><img src="/images/mascot/map-japan.png" alt="">全国のビーガンマップ<span class="ojf-ar">→</span></a>' +
      '<div class="ojf-sectitle">なぜビーガン？</div>' +
      '<div class="ojf-tri">' +
        '<a class="ojf-earth" href="/vegan-and-earth/"><img src="/images/vegan-to-chikyu/icon-globe-earth.png" alt=""><span class="ojf-t">地球</span><span class="ojf-g">PLANET</span></a>' +
        '<a class="ojf-ocean" href="/fish-and-life/"><img src="/images/vegan-to-chikyu/icon-fish-eyed.png" alt=""><span class="ojf-t">海</span><span class="ojf-g">OCEAN</span></a>' +
        '<a class="ojf-body" href="/vegan-and-health/"><img src="/images/vegan-to-chikyu/icon-heart.png" alt=""><span class="ojf-t">体</span><span class="ojf-g">BODY</span></a>' +
      '</div>' +
      '<div class="ojf-sectitle">その他</div>' +
      '<a class="ojf-btn ojf-vegfit" href="/vegfit/"><img src="/images/vegfit/logo-icon.png" alt="">ベジトレClubに参加<span class="ojf-ar">→</span></a>' +
      '<div class="ojf-duo">' +
        '<a class="ojf-btn ojf-news" href="/blog/"><img src="/images/oji/oji_writing.png" alt="">ベジー<wbr>ニュース</a>' +
        '<a class="ojf-btn ojf-report" href="/activity/"><img src="/images/oji/oji_presenting.png" alt="">活動報告</a>' +
      '</div>' +
      '<div class="ojf-nl">' +
        '<div class="ojf-nl-lbl"><img src="/images/vegan-to-chikyu/icon-leaf-vegan.png" alt="">ビーガン王子通信に購読</div>' +
        '<form id="ojf-nl-form">' +
          '<input type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">' +
          '<input type="email" placeholder="メールアドレス" required autocomplete="email">' +
          '<button type="submit">登録</button>' +
        '</form>' +
      '</div>' +
      '<div class="ojf-support">' +
        '<div class="ojf-support-head"><img src="/images/oji/oji_greeting.png" alt="">王子の活動を支援する</div>' +
        '<div class="ojf-tiers">' +
          '<a class="ojf-tier" href="' + STRIPE.t500  + '" target="_blank" rel="noopener"><b>¥500</b><span>/月</span></a>' +
          '<a class="ojf-tier" href="' + STRIPE.t1000 + '" target="_blank" rel="noopener"><b>¥1,000</b><span>/月</span></a>' +
          '<a class="ojf-tier" href="' + STRIPE.t2000 + '" target="_blank" rel="noopener"><b>¥2,000</b><span>/月</span></a>' +
        '</div>' +
      '</div>' +
    '</div>';

  var mount = document.getElementById('oji-footer-nav');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'oji-footer-nav';
    var f = document.querySelector('footer');
    if (f && f.parentNode) f.parentNode.insertBefore(mount, f);
    else document.body.appendChild(mount);
  }
  mount.innerHTML = html;

  // Newsletter form → POST to the news.veganoji.jp signup Worker (double opt-in).
  //   Contract: POST /subscribe  JSON {email, lang, hp}  → {ok:true} sends a confirm email.
  //   (Needs veganoji.jp listed in the Worker's ALLOWED_ORIGINS for the cross-origin POST.)
  var form = mount.querySelector('#ojf-nl-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var emailEl = form.querySelector('input[type="email"]');
    var hpEl = form.querySelector('input[name="hp"]');
    var btn = form.querySelector('button');
    var email = (emailEl && emailEl.value || '').trim();
    if (!email) return;
    var box = form.parentElement;
    function err(text) {
      btn.disabled = false; btn.textContent = '登録';
      var old = box.querySelector('.ojf-nl-err'); if (old) old.remove();
      var m = document.createElement('div'); m.className = 'ojf-nl-err';
      m.style.cssText = 'text-align:center;font-size:12px;font-weight:700;color:#9C1428;margin-top:8px;';
      m.textContent = text; box.appendChild(m);
    }
    btn.disabled = true; btn.textContent = '送信中…';
    fetch('https://news.veganoji.jp/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, lang: 'ja', hp: hpEl ? hpEl.value : '' })
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) {
        if (d && d.ok) {
          form.remove();
          var done = document.createElement('div'); done.className = 'ojf-nl-done';
          done.innerHTML = '<ruby>確認<rt>かくにん</rt></ruby>メールを<ruby>送<rt>おく</rt></ruby>りました！📧'
            + '<br><span style="font-weight:700;color:#786148;font-size:12px;">メール<ruby>内<rt>ない</rt></ruby>のリンクで<ruby>登録<rt>とうろく</rt></ruby><ruby>完了<rt>かんりょう</rt></ruby>です。</span>';
          box.appendChild(done);
        } else if (d && d.error === 'invalid_email') {
          err('メールアドレスを確認してね');
        } else {
          err('うまく送れませんでした。少し後でもう一度。');
        }
      })
      .catch(function () { err('うまく送れませんでした。少し後でもう一度。'); });
  });
})();
