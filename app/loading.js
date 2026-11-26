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
let pendingJob = null;
let failedImages = new Set();
let hasDisplayedArtwork = false;
let preloaded = null;
let preloadTimer;

function artworkImageUrl(work) {
  const url = work.imageUrl || (work.source === 'aic' && work.image_id
    ? `https://www.artic.edu/iiif/2/${work.image_id}/full/1920,/0/default.jpg`
    : work.source === 'met' ? work.primaryImage
      : work.source === 'rijks' ? work.webImage?.url?.replace('=s0', '=s1000') : '');
  return typeof url === 'string' ? url : '';
}

function requestArtworkImage(work) {
  const image = new Image();
  const job = { image, settled: false };
  let timeout;
  job.promise = new Promise(resolve => {
    function finish(ok) {
      if (job.settled) return;
      job.settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (!ok) image.src = '';
      resolve(ok);
    }
    job.cancel = () => finish(false);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    timeout = setTimeout(() => finish(false), IMAGE_LOAD_TIMEOUT);
    const url = artworkImageUrl(work);
    if (url) image.src = url;
    else { clearTimeout(timeout); timeout = setTimeout(() => finish(false), 0); }
  });
  return job;
}

function cancelImageLoad() {
  imageRequestId++;
  if (pendingJob) pendingJob.cancel();
  pendingJob = null;
  pendingImage = null;
}

function resetImageLoading(clearFailures = true) {
  cancelImageLoad();
  clearTimeout(preloadTimer);
  if (preloaded) preloaded.job.cancel();
  preloaded = null;
  if (clearFailures) failedImages = new Set();
}

function imageMatchesRequirements(image, work) {
  if (activeFilters?.landscape && image.naturalWidth <= image.naturalHeight) return false;
  if (activeFilters?.properties.includes('highRes')) {
    return work.is_zoomable === true || Math.max(work.imageWidth || 0, work.imageHeight || 0, image.naturalWidth, image.naturalHeight) >= 1600;
  }
  return true;
}

function schedulePreload() {
  clearTimeout(preloadTimer);
  if (!hasDisplayedArtwork || pendingImage) return;
  let next = currentIndex + 1;
  while (next < randomizedOrder.length && failedImages.has(randomizedOrder[next])) next++;
  const index = randomizedOrder[next];
  if (index === undefined || index === randomizedOrder[currentIndex]) return;
  if (preloaded?.index === index) return;
  if (preloaded) preloaded.job.cancel();
  preloaded = null;
  // Exactly one lookahead image; never show a spinner for background work.
  preloadTimer = setTimeout(() => {
    if (!hasDisplayedArtwork || pendingImage) return;
    const entry = { index, job: requestArtworkImage(artworks[index]) };
    preloaded = entry;
    entry.job.promise.then(ok => {
      if (preloaded !== entry) return;
      if (!ok || !imageMatchesRequirements(entry.job.image, artworks[index])) {
        failedImages.add(index);
        preloaded = null;
        schedulePreload();
      }
    });
  }, 300);
}

function loadArtworkImage(work, index, direction, onReady) {
  const job = preloaded?.index === index ? preloaded.job : requestArtworkImage(work);
  if (preloaded?.index === index) preloaded = null;
  else if (preloaded) { preloaded.job.cancel(); preloaded = null; }
  clearTimeout(preloadTimer);
  cancelImageLoad();
  clearTimeout(interval);
  const requestId = imageRequestId;
  pendingJob = job;
  pendingImage = job.image;
  if (!job.settled) showLoading('Lade Kunstwerk…');
  job.promise.then(ok => {
    if (requestId !== imageRequestId || pendingJob !== job) return;
    pendingImage = null;
    pendingJob = null;
    if (!ok || !imageMatchesRequirements(job.image, work)) {
      failedImages.add(index);
      showArtwork(direction);
      return;
    }
    const candidate = job.image;
    work.imageWidth = work.imageWidth || candidate.naturalWidth;
    work.imageHeight = work.imageHeight || candidate.naturalHeight;
    candidate.id = img.id;
    candidate.className = img.className;
    candidate.alt = img.alt;
    candidate.draggable = false;
    img.parentNode.replaceChild(candidate, img);
    img = candidate;
    hasDisplayedArtwork = true;
    frame.style.display = 'flex';
    onReady();
    hideLoading();
    startSlideshow();
    schedulePreload();
  });
}
