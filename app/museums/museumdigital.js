function museumDigitalArtwork(work) {
  const image = (work.object_images || []).find(image => image.is_main === 'j');
  // Metadata rights do not license the image. Keep this source freely reusable
  // even when the global public-domain filter is disabled.
  if (!image || !['CC0', 'Public Domain Mark'].includes(image.rights)) return null;
  let imageUrl;
  if (image.intern === 'j') {
    const path = [work.md_subset, image.folder, image.filename_loc].join('/');
    if (/[\\:#?\u0000-\u001f]/.test(path) || path.includes('..') || !work.md_subset || !image.folder || !image.filename_loc) return null;
    imageUrl = 'https://asset.museum-digital.org/' + path.split('/').map(encodeURIComponent).join('/');
  } else {
    // External resources can point at HTML catalogue pages instead of an image.
    // Only use explicit HTTPS image files, never the 200px preview as TV artwork.
    try {
      const url = new URL(image.filename_loc);
      if (url.protocol !== 'https:' || !/\.(jpg|jpeg|png|webp)(?:$|\?)/i.test(url.href)) return null;
      imageUrl = url.href;
    } catch (_) { return null; }
  }
  const production = (work.object_events || []).find(event => event.event_type === 1 || event.event_type === '1');
  const museum = work.object_institution?.institution_name || 'museum-digital';
  return {
    id: work.object_id, source: 'museumdigital', title: museumPlainText(work.object_name), imageUrl,
    museumName: museum, museumId: work.object_institution?.institution_id,
    artist_display: production?.people?.displayname || production?.people?.people_name,
    date_start: production?.time?.time_start || null, date_display: production?.time?.time_name,
    classification_title: work.object_type,
    department_title: (work.object_collection || []).map(collection => collection.collection_name).join(', '),
    place_of_origin: production?.place?.place_name,
    medium_display: museumPlainText(work.object_material_technique), dimensions: museumPlainText(work.object_dimensions),
    credit_line: [museum, image.creator, image.owner, image.rights].filter(Boolean).join(' · '),
    is_public_domain: true
  };
}

async function loadMuseumDigitalData(onBatch = () => {}, options = {}) {
  const names = { painting: 'Gemälde', photograph: 'Fotografie', sculpture: 'Skulptur', drawing: 'Zeichnung', print: 'Druckgrafik', decorative: 'Kunsthandwerk' };
  const types = !options.filters?.includeUnknown && options.filters?.types?.length ? options.filters.types : Object.keys(names);
  // Query each selected type separately; do not depend on undocumented OR syntax.
  const queries = options.filters?.includeUnknown ? ['*'] : types.map(type => 'type:' + names[type]);
  const results = [];
  for (const query of queries) {
    const works = await loadSampledMuseum((offset, rows) =>
      'https://nat.museum-digital.de/export/json/' + encodeURIComponent(query || '*') + '?limit=' + rows + '&offset=' + offset,
    data => ({ total: data.results?.total, works: Object.values(data.results?.objects || {}).map(museumDigitalArtwork).filter(Boolean) }),
    onBatch, Object.assign({}, options, { timeout: 12000, maxPages: Math.max(2, Math.floor(8 / queries.length)) }));
    results.push(...works);
  }
  return results;
}
