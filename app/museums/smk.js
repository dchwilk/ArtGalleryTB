async function loadSMKData(onBatch = () => {}, options = {}) {
  const results = [];
  const seed = Array.from({ length: 5 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const filters = ['[has_image:true]'];
  const names = { painting: 'painting', drawing: 'drawing', print: 'print', photograph: 'photograph', sculpture: 'sculpture' };
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  if (types.length === 1 && names[types[0]]) filters.push('[object_names:' + names[types[0]] + ']');
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
      date_end: work.production_date?.[0]?.end ? parseInt(work.production_date[0].end, 10) : null,
      date_display: work.production_date?.[0]?.period,
      classification_title: work.object_names?.map(type => type.name).join(', '),
      department_title: work.responsible_department, medium_display: work.techniques?.join(', '),
      credit_line: Array.isArray(work.credit_line) ? work.credit_line.join(' · ') : work.credit_line, is_public_domain: work.public_domain === true, is_on_view: work.on_display
    }));
    await publishMuseumBatch(results, batch, onBatch, options);
    if (batch.length < 40) break;
  }
  return results;
}

