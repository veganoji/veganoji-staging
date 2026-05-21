/* draggable-mascots.js
 *
 * FaceTime-PIP-style draggable prince mascots:
 *  - Smooth 1:1 finger/mouse tracking during drag (transforms only, no layout)
 *  - Velocity sampling — last few pointermove deltas
 *  - On release: momentum throw with deceleration curve
 *  - After throw: small spring settle (cubic-bezier overshoot)
 *  - Viewport clamping so mascots don't end up off-screen
 *  - Light haptic on grab (Android, Vibration API)
 *  - prefers-reduced-motion → script disabled
 *
 * Targets: every img[src*="/images/mascot/"] OUTSIDE .pose-cycle.
 *
 * BUG FIX vs round 5: many floating mascots had `pointer-events-none`
 * in their Tailwind classes (so they wouldn't block clicks on -z-10
 * text behind them). Pointer events never fired → only one prince
 * was draggable. We now force pointerEvents: 'auto' on each. The
 * tradeoff: clicking the mascot does nothing instead of falling
 * through, which is fine since they're decorative.
 *
 * Double-click / double-tap on any mascot resets it home.
 * Page reload resets all.
 */
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SELECTOR = 'img[src*="/images/mascot/"]';
  const EXCLUDE_INSIDE = ['.pose-cycle'];
  const MIN_WIDTH_PX = 60;          // skip tiny icons
  const SAMPLE_WINDOW_MS = 70;      // velocity sample window
  const THROW_DURATION_MS = 650;    // momentum animation length
  const THROW_BOOST = 0.50;         // higher = farther flings
  const VIEWPORT_MARGIN = 32;       // px of mascot that must stay visible

  function eligible(img) {
    for (const sel of EXCLUDE_INSIDE) { if (img.closest(sel)) return false; }
    const rect = img.getBoundingClientRect();
    if (rect.width < MIN_WIDTH_PX) return false;
    return true;
  }

  function vibrate(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  }

  function makeDraggable(img) {
    if (img.dataset.dragInit === '1') return;
    img.dataset.dragInit = '1';
    img.draggable = false;

    // Override Tailwind's pointer-events-none — needed to receive drag events
    img.style.pointerEvents = 'auto';
    img.style.touchAction = 'none';
    img.style.userSelect = 'none';
    img.style.webkitUserSelect = 'none';
    img.style.cursor = 'grab';
    img.style.willChange = 'transform';

    const originalZ = window.getComputedStyle(img).zIndex;
    const originalFilter = window.getComputedStyle(img).filter;
    const baseFilter = originalFilter === 'none' ? '' : originalFilter;
    let pausedAnimation = '';

    let dx = 0, dy = 0;        // accumulated translation from origin
    let startX, startY;
    let dragging = false;

    // velocity sampling buffer: [{x, y, t}]
    const samples = [];

    function applyTransform(x, y, rot) {
      img.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    }

    function clampToViewport(x, y) {
      // The mascot's current bounding box AT its CSS-positioned home
      // (transform=0). We need (rect.left + x) to stay in viewport with
      // some margin.
      const rect = img.getBoundingClientRect();
      // home rect = current rect minus current transform
      const homeLeft = rect.left - dx;
      const homeTop  = rect.top  - dy;
      const w = rect.width, h = rect.height;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Keep at least MARGIN of the mascot visible inside the viewport
      const minX = -homeLeft - w + VIEWPORT_MARGIN;
      const maxX = vw - homeLeft - VIEWPORT_MARGIN;
      const minY = -homeTop - h + VIEWPORT_MARGIN;
      // For vertical, allow extending below the fold to encourage scroll-discoverability
      const maxY = (document.documentElement.scrollHeight - homeTop) - VIEWPORT_MARGIN;
      return [
        Math.max(minX, Math.min(maxX, x)),
        Math.max(minY, Math.min(maxY, y)),
      ];
    }

    img.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      try { img.setPointerCapture(e.pointerId); } catch {}
      img.style.cursor = 'grabbing';
      img.style.transition = 'none';
      img.style.zIndex = '999';
      // Lift effect during grab
      img.style.filter = `${baseFilter} drop-shadow(0 14px 24px rgba(31,24,18,0.30))`.trim();
      pausedAnimation = img.style.animation;
      img.style.animation = 'none';
      startX = e.clientX - dx;
      startY = e.clientY - dy;
      samples.length = 0;
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      vibrate(8);
      e.preventDefault();
    });

    img.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      // Slight live rotation tied to horizontal drag
      const rot = Math.max(-18, Math.min(18, dx * 0.04));
      applyTransform(dx, dy, rot);
      // Sample velocity (trim to recent window)
      samples.push({ x: e.clientX, y: e.clientY, t: now });
      while (samples.length > 1 && now - samples[0].t > SAMPLE_WINDOW_MS) {
        samples.shift();
      }
    });

    function release(e) {
      if (!dragging) return;
      dragging = false;
      try { img.releasePointerCapture(e.pointerId); } catch {}
      img.style.cursor = 'grab';

      // Compute velocity (px/ms) from sample buffer
      let vx = 0, vy = 0;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) {
          vx = (last.x - first.x) / dt;
          vy = (last.y - first.y) / dt;
        }
      }

      // Throw target: current position + extrapolated coast distance
      const coastX = vx * THROW_DURATION_MS * THROW_BOOST;
      const coastY = vy * THROW_DURATION_MS * THROW_BOOST;
      let targetX = dx + coastX;
      let targetY = dy + coastY;
      [targetX, targetY] = clampToViewport(targetX, targetY);

      const speed = Math.hypot(vx, vy);
      const distance = Math.hypot(coastX, coastY);
      const finalRot = Math.max(-12, Math.min(12, (targetX - dx) * 0.015 + (vx > 0 ? 3 : -3) * Math.min(speed, 1)));

      if (distance > 8) {
        // Momentum throw — easing matches iOS scroll deceleration
        img.style.transition = `transform ${THROW_DURATION_MS}ms cubic-bezier(0.17, 0.84, 0.44, 1), filter 250ms ease`;
        img.style.transform = `translate(${targetX}px, ${targetY}px) rotate(${finalRot}deg)`;
        // After throw, gentle spring settle (overshoot pulls rotation toward 0)
        setTimeout(() => {
          if (dragging) return;  // user grabbed it again mid-settle
          dx = targetX; dy = targetY;
          const settleRot = Math.max(-6, Math.min(6, targetX * 0.005));
          img.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), filter 250ms ease';
          img.style.transform = `translate(${targetX}px, ${targetY}px) rotate(${settleRot}deg)`;
        }, THROW_DURATION_MS + 16);
      } else {
        // Low-velocity release: spring straight to current position
        const settleRot = Math.max(-6, Math.min(6, dx * 0.01));
        img.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 250ms ease';
        img.style.transform = `translate(${dx}px, ${dy}px) rotate(${settleRot}deg)`;
      }

      // Restore filter after settle
      setTimeout(() => {
        if (!dragging) img.style.filter = baseFilter;
      }, distance > 8 ? THROW_DURATION_MS + 500 : 450);

      // Restore z-index after settle (so resting state honours -z-10 etc)
      setTimeout(() => {
        if (!dragging) img.style.zIndex = originalZ === 'auto' ? '' : originalZ;
      }, distance > 8 ? THROW_DURATION_MS + 500 : 500);

      samples.length = 0;
    }

    img.addEventListener('pointerup', release);
    img.addEventListener('pointercancel', release);

    // Double-tap / double-click resets THIS mascot
    let lastTap = 0;
    img.addEventListener('click', (e) => {
      const now = performance.now();
      if (now - lastTap < 350) {
        dx = 0; dy = 0;
        img.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
        img.style.transform = '';
        img.style.animation = pausedAnimation;
        vibrate(12);
        e.preventDefault();
      }
      lastTap = now;
    });
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach((img) => {
      if (eligible(img)) makeDraggable(img);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }
  // Catch late-injected mascots (e.g. blog list cards)
  setTimeout(scan, 500);
  setTimeout(scan, 2000);
})();
