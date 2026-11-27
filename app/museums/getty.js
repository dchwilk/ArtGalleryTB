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
    date_end: production.timespan?.end_of_the_end ? parseInt(production.timespan.end_of_the_end, 10) : null,
    date_display: production.timespan?.identified_by?.[0]?.content,
    classification_title: linkedLabels(work.classified_as),
    department_title: linkedLabels(work.member_of),
    place_of_origin: linkedLabels(production.took_place_at),
    nationality: production.referred_to_by?.filter(text => /nationality/i.test(text._label || '')).map(text => text.content).join(', '),
    medium_display: linkedLabels(work.made_of), is_public_domain: true, credit_line: 'J. Paul Getty Museum'
  };
}

async function loadGettyData(onBatch = () => {}, options = {}) {
  const typeIds = { painting: '300033618', drawing: '300033973', print: '300041273', photograph: '300046300', sculpture: '300047090' };
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  const selected = types.length && types.every(type => typeIds[type]) ? types.map(type => typeIds[type]) : [];
  const where = selected.length
    ? 'VALUES ?type { ' + selected.map(id => '<http://vocab.getty.edu/aat/' + id + '>').join(' ') + ' } ?object <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> ?type .'
    : '?object a <http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object> .';
  const search = query => museumJSON('https://data.getty.edu/museum/collection/sparql?query=' + encodeURIComponent(query) + '&format=json', options);
  const count = await search('SELECT (COUNT(DISTINCT ?object) AS ?count) WHERE { ' + where + ' }');
  const total = Number(count.results?.bindings?.[0]?.count?.value) || 0;
  const results = [];
  for (const offset of sampledOffsets(total, 40, 4)) {
    const data = await search('SELECT DISTINCT ?object WHERE { ' + where + ' } ORDER BY ?object LIMIT 40 OFFSET ' + offset);
    const ids = shuffleArray((data.results?.bindings || []).map(row => row.object?.value)
      .filter(id => /^https:\/\/data.getty.edu\/museum\/collection\/object\/[\w-]+$/.test(id)));
    results.push(...await loadMuseumObjects(ids, async id => {
      const work = await museumJSON(id, options);
      const reference = work.shows?.find(item => /^https:\/\/data.getty.edu\/media\/image\//.test(item.id));
      return reference ? gettyArtwork(work, await museumJSON(reference.id, options)) : null;
    }, onBatch, options));
  }
  return results;
}
