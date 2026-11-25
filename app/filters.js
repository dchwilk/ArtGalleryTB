// One vocabulary for every source. Keep missing metadata unknown rather than guessing.
const SOURCE_LABELS = {
  aic: 'Art Institute of Chicago', met: 'Metropolitan Museum',
  cleveland: 'Cleveland Museum of Art', rijks: 'Rijksmuseum',
  smk: 'SMK – Statens Museum for Kunst', getty: 'J. Paul Getty Museum',
  karlsruhe: 'Staatliche Kunsthalle Karlsruhe', museumdigital: 'museum-digital'
};
const TYPE_INPUTS = {
  sourcePaintings: 'painting', sourcePhotographs: 'photograph', sourceSculpture: 'sculpture',
  sourceDrawings: 'drawing', sourceDecorative: 'decorative'
};
const DEPARTMENT_INPUTS = {
  deptEuropean: 'european', deptAmerican: 'american', deptAsian: 'asian',
  deptModern: 'modern', deptContemporary: 'contemporary'
};
const PERIOD_INPUTS = {
  periodAncient: [-Infinity, 499], periodMedieval: [500, 1399],
  periodRenaissance: [1400, 1599], periodBaroque: [1600, 1749],
  periodModern: [1750, 1949], periodContemporary: [1950, Infinity]
};

function categoryKeys(text, patterns) {
  return Object.keys(patterns).filter(key => patterns[key].test(text.toLowerCase()));
}

function normalizeArtwork(raw) {
  const work = Object.assign({}, raw);
  work.source = raw.source || 'unknown';
  work.id = raw.id != null ? raw.id : raw.objectID || raw.object_number || raw.imageUrl;
  work.title = raw.title || '';
  work.imageUrl = artworkImageUrl(raw);
  work.imageWidth = Number(raw.imageWidth || raw.image_width || raw.thumbnail?.width) || null;
  work.imageHeight = Number(raw.imageHeight || raw.image_height || raw.thumbnail?.height) || null;
  const year = raw.date_start ?? raw.objectBeginDate ?? raw.dating?.yearEarly;
  work.date_start = year !== null && year !== undefined && year !== '' && Number.isFinite(Number(year)) ? Number(year) : null;
  work.is_public_domain = raw.is_public_domain === true || raw.isPublicDomain === true || raw.public_domain === true;
  const type = [raw.classification_title, raw.objectName, ...(raw.objectTypes || [])].filter(Boolean).join(' ');
  const region = [raw.department_title, raw.department, raw.place_of_origin, raw.country, raw.nationality].filter(Boolean).join(' ');
  work.categories = {
    types: categoryKeys(type, {
      painting: /paint|maleri|gemälde|schilderij/,
      photograph: /photograph|fotograf|photography/,
      sculpture: /sculpt|skulpt|plastik|beeldhouw/,
      drawing: /draw|print|zeichnung|stich|radierung|schnitt|tekening|tegning|grafik|graphic|prent|woodcut|træsnit|etching|engraving/,
      decorative: /decorative|furniture|ceramic|vessel|textile|kunsthandwerk|porcelain|møbel|lamp|coin|drachm|jewel|bowl/
    }),
    regions: categoryKeys(region, {
      european: /europ|deutsch|frankreich|italien|niederl|netherlands|dutch|danish|denmark|dansk|italian|italiensk|french|france|fransk|german|british|english|spanish|belgian|norwegian|swedish/,
      american: /america|united states/,
      asian: /asia|chinese|japanese|korean|himalaya|china|japan/
    })
  };
  return work;
}

function getSelectedSources() {
  return Object.keys(SOURCE_LABELS).filter(source => {
    const ids = { aic: 'sourceAIC', met: 'sourceMET', cleveland: 'sourceCleveland', rijks: 'sourceRijks', smk: 'sourceSMK', getty: 'sourceGetty', karlsruhe: 'sourceKarlsruhe', museumdigital: 'sourceMuseumDigital' };
    return document.getElementById(ids[source]).checked;
  });
}

function selectedKeys(inputs) {
  return Object.keys(inputs).filter(id => document.getElementById(id).checked).map(id => inputs[id]);
}

function getSelectedFilters() {
  return {
    types: selectedKeys(TYPE_INPUTS), departments: selectedKeys(DEPARTMENT_INPUTS),
    periods: selectedKeys(PERIOD_INPUTS).map(range => ({ start: range[0], end: range[1] })),
    properties: selectedKeys({ onlyPublicDomain: 'publicDomain', onlyHighRes: 'highRes', onlyWithImages: 'withImages' }),
    landscape: document.getElementById('onlyLandscape').checked
  };
}

function matchesDepartment(raw, department) {
  const work = raw.categories ? raw : normalizeArtwork(raw);
  if (department === 'modern' || department === 'contemporary') {
    // Date-based categories work across museums with different department names.
    if (work.date_start !== null) return department === 'modern'
      ? work.date_start >= 1750 && work.date_start < 1950 : work.date_start >= 1950;
    return new RegExp(department, 'i').test(raw.department_title || raw.department || '');
  }
  return work.categories.regions.indexOf(department) >= 0;
}

function matchesFilters(raw, filters) {
  const work = raw.categories ? raw : normalizeArtwork(raw);
  if (filters.types.length && !filters.types.some(type => work.categories.types.indexOf(type) >= 0)) return false;
  if (filters.departments.length && !filters.departments.some(department => matchesDepartment(work, department))) return false;
  if (filters.periods.length && (work.date_start === null || !filters.periods.some(period => work.date_start >= period.start && work.date_start <= period.end))) return false;
  if (filters.properties.indexOf('publicDomain') >= 0 && !work.is_public_domain) return false;
  if (filters.properties.indexOf('withImages') >= 0 && !work.imageUrl) return false;
  const pixels = Math.max(work.imageWidth || 0, work.imageHeight || 0);
  if (filters.properties.indexOf('highRes') >= 0 && pixels && pixels < 1600 && work.is_zoomable !== true) return false;
  // Unknown orientation is checked against the actual downloaded image before display.
  if (filters.landscape && work.imageWidth && work.imageHeight && work.imageWidth <= work.imageHeight) return false;
  return true;
}

function filterArtworks(filters = getSelectedFilters()) {
  activeFilters = filters;
  artworks = allArtworks.map(normalizeArtwork).filter(work => matchesFilters(work, filters));
  resetImageLoading();
  createRandomizedOrder();
  document.getElementById('artworkCount').textContent = artworks.length;
}
