// Collection state, progressive ingestion and slideshow scheduling.
let artworks = [];
let allArtworks = [];
let currentIndex = 0;
let timer = 30;
let infoVisible = false;
let interval;
let randomizedOrder = [];
let isLoadingArtworks = false;
let collectionLoading = false;
let collectionRequestId = 0;
let collectionAbort;
let activeFilters = null;
let sourceFailures = [];
let appliedSelectionKey = null;

function nextArtwork() {
  if (!randomizedOrder.length || isLoadingArtworks) return;
  currentIndex++;
  if (currentIndex >= randomizedOrder.length) createRandomizedOrder();
  showArtwork(1);
}

function previousArtwork() {
  if (!randomizedOrder.length || isLoadingArtworks) return;
  currentIndex = (currentIndex - 1 + randomizedOrder.length) % randomizedOrder.length;
  showArtwork(-1);
}

function updateCollectionStatus() {
  document.getElementById('artworkCount').textContent = artworks.length;
  document.getElementById('collectionStatus').textContent = collectionLoading
    ? 'Weitere Werke werden im Hintergrund geladen…'
    : sourceFailures.length ? 'Nicht erreichbar: ' + sourceFailures.join(', ') : '';
}

async function loadAllArtworks() {
  appliedSelectionKey = collectionSelectionKey();
  const requestId = ++collectionRequestId;
  if (collectionAbort) collectionAbort.abort();
  collectionAbort = new AbortController();
  const options = { signal: collectionAbort.signal, filters: getSelectedFilters() };
  activeFilters = options.filters;
  collectionLoading = true;
  isLoadingArtworks = true;
  sourceFailures = [];
  clearTimeout(interval);
  resetImageLoading();
  hasDisplayedArtwork = false;
  allArtworks = [];
  artworks = [];
  randomizedOrder = [];
  currentIndex = 0;
  frame.style.display = 'none';
  showLoading('Lade Kunstwerke…');
  updateCollectionStatus();
  const seen = new Set();
  const sources = getSelectedSources();
  const loaders = { aic: loadAICData, met: loadMETData, cleveland: loadClevelandData,
    rijks: loadRijksData, smk: loadSMKData, getty: loadGettyData,
    karlsruhe: loadKarlsruheData, museumdigital: loadMuseumDigitalData, nga: loadNGAData };

  function ingest(batch, source) {
    if (requestId !== collectionRequestId) return;
    let added = false;
    for (const raw of batch || []) {
      const work = normalizeArtwork(Object.assign({}, raw, { source: raw.source || source }));
      const key = work.source + ':' + work.id;
      if (seen.has(key)) continue;
      seen.add(key);
      allArtworks.push(work);
      if (matchesFilters(work, activeFilters)) { artworks.push(work); added = true; }
    }
    if (added) {
      const current = randomizedOrder[currentIndex];
      const upcoming = buildRandomizedOrder(current);
      // Keep the image being displayed/loaded at the current position.
      randomizedOrder = current !== undefined ? [current, ...upcoming] : upcoming;
      currentIndex = 0;
      isLoadingArtworks = false;
      if (!hasDisplayedArtwork && !pendingImage) showArtwork();
      if (hasDisplayedArtwork) schedulePreload();
    }
    updateCollectionStatus();
  }

  await Promise.all(sources.map(async source => {
    try {
      const result = await loaders[source](batch => ingest(batch, source), options);
      ingest(result, source); // Also supports adapters that only return a final list.
    } catch (error) {
      if (requestId === collectionRequestId && error.name !== 'AbortError') sourceFailures.push(SOURCE_LABELS[source]);
    }
  }));
  if (requestId !== collectionRequestId) return;
  collectionLoading = false;
  isLoadingArtworks = false;
  updateCollectionStatus();
  if (!artworks.length) showLoading(emptySelectionMessage(), false);
  else if (!hasDisplayedArtwork && !pendingImage) showArtwork();
}

function showArtwork(direction = 1) {
  if (isLoadingArtworks || !artworks.length || !randomizedOrder.length) return;
  let attempts = 0;
  while (attempts < randomizedOrder.length && failedImages.has(randomizedOrder[currentIndex])) {
    currentIndex = (currentIndex + direction + randomizedOrder.length) % randomizedOrder.length;
    attempts++;
  }
  if (attempts === randomizedOrder.length) {
    clearTimeout(interval);
    cancelImageLoad();
    showLoading(collectionLoading ? 'Suche weitere passende Bilder…'
      : 'Keine passenden Bilder konnten geladen werden. Bitte neu laden oder Filter anpassen.', collectionLoading);
    return;
  }
  const index = randomizedOrder[currentIndex % randomizedOrder.length];
  const work = artworks[index];
  loadArtworkImage(work, index, direction, () => renderArtworkInfo(work));
}

    function renderArtworkInfo(raw) {
      // Museum metadata is text, including titles containing angle brackets.
      const artwork = {};
      Object.keys(raw).forEach(key => {
        artwork[key] = typeof raw[key] === 'string' ? raw[key].replace(/[&<>"']/g,
          character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]) : raw[key];
      });
      // Source-spezifische Tags
      const sourceTag = '<span class="tag ' + artwork.source + '">' + (SOURCE_LABELS[artwork.source] || artwork.source) + '</span>';

      infoBox.innerHTML = `
        <div class="artwork-info">
          <div class="title-section">
            <strong>${artwork.title}</strong>
            ${artwork.date_display ? `<span class="date">(${artwork.date_display})</span>` : ''}
          </div>
          
          <div class="artist-section">
            ${artwork.artist_display || 'Unbekannter Künstler'}
          </div>
          
          <div class="details-section">
            ${artwork.place_of_origin ? `<div><em>Herkunft:</em> ${artwork.place_of_origin}</div>` : ''}
            ${artwork.medium_display ? `<div><em>Technik:</em> ${artwork.medium_display}</div>` : ''}
            ${artwork.dimensions ? `<div><em>Größe:</em> ${artwork.dimensions}</div>` : ''}
            ${artwork.credit_line ? `<div class="credit-line">${artwork.credit_line}</div>` : ''}
          </div>
          
          <div class="meta-section">
            ${sourceTag}
            ${artwork.department_title ? `<span class="tag">${artwork.department_title}</span>` : ''}
            ${artwork.is_on_view ? '<span class="tag on-view">Aktuell ausgestellt</span>' : ''}
            ${artwork.is_public_domain ? '<span class="tag public-domain">Gemeinfrei</span>' : ''}
            ${artwork.gallery_title ? `<span class="tag gallery">Galerie ${artwork.gallery_title}</span>` : ''}
          </div>
          
          <div class="source-section">
            <small>Quelle: ${artwork.museumName || SOURCE_LABELS[artwork.source] || artwork.source}</small>
            ${artwork.id ? `<small>ID: ${artwork.id}</small>` : ''}
          </div>
        </div>
      `;
    }
	
function startSlideshow() {
  clearTimeout(interval);
  document.getElementById('timeLabel').textContent = timer;
  if (isLoadingArtworks || pendingImage || !hasDisplayedArtwork || !artworks.length || failedImages.size >= artworks.length) return;
  interval = setTimeout(nextArtwork, timer * 1000);
}
