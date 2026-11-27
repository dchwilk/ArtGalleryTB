async function loadClevelandData(onBatch = () => {}, options = {}) {
  const names = { painting: 'Painting', drawing: 'Drawing', print: 'Print', photograph: 'Photograph', sculpture: 'Sculpture' };
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  const queries = types.length && types.every(type => names[type]) ? types.map(type => names[type]) : [''];
  const results = [];
  for (const type of queries) {
    const works = await loadSampledMuseum((offset, rows) => {
      const params = new URLSearchParams({ limit: rows, skip: offset, has_image: 1 });
      if (type) params.set('type', type);
      if (options.filters?.properties.includes('publicDomain')) params.set('cc0', '');
      return 'https://openaccess-api.clevelandart.org/api/artworks/?' + params;
    }, data => ({ total: data.info?.total, works: (data.data || []).map(work => ({
      id: work.id, source: 'cleveland', title: work.title,
      imageUrl: work.images?.print?.url || work.images?.web?.url || '',
      imageWidth: work.images?.print?.width || work.images?.web?.width,
      imageHeight: work.images?.print?.height || work.images?.web?.height,
      artist_display: work.creators?.map(creator => creator.description).join(', ') || work.culture?.join(', '),
      date_display: work.creation_date, date_start: work.creation_date_earliest, date_end: work.creation_date_latest,
      classification_title: work.type, department_title: work.department, place_of_origin: work.culture?.join(', '),
      medium_display: work.technique, dimensions: work.measurements, credit_line: work.creditline,
      is_public_domain: work.share_license_status === 'CC0', is_on_view: work.current_location?.includes('Gallery')
    })) }), onBatch, Object.assign({}, options, {maxPages: Math.max(2, Math.floor(8/queries.length))}));
    results.push(...works);
  }
  return results;
}

