const { test, expect } = require('@playwright/test');
const createServer = require('./server.cjs');
let server;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="tan"/></svg>';
const mdWork = {
  object_id: 42, object_name: 'Landschaft', object_type: 'Gemälde', md_subset: 'brandenburg',
  object_institution: { institution_id: 12, institution_name: 'Museum Beispiel' },
  object_material_technique: 'Öl auf Leinwand', object_dimensions: '40 × 60 cm',
  object_events: [{ event_type: 1, people: { displayname: 'Test Artist' }, time: { time_start: '1880', time_name: 'um 1880' } }],
  object_images: [{ is_main: 'j', intern: 'j', folder: 'images/1/202309/3', filename_loc: 'gemälde.jpg', rights: 'Public Domain Mark', creator: 'Fotograf' }],
  licence: { metadata_rights_status: 'CC0' }
};
const kaWork = {
  imdasid: 'A123', titel: 'Karlsruhe landscape', objektbezeichnung: 'Gemälde', anfang: '1880',
  person: [{ typ: 'Künstler', anzeigename: 'Test Artist' }],
  bilder: [{ typ: 'LZA', uuid: 'abcd-1234', rechte: 'Public Domain', width: '6000', height: '4000' }]
};
test.beforeAll(async () => { server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); });
test.afterAll(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); });
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.route('https://api.artic.edu/**', route => route.fulfill({ json: { data: [{ id: 1, title: 'Default', source: 'aic', image_id: 'test', classification_title: 'Painting', is_public_domain: true }] } }));
  await page.route('https://www.artic.edu/iiif/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  await page.route('https://api.smk.dk/**', route => route.fulfill({ json: { items: [] } }));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  await page.evaluate(() => clearTimeout(interval));
});

test('German adapters use main-image rights, safe full-size URLs and shared types', async ({ page }) => {
  const actual = await page.evaluate(({ mdWork, kaWork }) => {
    const md = normalizeArtwork(museumDigitalArtwork(mdWork));
    const ka = normalizeArtwork(karlsruheArtwork(kaWork));
    const modified = (object, changes) => Object.assign({}, object, changes);
    return {
      md, ka,
      metadataOnly: museumDigitalArtwork(modified(mdWork, { object_images: [modified(mdWork.object_images[0], { rights: 'RR-F' })] })),
      noMain: museumDigitalArtwork(modified(mdWork, { object_images: [modified(mdWork.object_images[0], { is_main: 'n' })] })),
      externalCatalogue: museumDigitalArtwork(modified(mdWork, { object_images: [modified(mdWork.object_images[0], { intern: 'n', filename_loc: 'https://museum.example/object/42' })] })),
      unsafePath: museumDigitalArtwork(modified(mdWork, { md_subset: '..' })),
      protectedFront: karlsruheArtwork(modified(kaWork, { bilder: [modified(kaWork.bilder[0], { rechte: 'VG Bild-Kunst' }), kaWork.bilder[0]] }))
    };
  }, { mdWork, kaWork });
  expect(actual.md).toMatchObject({ source: 'museumdigital', museumName: 'Museum Beispiel', date_start: 1880, is_public_domain: true, categories: { types: ['painting'] } });
  expect(actual.md.imageUrl).toBe('https://asset.museum-digital.org/brandenburg/images/1/202309/3/gem%C3%A4lde.jpg');
  expect(actual.ka).toMatchObject({ source: 'karlsruhe', imageWidth: 6000, imageHeight: 4000, categories: { types: ['painting'] } });
  expect(actual.metadataOnly).toBeNull(); expect(actual.noMain).toBeNull();
  expect(actual.externalCatalogue).toBeNull(); expect(actual.unsafePath).toBeNull(); expect(actual.protectedFront).toBeNull();
});

test('Karlsruhe streams first page then distinct random pages with native image sizes', async ({ page }) => {
  const offsets = [];
  await page.route('https://expo.bsz-bw.de/skk/sammlung/selekt?**', route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('fst')); offsets.push(offset);
    expect(url.searchParams.get('qry')).toBe('and gattung all "Gemälde"');
    return route.fulfill({ json: { head: { numFound: '280' }, records: [{ ...kaWork, imdasid: 'A' + offset }] } });
  });
  const result = await page.evaluate(async () => {
    const batches = [];
    const works = await loadKarlsruheData(batch => { batches.push(batch.length); }, { filters: getSelectedFilters() });
    return { count: works.length, batches };
  });
  expect(offsets[0]).toBe(0); expect(new Set(offsets).size).toBe(7);
  expect(result).toEqual({ count: 7, batches: [1, 1, 1, 1, 1, 1, 1] });
});

