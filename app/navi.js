// One owner for remote/keyboard events. Menu focus belongs to menu.js.
const KEY_CODES = {
  13: 'ok', 27: 'menu', 32: 'color', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
  65: 'slower', 66: 'slower', 68: 'faster', 71: 'color', 77: 'menu',
  78: 'shuffle', 82: 'menu', 89: 'faster',
  403: 'menu', 404: 'color', 405: 'faster', 406: 'slower',
  415: 'color', 427: 'faster', 428: 'slower', 10009: 'menu', 10252: 'color'
};
const KEY_NAMES = {
  Enter: 'ok', Escape: 'menu', BrowserBack: 'menu', Back: 'menu', GoBack: 'menu',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  ColorF0Red: 'menu', ColorF1Green: 'color', ColorF2Yellow: 'faster', ColorF3Blue: 'slower',
  MediaPlay: 'color', MediaPlayPause: 'color', ChannelUp: 'faster', ChannelDown: 'slower',
  ' ': 'color', a: 'slower', b: 'slower', d: 'faster', g: 'color', m: 'menu',
  n: 'shuffle', r: 'menu', y: 'faster'
};
let navigationInitialized = false;
let infoHoldStart = null;

function remoteAction(event) {
  const key = event.key || '';
  return KEY_CODES[event.keyCode || event.which] || KEY_NAMES[key] || KEY_NAMES[key.toLowerCase()];
}

function toggleInfo() {
  infoVisible = !infoVisible;
  infoBox.style.display = infoVisible ? 'block' : 'none';
}

function handleAllNavigation(event) {
  const action = remoteAction(event);
  if (!action) return; // Leave unrelated keys, including volume, to the platform.
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat && ['left', 'right', 'up', 'down', 'faster', 'slower'].indexOf(action) === -1) return;
  if (isMenuOpen()) {
    infoHoldStart = null;
    handleMenuNavigation(action);
    return;
  }
  switch (action) {
    case 'right': nextArtwork(); break;
    case 'left': previousArtwork(); break;
    case 'up':
      if (infoHoldStart === null) infoHoldStart = Date.now();
      break;
    case 'down':
      infoBox.style.display = 'none';
      infoVisible = false;
      infoHoldStart = null;
      break;
    case 'color':
      colorIndex = (colorIndex + 1) % matColors.length;
      setPassepartout(colorIndex);
      saveSettings();
      break;
    case 'faster': timer = Math.min(86400, timer + 15); startSlideshow(); saveSettings(); break;
    case 'slower': timer = Math.max(5, timer - 15); startSlideshow(); saveSettings(); break;
    case 'menu': infoHoldStart = null; toggleMenu(); break;
    case 'ok':
      styleIndex = (styleIndex + 1) % styles.length;
      updatePassepartoutStyle();
      saveSettings();
      break;
    case 'shuffle': createRandomizedOrder(); showArtwork(); break;
  }
}

function handleNavigationRelease(event) {
  if (remoteAction(event) === 'ok') {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (remoteAction(event) !== 'up' || infoHoldStart === null) return;
  event.preventDefault();
  event.stopPropagation();
  const held = Date.now() - infoHoldStart;
  infoHoldStart = null;
  if (isMenuOpen()) return;
  if (held <= 3000) {
    toggleInfo();
  } else {
    // Fullscreen is optional on TV engines; failures must not break remote input.
    const target = document.fullscreenElement ? document : document.documentElement;
    const method = document.fullscreenElement ? 'exitFullscreen' : 'requestFullscreen';
    if (typeof target[method] === 'function') {
      try {
        const result = target[method]();
        if (result && result.catch) result.catch(error => console.log('Fullscreen unavailable:', error));
      } catch (error) { console.log('Fullscreen unavailable:', error); }
    }
  }
}

function initNavigation() {
  if (navigationInitialized) return;
  navigationInitialized = true;
  initMenuNavigation();
  document.addEventListener('keydown', handleAllNavigation, true);
  document.addEventListener('keyup', handleNavigationRelease, true);
  window.addEventListener('blur', () => { infoHoldStart = null; });
  document.addEventListener('visibilitychange', () => { infoHoldStart = null; });
}
