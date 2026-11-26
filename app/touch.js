// Invisible gallery gestures. Menu controls and scrolling stay native.
let touchNavigationInitialized = false;

function initTouchNavigation() {
  if (touchNavigationInitialized) return;
  touchNavigationInitialized = true;
  let gesture = null;
  let compatibilityClick = null;
  const pointers = new Set();

  function excluded(target) {
    return isMenuOpen() || !target || !target.closest
      || target.closest('button, input, select, textarea, a, [contenteditable="true"], #menuOverlay');
  }

  function begin(x, y, target, id) {
    if (excluded(target)) { gesture = null; return; }
    gesture = { x, y, id, time: Date.now(), fromInfo: infoBox.contains(target) };
  }

  function finish(x, y, id) {
    const start = gesture;
    gesture = null;
    if (!start || start.id !== id || isMenuOpen()) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const elapsed = Date.now() - start.time;
    if (elapsed > 1500) return;
    let handled = true;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) nextArtwork(); else previousArtwork();
    } else if (!start.fromInfo && Math.abs(dy) >= 50 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      if (dy < 0) toggleInfo(); else toggleMenu();
    } else if (elapsed <= 450 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      // Information takes priority over the left/right zones at the bottom.
      if (y >= window.innerHeight * 0.75) toggleInfo();
      else if (x < window.innerWidth * 0.25) previousArtwork();
      else if (x > window.innerWidth * 0.75) nextArtwork();
      else toggleMenu();
    } else handled = false;
    // Opening a menu on pointerup must not click a newly exposed menu control.
    if (handled) compatibilityClick = { x, y, time: Date.now() };
  }

  function cancel() { gesture = null; pointers.clear(); }

  if (window.PointerEvent) {
    document.addEventListener('pointerdown', event => {
      compatibilityClick = null;
      if (event.button !== 0) return;
      pointers.add(event.pointerId);
      if (pointers.size !== 1 || event.isPrimary === false) { gesture = null; return; }
      begin(event.clientX, event.clientY, event.target, event.pointerId);
    }, { passive: true });
    document.addEventListener('pointerup', event => {
      pointers.delete(event.pointerId);
      if (!pointers.size) finish(event.clientX, event.clientY, event.pointerId);
    }, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
  } else {
    document.addEventListener('touchstart', event => {
      compatibilityClick = null;
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      begin(point.clientX, point.clientY, event.target, point.identifier);
    }, { passive: true });
    document.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      if (gesture && !gesture.fromInfo && !isMenuOpen() && event.cancelable) event.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', event => {
      if (event.touches.length || !event.changedTouches.length) { cancel(); return; }
      const point = event.changedTouches[0];
      finish(point.clientX, point.clientY, point.identifier);
    }, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
  }

  document.addEventListener('click', event => {
    const previous = compatibilityClick;
    if (!previous || Date.now() - previous.time > 700
      || Math.abs(event.clientX - previous.x) > 15 || Math.abs(event.clientY - previous.y) > 15) return;
    compatibilityClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // CSS handles the layout change; do not rebuild the gallery or reload sources.
  window.addEventListener('resize', cancel);
  window.addEventListener('orientationchange', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', cancel);
}
