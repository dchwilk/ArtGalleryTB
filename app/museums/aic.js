async function loadAICData(onBatch = () => {}, options = {}) {
  const results = [];
  const fields = 'id,title,image_id,artist_display,date_display,date_start,date_end,classification_title,department_title,place_of_origin,medium_display,dimensions,credit_line,is_on_view,is_public_domain,is_zoomable,gallery_title,thumbnail';
  const filters = [{ exists: { field: 'image_id' } }];
  if (options.filters?.properties.includes('publicDomain')) filters.push({ term: { is_public_domain: true } });
  if (!options.filters?.includeUnknown && options.filters?.types.length === 1 && options.filters.types[0] === 'painting') filters.push({ term: { artwork_type_id: 1 } });
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

