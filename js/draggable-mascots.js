/* draggable-mascots.js
 *
 * Lets users grab the prince mascot images with mouse or finger and
 * fling them around the page. Mascot stays where dropped, with a tiny
 * settling animation. Double-click / double-tap resets all mascots to
 * their home position.
 *
 * Targets: every <img src="/images/mascot/*.png"> EXCEPT those inside
 * .pose-cycle (the hero auto-cycler — that shouldn't be hijacked).
 *
 * One global script, included on every page via <script defer>.
 */
(() => {
  'use strict';

  // Don't activate if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SELECTOR = 'img[src*="/images/mascot/"]';
  const EXCLUDE_INSIDE = ['.pose-cycle'];   // hero cycler keeps its CSS animation

  function eligible(img) {
    for (const sel of EXCLUDE_INSIDE) {
      if (img.closest(sel)) return false;
    }
    // Skip tiny icons (< 60px wide) — they're not meant to be draggable
    const rect = img.getBoundingClientRect();
    if (rect.width < 60) return false;
    return true;
  }

  function makeDraggable(img) {
    if (img.dataset.dragInit === '1') return;
    img.dataset.dragInit = '1';
    img.draggable = false;
    img.style.touchAction = 'none';
    img.style.userSelect = 'none';
    img.style.webkitUserSelect = 'none';
    img.style.cursor = 'grab';
    img.style.willChange = 'transform';
    // Bump z-index a touch so the dragged mascot sits above neighbours,
    // but still below modals/headers. Original negative z-indexes are
    // overridden ONLY during drag.
    const originalZIndex = window.getComputedStyle(img).zIndex;

    let dx = 0, dy = 0;        // current accumulated translation
    let startX, startY;        // pointer position when drag began
    let dragging = false;
    let pausedAnimation = '';  // saved animation value while dragging

    img.addEventListener('pointerdown', (e) => {
      // Only primary button (or any touch / pen contact)
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      img.setPointerCapture(e.pointerId);
      img.style.cursor = 'grabbing';
      img.style.transition = 'none';
      img.style.zIndex = '999';
      // Pause any keyframe animation (anim-bobble, anim-tilt) — otherwise
      // it fights our transform
      pausedAnimation = img.style.animation;
      img.style.animation = 'none';
      startX = e.clientX - dx;
      startY = e.clientY - dy;
      e.preventDefault();
    });

    img.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      const rot = Math.max(-22, Math.min(22, (dx * 0.05) + (Math.sin(performance.now() / 120) * 1.5)));
      img.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    });

    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      try { img.releasePointerCapture(e.pointerId); } catch {}
      img.style.cursor = 'grab';
      // Settle: spring back to a slight tilt based on direction
      const tilt = Math.max(-10, Math.min(10, dx * 0.02));
      img.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
      img.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`;
      // Restore z-index after the settle animation (so resting state honours
      // the page's original z-stack, especially mascots at -z-10)
      setTimeout(() => {
        if (!dragging) img.style.zIndex = originalZIndex === 'auto' ? '' : originalZIndex;
      }, 460);
      // NB: do NOT resume the keyframe animation. The mascot now sits
      // wherever the user left it; restoring animation would jerk it back
      // toward its origin point. Reload = reset.
    };
    img.addEventListener('pointerup', finish);
    img.addEventListener('pointercancel', finish);

    // Double-click / double-tap to reset THIS mascot to home
    let lastTap = 0;
    img.addEventListener('click', (e) => {
      const now = performance.now();
      if (now - lastTap < 350) {
        dx = 0; dy = 0;
        img.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        img.style.transform = '';
        img.style.animation = pausedAnimation;
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

  // Initial scan when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }

  // Re-scan after dynamic content (blog list rendering, etc) — runs cheaply
  // a couple seconds after load to catch late-injected mascots.
  setTimeout(scan, 500);
  setTimeout(scan, 2000);
})();
