// Each adapter publishes small batches using the same artwork model.
// New adapters use public APIs without registration or proxy services.
async function museumJSON(url, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, options.timeout || 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (error) {
    if (timedOut && !options.signal?.aborted) throw new Error('Museum request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

function checkCollectionRequest(options) {
  if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

async function publishMuseumBatch(results, batch, onBatch, options) {
  checkCollectionRequest(options);
  const usable = batch.filter(work => work.imageUrl && work.title).map(normalizeArtwork);
  results.push(...usable);
  await onBatch(usable);
}

async function loadAICData(onBatch = () => {}, options = {}) {
  const results = [];
  const fields = 'id,title,image_id,artist_display,date_display,date_start,classification_title,department_title,place_of_origin,medium_display,dimensions,credit_line,is_on_view,is_public_domain,is_zoomable,gallery_title,thumbnail';
  const filters = [{ exists: { field: 'image_id' } }];
  if (options.filters?.properties.includes('publicDomain')) filters.push({ term: { is_public_domain: true } });
  if (options.filters?.types.length === 1 && options.filters.types[0] === 'painting') filters.push({ term: { artwork_type_id: 1 } });
  const query = { function_score: { query: { bool: { filter: filters } }, boost_mode: 'replace', random_score: { field: 'id', seed: Math.floor(Math.random() * 1000000) } } };
  for (let page = 1; page <= 5; page++) {
    const params = encodeURIComponent(JSON.stringify({ query, fields: fields.split(','), limit: 40 }));
    const data = await museumJSON(`https://api.artic.edu/api/v1/artworks/search?page=${page}&params=${params}`, options);
    const batch = (data.data || []).map(work => Object.assign({}, work, {
      source: 'aic', imageUrl: work.image_id ? `https://www.artic.edu/iiif/2/${work.image_id}/full/1920,/0/default.jpg` : ''
    }));
    await publishMuseumBatch(results, batch, onBatch, options);
    if (batch.length < 40) break;
  }
  return results;
}

async function loadMETData(onBatch = () => {}, options = {}) {
  const results = [];
  const q = options.filters?.types.length === 1 ? options.filters.types[0] : 'art';
  const data = await museumJSON('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=' + encodeURIComponent(q), options);
  const ids = shuffleArray(data.objectIDs || []).slice(0, 100);
  for (let i = 0; i < ids.length; i += 2) {
    const batch = await Promise.all(ids.slice(i, i + 2).map(async id => {
      try {
        const work = await museumJSON('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id, options);
        return {
          id: work.objectID, source: 'met', title: work.title, imageUrl: work.primaryImage,
          artist_display: work.artistDisplayName, date_display: work.objectDate, date_start: work.objectBeginDate,
          classification_title: work.objectName, department_title: work.department, place_of_origin: work.country,
          medium_display: work.medium, dimensions: work.dimensions, credit_line: work.creditLine,
          is_public_domain: work.isPublicDomain
        };
      } catch (error) { checkCollectionRequest(options); return null; }
    }));
    await publishMuseumBatch(results, batch.filter(Boolean), onBatch, options);
  }
  return results;
}

async function loadClevelandData(onBatch = () => {}, options = {}) {
  const results = [];
  for (let skip = 0; skip < 200; skip += 40) {
    const data = await museumJSON(`https://openaccess-api.clevelandart.org/api/artworks/?limit=40&skip=${skip}&has_image=1`, options);
    const batch = (data.data || []).map(work => ({
      id: work.id, source: 'cleveland', title: work.title,
      imageUrl: work.images?.web?.url || '', imageWidth: work.images?.web?.width, imageHeight: work.images?.web?.height,
      artist_display: work.creators?.map(creator => creator.description).join(', ') || work.culture?.join(', '),
      date_display: work.creation_date, date_start: work.creation_date_earliest,
      classification_title: work.type, department_title: work.department, place_of_origin: work.culture?.join(', '),
      medium_display: work.technique, dimensions: work.measurements, credit_line: work.creditline,
      is_public_domain: work.share_license_status === 'CC0', is_on_view: work.current_location?.includes('Gallery')
    }));
    await publishMuseumBatch(results, batch, onBatch, options);
    if (batch.length < 40) break;
  }
  return results;
}

async function loadSMKData(onBatch = () => {}, options = {}) {
  const results = [];
  const seed = Array.from({ length: 5 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const filters = ['[has_image:true]'];
  if (options.filters?.properties.includes('publicDomain')) filters.push('[public_domain:true]');
  for (let offset = 0; offset < 200; offset += 40) {
    const url = `https://api.smk.dk/api/v1/art/search/?keys=*&lang=en&rows=40&offset=${offset}&randomHighlights=${seed}&filters=${encodeURIComponent(filters.join(','))}`;
    const data = await museumJSON(url, options);
    const batch = (data.items || []).map(work => ({
      id: work.object_number || work.id, source: 'smk', title: work.titles?.[0]?.title,
      imageUrl: work.image_iiif_id ? work.image_iiif_id + '/full/!1920,1080/0/default.jpg' : work.image_thumbnail,
      imageWidth: work.image_width, imageHeight: work.image_height,
      artist_display: work.artist?.join(', ') || work.production?.map(person => person.creator).join(', '),
      nationality: work.production?.map(person => person.creator_nationality).join(', '),
      date_start: work.production_date?.[0]?.start ? parseInt(work.production_date[0].start, 10) : null,
      date_display: work.production_date?.[0]?.period,
      classification_title: work.object_names?.map(type => type.name).join(', '),
      department_title: work.responsible_department, medium_display: work.techniques?.join(', '),
      credit_line: work.credit_line, is_public_domain: work.public_domain === true, is_on_view: work.on_display
    }));
    await publishMuseumBatch(results, batch, onBatch, options);
    if (batch.length < 40) break;
  }
  return results;
}

function linkedLabels(values) {
  return (values || []).map(value => value._label || value.content || '').filter(Boolean).join(', ');
}

function gettyArtwork(work, media) {
  // Metadata CC0 alone does not license the image: check the media's own rights.
  const publicDomain = (media.subject_to || []).some(right => (right.classified_as || []).some(type =>
    /creativecommons.org\/publicdomain\/(zero|mark)\//.test(type.id || '')
  ));
  if (!publicDomain) return null;
  const digital = media.digitally_shown_by?.[0];
  const service = digital?.access_point?.find(point => /\/iiif\/image\//.test(point.id || '') && !/default\.jpg/.test(point.id));
  const image = service ? service.id.replace(/\/$/, '') + '/full/!1920,1080/0/default.jpg'
    : digital?.access_point?.find(point => point.format === 'image/jpeg')?.id;
  if (!image) return null;
  const pixelSize = label => digital?.dimension?.find(dimension => dimension.classified_as?.some(type => (type._label || '').toLowerCase() === label))?.value;
  const production = work.produced_by || {};
  const date = production.timespan?.begin_of_the_begin;
  return {
    id: work.id, source: 'getty', title: work.identified_by?.find(name => name.type === 'Name' && name.classified_as?.some(type => /preferred/i.test(type._label || '')))?.content || work._label,
    imageUrl: image, imageWidth: pixelSize('width'), imageHeight: pixelSize('height'),
    artist_display: linkedLabels(production.carried_out_by),
    date_start: date ? parseInt(date, 10) : null,
    date_display: production.timespan?.identified_by?.[0]?.content,
    classification_title: linkedLabels(work.classified_as),
    department_title: linkedLabels(work.member_of),
    place_of_origin: linkedLabels(production.took_place_at),
    nationality: production.referred_to_by?.filter(text => /nationality/i.test(text._label || '')).map(text => text.content).join(', '),
    medium_display: linkedLabels(work.made_of), is_public_domain: true, credit_line: 'J. Paul Getty Museum'
  };
}

async function loadGettyData(onBatch = () => {}, options = {}) {
  const results = [];
  if (options.filters?.types.length === 1 && options.filters.types[0] === 'painting') {
    // Query paintings directly; the latest change feed may consist entirely of coins or lamps.
    const query = 'SELECT DISTINCT ?object WHERE { ?object <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> <http://vocab.getty.edu/aat/300033618> } LIMIT 160';
    let ids;
    try {
      const search = await museumJSON('https://data.getty.edu/museum/collection/sparql?query=' + encodeURIComponent(query) + '&format=json', options);
      ids = shuffleArray((search.results?.bindings || []).map(row => row.object?.value)
        .filter(id => /^https:\/\/data.getty.edu\/museum\/collection\/object\/[\w-]+$/.test(id))).slice(0, 40);
    } catch (error) { checkCollectionRequest(options); }
    if (ids?.length) {
      for (let i = 0; i < ids.length; i += 2) {
        const batch = await Promise.all(ids.slice(i, i+2).map(async id => {
          try {
            const work = await museumJSON(id, options);
            const reference = work.shows?.find(item => /^https:\/\/data.getty.edu\/media\/image\//.test(item.id));
            return reference ? gettyArtwork(work, await museumJSON(reference.id, options)) : null;
          } catch (error) { checkCollectionRequest(options); return null; }
        }));
        await publishMuseumBatch(results, batch.filter(Boolean), onBatch, options);
      }
      return results;
    }
  }
  const root = await museumJSON('https://data.getty.edu/museum/collection/activity-stream', options);
  let pageUrl = root.last?.id;
  const seen = new Set();
  for (let page = 0; page < 6 && pageUrl && seen.size < 40; page++) {
    const data = await museumJSON(pageUrl, options);
    const ids = (data.orderedItems || []).filter(event => event.type !== 'Delete')
      .map(event => event.object).filter(object => object?.type === 'HumanMadeObject' && /^https:\/\/data.getty.edu\/museum\/collection\/object\/[\w-]+$/.test(object.id))
      .map(object => object.id).filter(id => !seen.has(id)).slice(0, 40 - seen.size);
    ids.forEach(id => seen.add(id));
    for (let i = 0; i < ids.length; i += 2) {
      const batch = await Promise.all(ids.slice(i, i+2).map(async id => {
        try {
          const work = await museumJSON(id, options);
          const reference = work.shows?.find(item => /^https:\/\/data.getty.edu\/media\/image\//.test(item.id));
          if (!reference) return null;
          return gettyArtwork(work, await museumJSON(reference.id, options));
        } catch (error) { checkCollectionRequest(options); return null; }
      }));
      await publishMuseumBatch(results, batch.filter(Boolean), onBatch, options);
    }
    pageUrl = data.prev?.id;
    if (pageUrl && !pageUrl.startsWith('https://data.getty.edu/museum/collection/activity-stream/')) break;
  }
  return results;
}

// Existing optional legacy Rijks adapter. Not selected on first run.
    async function loadRijksData() {
      const results = [];
      const apiKey = '0fiuZFh4'; // Public API key
      const totalPages = 2;

      try {
        for (let page = 1; page <= totalPages; page++) {
          const res = await fetch(`https://www.rijksmuseum.nl/api/en/collection?key=${apiKey}&p=${page}&ps=100&imgonly=true&toppieces=true`);
          const data = await res.json();

          if (data.artObjects) {
            const filteredData = data.artObjects.filter(artwork =>
              artwork.webImage && artwork.title && artwork.principalOrFirstMaker
            ).map(artwork => ({
              id: artwork.id,
              title: artwork.title,
              image_id: artwork.id,
              artist_display: artwork.principalOrFirstMaker,
              date_display: artwork.longTitle.split(', ').pop(),
              date_start: artwork.dating?.yearEarly || 0,
              classification_title: artwork.objectTypes?.[0] || 'Artwork',
              department_title: 'Rijksmuseum',
              place_of_origin: artwork.productionPlaces?.[0] || 'Netherlands',
              medium_display: artwork.materials?.[0] || '',
              dimensions: '',
              credit_line: '',
              is_public_domain: true,
              is_zoomable: true,
              source: 'rijks',
              imageUrl: artwork.webImage.url.replace('=s0', '=s1000')
            }));

            results.push(...filteredData);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } catch (error) {
        console.error('Rijksmuseum API Error:', error);
      }

      return results;
    }