test('museum-digital loads eligible works and a later source failure keeps the displayed image', async ({ page }) => {
  let calls = 0;
  await page.route('https://nat.museum-digital.de/export/json/**', route => {
    calls++;
    return calls === 1 ? route.fulfill({ json: { results: { total: 200, objects: { '42': mdWork } } } })
      : route.fulfill({ status: 503, body: 'Temporarily unavailable' });
  });
  await page.route('https://asset.museum-digital.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  await page.evaluate(() => {
    Object.values({ a: 'sourceAIC', b: 'sourceSMK' }).forEach(id => { document.getElementById(id).checked = false; });
    document.getElementById('sourceMuseumDigital').checked = true;
    return loadAllArtworks();
  });
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#infoBox')).toContainText('Museum Beispiel');
  await expect(page.locator('#collectionStatus')).toContainText('museum-digital');
  expect(await page.evaluate(() => artworks.length)).toBe(1);
});

test('cancelling a German catalogue request does not publish stale batches', async ({ page }) => {
  let request;
  await page.route('https://expo.bsz-bw.de/skk/sammlung/selekt?**', route => { request = route; });
  await page.evaluate(() => {
    window.cancelTest = new AbortController(); window.published = 0;
    window.cancelled = loadKarlsruheData(() => { window.published++; }, { signal: cancelTest.signal, filters: getSelectedFilters() }).catch(e => e.name);
  });
  await expect.poll(() => Boolean(request)).toBe(true);
  expect(await page.evaluate(async () => { cancelTest.abort(); return await cancelled; })).toBe('AbortError');
  expect(await page.evaluate(() => published)).toBe(0);
});

test('menu actions persist settings and shuffle without reloading metadata', async ({ page }) => {
  await page.evaluate(() => {
    resetImageLoading();
    artworks = Array.from({ length: 10 }, (_, id) => ({ id, title: 'Work ' + id, source: 'aic', image_id: 'test' }));
    randomizedOrder = artworks.map((_, id) => id); currentIndex = 0; showArtwork();
    toggleMenu(); switchTab('settings');
  });
  await page.locator('#fasterButton').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#timeLabel')).toHaveText('15');
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#slowerButton')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#timeLabel')).toHaveText('30');
  await page.locator('#frameStyleButton').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#styleLabel')).toHaveText('modern');
  await page.locator('#matColorButton').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#colorLabel')).toHaveText('Sand');
  await expect.poll(() => page.evaluate(() => pendingImage === null)).toBe(true);
  const before = await page.evaluate(() => randomizedOrder[currentIndex]);
  const generation = await page.evaluate(() => collectionRequestId);
  await page.locator('#shuffleButton').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#shuffleStatus')).toHaveText('Reihenfolge neu gemischt.');
  expect(await page.evaluate(() => randomizedOrder[currentIndex])).not.toBe(before);
  expect(await page.evaluate(() => collectionRequestId)).toBe(generation);
  await expect(page.locator('#menuOverlay')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(SETTINGS_KEY)));
  expect(saved).toMatchObject({ timer: 30, frameStyle: 'modern', matColor: '#cdc4a2' });
});

test('remote arrows reach and scroll every legend row', async ({ page }) => {
  await page.evaluate(() => { toggleMenu(); switchTab('settings'); });
  await page.locator('#reloadCollectionButton').focus();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.legend-row').nth(i)).toBeFocused();
    const box = await page.locator('.legend-row').nth(i).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
  await page.keyboard.press('ArrowDown'); await expect(page.locator('.remote-legend p[tabindex]').first()).toBeFocused();
});

test('aggregated museums are mixed without increasing museum-digital source share', async ({ page }) => {
  const result = await page.evaluate(() => {
    artworks = ['a', 'b', 'c'].flatMap(museumId => Array.from({ length: 10 }, (_, id) => ({ source: 'museumdigital', museumId, id: museumId + id })));
    artworks.push(...Array.from({ length: 3 }, (_, id) => ({ source: 'karlsruhe', id })));
    const order = buildRandomizedOrder();
    return { sources: order.map(i => artworks[i].source), museums: order.filter(i => artworks[i].source === 'museumdigital').map(i => artworks[i].museumId) };
  });
  expect(result.sources.filter(s => s === 'karlsruhe')).toHaveLength(30);
  for (let i = 0; i < 30; i += 3) expect(new Set(result.museums.slice(i, i + 3)).size).toBe(3);
});

test('remote timeout is reported and museum metadata cannot become active markup', async ({ page }) => {
  await page.route('https://timeout.test/**', () => {});
  const result = await page.evaluate(async () => {
    renderArtworkInfo({ title: '<img src=x onerror="window.badMetadata=true">', source: 'museumdigital', museumName: 'A & B' });
    try { await museumJSON('https://timeout.test/data', { timeout: 30 }); } catch(e) { return { message: e.message, bad: Boolean(window.badMetadata), injectedImages: infoBox.querySelectorAll('img').length }; }
  });
  expect(result).toEqual({ message: 'Museum request timed out', bad: false, injectedImages: 0 });
  await expect(page.locator('#infoBox')).toContainText('<img src=x');
});
