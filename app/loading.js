// A centered status indicator, shared by museum requests and image loading.
function showLoading(message, busy = true) {
  loadingInfo.style.display = 'flex';
  loadingInfo.classList.toggle('is-loading', busy);
  document.getElementById('loadingText').textContent = message;
  frame.setAttribute('aria-busy', String(busy));
}

function hideLoading() {
  loadingInfo.style.display = 'none';
  loadingInfo.classList.remove('is-loading');
  frame.setAttribute('aria-busy', 'false');
}

const IMAGE_LOAD_TIMEOUT = 20000;
let imageRequestId = 0;
let pendingImage = null;
let imageLoadTimeout;
let failedImages = new Set();

function cancelImageLoad() {
  imageRequestId++;
  clearTimeout(imageLoadTimeout);
  if (pendingImage) {
    pendingImage.onload = null;
    pendingImage.onerror = null;
    pendingImage.src = '';
    pendingImage = null;
  }
}

function resetImageLoading() {
  cancelImageLoad();
  failedImages = new Set();
}

function artworkImageUrl(artwork) {
  const url = artwork.imageUrl ||
    (artwork.source === 'aic' && artwork.image_id ? `https://www.artic.edu/iiif/2/${artwork.image_id}/full/1024,/0/default.jpg` :
      artwork.source === 'met' ? artwork.primaryImage :
      artwork.source === 'rijks' && artwork.webImage && typeof artwork.webImage.url === 'string' ? artwork.webImage.url.replace('=s0', '=s1000') : '');
  return typeof url === 'string' ? url : '';
}

function loadArtworkImage(artwork, index, direction, onReady) {
  cancelImageLoad();
  clearTimeout(interval);
  const requestId = imageRequestId;
  const candidate = new Image();
  pendingImage = candidate;
  showLoading('Lade Kunstwerk...');

  function finish(success) {
    if (requestId !== imageRequestId || candidate !== pendingImage) return;
    clearTimeout(imageLoadTimeout);
    candidate.onload = null;
    candidate.onerror = null;
    pendingImage = null;
    if (success) {
      // Keep the preceding artwork and its metadata until the next image is ready.
      // Reuse the loaded node, avoiding a second request on no-cache image hosts.
      candidate.id = img.id;
      candidate.className = img.className;
      candidate.alt = img.alt;
      img.parentNode.replaceChild(candidate, img);
      img = candidate;
      frame.style.display = 'flex';
      onReady();
      hideLoading();
      startSlideshow();
    } else {
      candidate.src = ''; // Also release a request that exceeded its time limit.
      failedImages.add(index);
      // A failure advances at most once per artwork; a wholly broken collection stops.
      showArtwork(direction);
    }
  }

  candidate.onload = () => finish(candidate.naturalWidth > 0);
  candidate.onerror = () => finish(false);
  imageLoadTimeout = setTimeout(() => finish(false), IMAGE_LOAD_TIMEOUT);
  const url = artworkImageUrl(artwork);
  if (url) candidate.src = url;
  else {
    clearTimeout(imageLoadTimeout);
    imageLoadTimeout = setTimeout(() => finish(false), 0);
  }
}
