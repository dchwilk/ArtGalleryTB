// Rijksmuseum's current Linked Art service requires no API key.
function rijksLabel(value) {
  if (!value) return '';
  const notation = Array.isArray(value.notation) ? value.notation : value.notation ? [value.notation] : [];
  return value._label || notation.find(item => item['@language'] === 'en')?.['@value'] || notation[0]?.['@value'] || value.content || '';
}

function rijksArtwork(work) {
  // Image rights belong to the digital image, not to the catalogue record.
  const digital = (work.subject_of || []).flatMap(item => item.digitally_carried_by || []).find(image =>
    (image.referred_to_by || []).some(right => /^https?:\/\/creativecommons.org\/publicdomain\/(mark|zero)\//.test(right.content || '')) &&
    image.access_point?.some(point => /^https:\/\/iiif\.micr\.io\//.test(point.id || '')));
  const image = digital?.access_point?.find(point => /^https:\/\/iiif\.micr\.io\/[^/]+\/full\//.test(point.id || ''))?.id;
  if (!image) return null;
  const production = work.produced_by || {};
  const parts = [production, ...(production.part || [])];
  return {
    id: work.id, source: 'rijks',
    title: work.identified_by?.find(name => name.type === 'Name')?.content,
    artist_display: [...new Set(parts.flatMap(part => part.carried_out_by || []).map(rijksLabel).filter(Boolean))].join(', '),
    date_start: parseInt(production.timespan?.begin_of_the_begin, 10) || null,
    date_end: parseInt(production.timespan?.end_of_the_end, 10) || null,
    date_display: production.timespan?.identified_by?.[0]?.content,
    classification_title: (work.classified_as || []).map(rijksLabel).join(', '),
    place_of_origin: parts.flatMap(part => part.took_place_at || []).map(rijksLabel).join(', '),
    medium_display: (work.made_of || []).map(rijksLabel).join(', '),
    imageUrl: image.replace(/\/full\/[^/]+\/0\/default\.jpg$/, '/full/!1920,1080/0/default.jpg'),
    is_public_domain: true, credit_line: 'Rijksmuseum · Public Domain'
  };
}

async function loadRijksData(onBatch = () => {}, options = {}) {
  const names = { painting: 'schilderij', drawing: 'tekening', print: 'prent', photograph: 'foto', sculpture: 'beeldhouwwerk' };
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  const queries = types.length && types.every(type => names[type]) ? types.map(type => names[type]) : [''];
  const results = [];
  for (const type of queries) {
    let url = 'https://data.rijksmuseum.nl/search/collection?imageAvailable=true' + (type ? '&type=' + encodeURIComponent(type) : '');
    const candidates = new Set();
    const published = new Set();
    // Page tokens are opaque. Follow them rather than inventing offsets.
    for (let page = 0; page < 100 && url; page++) {
      const data = await museumJSON(url, options);
      const ids = shuffleArray((data.orderedItems || []).map(item => item.id)
        .filter(id => /^https:\/\/id\.rijksmuseum\.nl\/\d+$/.test(id)));
      ids.forEach(id => candidates.add(id));
      if (page === 0) {
        const first = ids.slice(0, 12);
        first.forEach(id => published.add(id));
        results.push(...await loadMuseumObjects(first, async id => rijksArtwork(await museumJSON(id + '?_profile=la-framed', options)), onBatch, options));
      }
      const next = data.next?.id;
      url = next?.startsWith('https://data.rijksmuseum.nl/search/collection?') ? next : null;
    }
    const sample = shuffleArray([...candidates].filter(id => !published.has(id))).slice(0, 148);
    results.push(...await loadMuseumObjects(sample, async id => rijksArtwork(await museumJSON(id + '?_profile=la-framed', options)), onBatch, options));
  }
  return results;
}
