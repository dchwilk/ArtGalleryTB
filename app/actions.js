// Shared actions: menu buttons and remote shortcuts always change the same state.
function changeSlideTime(seconds) {
  timer = Math.max(5, Math.min(86400, timer + seconds));
  startSlideshow();
  saveSettings();
}

function changeMatColor() {
  colorIndex = (colorIndex + 1) % matColors.length;
  setPassepartout(colorIndex);
  saveSettings();
}

function changeFrameStyle() {
  styleIndex = (styleIndex + 1) % styles.length;
  updatePassepartoutStyle();
  saveSettings();
}

function reshuffleArtworks() {
  if (!artworks.length || isLoadingArtworks) return;
  resetImageLoading(false);
  createRandomizedOrder();
  showArtwork();
  document.getElementById('shuffleStatus').textContent = 'Reihenfolge neu gemischt.';
}

function toggleGalleryFullscreen() {
  const target = document.fullscreenElement ? document : document.documentElement;
  const method = document.fullscreenElement ? 'exitFullscreen' : 'requestFullscreen';
  function unavailable() {
    document.getElementById('shuffleStatus').textContent = 'Vollbild steht hier nicht zur Verfügung.';
  }
  if (typeof target[method] !== 'function') { unavailable(); return; }
  try {
    const result = target[method]();
    if (result && result.catch) result.catch(unavailable);
  } catch (_) { unavailable(); }
}
