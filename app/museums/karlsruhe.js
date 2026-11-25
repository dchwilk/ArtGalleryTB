function karlsruheArtwork(work) {
  // The first image is the main view. Do not substitute a verso or detail.
  const image = work.bilder?.[0];
  if (!image || !['Public Domain', 'CC0'].includes(image.rechte)) return null;
  const id = String(work.imdasid || '');
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  const imageUrl = image.typ === 'LZA' && /^[a-z0-9-]+$/i.test(image.uuid || '')
    ? 'https://expodelivery.bsz-bw.de/iiif/2/skk_' + image.uuid + '/full/!1920,1080/0/default.jpg'
    : 'https://expo.bsz-bw.de/skk/sammlung/image?id=' + id + '&width=1920&pos=0';
  return {
    id, source: 'karlsruhe', title: museumPlainText(work.titel), imageUrl,
    imageWidth: Number(image.width) || null, imageHeight: Number(image.height) || null,
    artist_display: (work.person || []).filter(person => person.typ === 'Künstler').map(person => person.anzeigename).filter(Boolean).join(', '),
    date_display: work.entstehungszeit, date_start: work.anfang || null,
    classification_title: work.objektbezeichnung, department_title: work.sammlung,
    medium_display: [...(work.material || []), ...(work.technik || [])].map(term => term.term).join(', '),
    credit_line: 'Staatliche Kunsthalle Karlsruhe · ' + (image.fotograf || '') + ' · CC0',
    is_public_domain: true
  };
}

async function loadKarlsruheData(onBatch = () => {}, options = {}) {
  const names = { painting: 'Gemälde', photograph: 'Fotografie', sculpture: 'Plastik', drawing: 'Zeichnung', decorative: 'Kunsthandwerk' };
  const types = options.filters?.types || [];
  const query = types.length ? types.map(type => 'gattung all "' + names[type] + '"').join(' or ') : '';
  return loadSampledMuseum((offset, rows) => {
    const params = new URLSearchParams({ mim: 'json', len: rows, fst: offset, flt: 'hatbild:ja' });
    if (query) params.set('qry', 'and ' + query);
    return 'https://expo.bsz-bw.de/skk/sammlung/selekt?' + params;
  }, data => ({ total: data.head?.numFound, works: (data.records || []).map(karlsruheArtwork).filter(Boolean) }), onBatch, options);
}
