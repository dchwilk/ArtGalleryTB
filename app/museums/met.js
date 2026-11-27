async function loadMETData(onBatch = () => {}, options = {}) {
  const names = { painting: 'Paintings', drawing: 'Drawings', print: 'Prints', photograph: 'Photographs', sculpture: 'Sculpture' };
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  const media = types.length && types.every(type => names[type]) ? types.map(type => names[type]).join('|') : '';
  const params = new URLSearchParams({ hasImages: 'true', q: '*', limit: '40' });
  if (media) params.set('medium', media);
  const url = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?';
  const first = await museumJSON(url + params, options);
  const results = [];
  // The new endpoint allows only the first 10,000 results of a search.
  for (const offset of sampledOffsets(first.total, 40, 5, 10000)) {
    params.set('offset', offset);
    const page = offset ? await museumJSON(url + params, options) : first;
    results.push(...await loadMuseumObjects(shuffleArray(page.objectIDs || []), async id => {
      const work = await museumJSON('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id, options);
      return {
        id: work.objectID, source: 'met', title: work.title, imageUrl: work.primaryImage,
        artist_display: work.artistDisplayName, date_display: work.objectDate,
        date_start: work.objectBeginDate, date_end: work.objectEndDate,
        classification_title: work.classification || work.objectName, objectName: work.objectName,
        department_title: work.department, place_of_origin: work.country, nationality: work.artistNationality,
        medium_display: work.medium, dimensions: work.dimensions, credit_line: work.creditLine,
        is_public_domain: work.isPublicDomain
      };
    }, onBatch, options));
  }
  return results;
}

