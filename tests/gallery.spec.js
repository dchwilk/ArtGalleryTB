const { test, expect } = require('@playwright/test');
const createServer = require('./server.cjs');
let server;
const errors = new WeakMap();
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="tan"/></svg>';
const collection = [
  { id: 1, title: 'European work', artist_display: 'Artist', image_id: 'europe', department_title: 'Painting and Sculpture of Europe', classification_title: 'Painting', is_public_domain: true },
  { id: 2, title: 'American work', artist_display: 'Artist', image_id: 'america', department_title: 'Arts of the Americas', classification_title: 'Painting', is_public_domain: true },
  { id: 3, title: 'Asian work', artist_display: 'Artist', image_id: 'asia', department_title: 'Arts of Asia', classification_title: 'Sculpture', is_public_domain: true }
];

test.beforeAll(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://api.artic.edu/**', route => route.fulfill({ json: {
    data: new URL(route.request().url()).searchParams.get('page') === '1' ? collection : []
  } }));
  await page.route('https://www.artic.edu/iiif/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  await page.route('https://api.smk.dk/**', route => route.fulfill({ json: { items: [] } }));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function openGallery(page) {
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await page.evaluate(() => clearTimeout(interval));
}

async function setImages(page, urls) {
  await page.evaluate(urls => {
    clearTimeout(interval);
    resetImageLoading();
    artworks = urls.map((url, id) => ({ id, title: 'Image ' + id, imageUrl: url }));
    randomizedOrder = artworks.map((_, id) => id);
    currentIndex = 0;
    showArtwork();
  }, urls);
}

test('first-run defaults select fast public-domain paintings and do not override saved choices', async ({ page }) => {
  await openGallery(page);
  expect(await page.evaluate(() => ({ sources: getSelectedSources(), filters: getSelectedFilters() }))).toMatchObject({
    sources: ['aic', 'smk'], filters: { types: ['painting'], properties: ['publicDomain', 'withImages'], landscape: false }
  });
  await page.evaluate(() => {
    document.getElementById('sourcePaintings').checked = false;
    document.getElementById('onlyPublicDomain').checked = false;
    document.getElementById('onlyLandscape').checked = true;
    saveSettings();
  });
  await page.reload();
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#sourcePaintings')).not.toBeChecked();
  await expect(page.locator('#onlyPublicDomain')).not.toBeChecked();
  await expect(page.locator('#onlyLandscape')).toBeChecked();
});

test('museum terms share common categories and missing dates remain unknown', async ({ page }) => {
  await openGallery(page);
  const actual = await page.evaluate(() => {
    const rows = [
      { source: 'aic', classification_title: 'Painting', place_of_origin: 'France', date_start: 1880 },
      { source: 'smk', classification_title: 'Maleri', nationality: 'Danish', date_start: 1880 },
      { source: 'getty', classification_title: 'Paintings', nationality: 'Dutch', date_start: 1880 },
      { source: 'rijks', classification_title: 'schilderij', country: 'Netherlands', date_start: 1880 }
    ];
    const filters = { types: ['painting'], departments: ['european'], periods: [{ start: 1750, end: 1949 }], properties: [], landscape: false };
    return {
      matches: rows.map(row => matchesFilters(row, filters)),
      unknown: matchesFilters({ classification_title: 'Painting' }, filters),
      zero: normalizeArtwork({ date_start: 0 }).date_start,
      modern: matchesDepartment(rows[0], 'modern'),
      future: matchesFilters({ date_start: 2040 }, { types: [], departments: [], periods: [{ start: 1950, end: Infinity }], properties: [] })
    };
  });
  expect(actual).toEqual({ matches: [true, true, true, true], unknown: false, zero: 0, modern: true, future: true });
});

test('landscape filter rejects known portraits and measures unknown images before display', async ({ page }) => {
  await openGallery(page);
  await page.route('https://images.test/portrait', route => route.fulfill({ contentType: 'image/svg+xml', body: svg.replace('width="120" height="90"', 'width="90" height="120"') }));
  await page.route('https://images.test/wide', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  expect(await page.evaluate(() => matchesFilters({ imageWidth: 80, imageHeight: 100 }, {
    types: [], departments: [], periods: [], properties: [], landscape: true
  }))).toBe(false);
  await page.evaluate(() => { activeFilters.landscape = true; });
  await setImages(page, ['https://images.test/portrait', 'https://images.test/wide']);
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  await expect(page.locator('#art')).toHaveJSProperty('naturalWidth', 120);
  await expect(page.locator('#art')).toHaveJSProperty('naturalHeight', 90);
});

test('brightness dims image, frame and mat together and supports remote arrows', async ({ page }, testInfo) => {
  await openGallery(page);
  await page.keyboard.press('m');
  const step = testInfo.project.name === 'tv-720p' ? 'ArrowRight' : 'ArrowDown';
  for (let i = 0; i < 5; i++) await page.keyboard.press(step);
  await page.keyboard.press('Enter');
  await expect(page.locator('#brightnessEnabled')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#brightnessSlider')).toBeFocused();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#brightnessLabel')).toHaveText('60 %');
  await expect(page.locator('#frame')).toHaveCSS('filter', 'brightness(0.6)');
  await expect(page.locator('#frame')).toHaveCSS('background-color', 'rgb(227, 224, 211)');
  await expect(page.locator('#passepartout')).toHaveCSS('filter', 'none'); // Single filter on the ancestor includes the mat.
  await expect(page.locator('#menuOverlay')).toHaveCSS('filter', 'none');
  await page.keyboard.press('Escape');
  if (testInfo.project.name === 'tv-1080p') await page.screenshot({ path: '../work/ArtGalleryTB-gedimmt.png' });
  await page.reload();
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#brightnessSlider')).toHaveValue('60');
  await expect(page.locator('#brightnessEnabled')).toBeChecked();
  await expect(page.locator('#frame')).toHaveCSS('filter', 'brightness(0.6)');
  await page.evaluate(() => { document.getElementById('brightnessEnabled').checked = false; applyBrightness(); });
  await expect(page.locator('#frame')).toHaveCSS('filter', 'none');
});

test('first batch displays before later metadata arrives without a loading overlay', async ({ page }) => {
  let later;
  await page.route('https://api.artic.edu/**', route => {
    const pageNumber = new URL(route.request().url()).searchParams.get('page');
    if (pageNumber === '1') return route.fulfill({ json: { data: Array.from({length:40}, (_,i) => ({ ...collection[0], id: i+1, image_id: 'first'+i })) } });
    later = route;
  });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await expect(page.locator('#collectionStatus')).toContainText('Hintergrund');
  await expect.poll(() => Boolean(later)).toBe(true);
  await later.fulfill({ json: { data: [{ ...collection[0], id: 99, image_id: 'later' }] } });
  await expect(page.locator('#artworkCount')).toHaveText('41');
  await expect(page.locator('#collectionStatus')).toHaveText('');
  await expect(page.locator('#loadingInfo')).toBeHidden();
});

test('one lookahead image is fetched silently and reused for the next slide', async ({ page }) => {
  await openGallery(page);
  const requests = [];
  await page.route('https://images.test/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'image/svg+xml', headers: { 'Cache-Control': 'no-store' }, body: svg });
  });
  await page.clock.install();
  await setImages(page, ['https://images.test/first', 'https://images.test/second', 'https://images.test/third']);
  await expect(page.locator('#infoBox')).toContainText('Image 0');
  await page.clock.fastForward(301);
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.locator('#loadingInfo')).toBeHidden();
  expect(requests).not.toContain('https://images.test/third');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  expect(requests.filter(url => url.endsWith('/second')).length).toBe(1);
});

test('museum shuffle stays balanced despite unequal counts and avoids long runs', async ({ page }) => {
  await openGallery(page);
  const result = await page.evaluate(() => {
    resetImageLoading();
    artworks = [
      ...Array.from({length:50}, (_,id) => ({ source:'aic', id })),
      ...Array.from({length:3}, (_,id) => ({ source:'smk', id })),
      ...Array.from({length:8}, (_,id) => ({ source:'getty', id }))
    ];
    return Array.from({length:25}, () => {
      const order = buildRandomizedOrder();
      const counts = {};
      let maxRun = 0, run = 0, previous;
      for (const index of order) {
        const source = artworks[index].source;
        counts[source] = (counts[source] || 0) + 1;
        run = source === previous ? run + 1 : 1;
        previous = source;
        maxRun = Math.max(maxRun, run);
      }
      return { counts, maxRun, smkFirstCycle: order.filter(i => artworks[i].source === 'smk').slice(0,3) };
    });
  });
  for (const run of result) {
    expect(run.counts).toEqual({ aic:50, smk:50, getty:50 });
    expect(run.maxRun).toBeLessThanOrEqual(3);
    expect(new Set(run.smkFirstCycle).size).toBe(3);
  }
});

test('SMK adapter maps translated data, rights and image dimensions', async ({ page }) => {
  await openGallery(page);
  await page.route('https://api.smk.dk/**', route => route.fulfill({ json: { items: [{
    object_number:'SMK1', titles:[{title:'Danish landscape'}], object_names:[{name:'Painting'}],
    artist:['Artist'], production:[{creator_nationality:'Danish'}], production_date:[{start:'1880-01-01',period:'1880'}],
    public_domain:true, image_iiif_id:'https://smk-images.test/iiif/1', image_width:2500, image_height:1500
  }] } }));
  const data = await page.evaluate(() => loadSMKData());
  expect(data[0]).toMatchObject({ source:'smk', title:'Danish landscape', date_start:1880, imageWidth:2500, is_public_domain:true,
    categories:{ types:['painting'], regions:['european'] } });
  expect(data[0].imageUrl).toContain('/full/!1920,1080/0/default.jpg');
});

test('Getty media rights are checked separately from collection metadata', async ({ page }) => {
  await openGallery(page);
  const result = await page.evaluate(() => {
    const work = { id:'getty1', _label:'Irises', classified_as:[{_label:'Paintings'}],
      subject_to:[{classified_as:[{id:'http://creativecommons.org/publicdomain/zero/1.0/'}]}],
      produced_by:{ carried_out_by:[{_label:'Van Gogh'}], timespan:{begin_of_the_begin:'1889-01-01'}, referred_to_by:[{_label:'Nationality',content:'Dutch'}] } };
    const media = { digitally_shown_by:[{ access_point:[{id:'https://media.getty.edu/iiif/image/123'}],
      dimension:[{classified_as:[{_label:'Width'}],value:2000},{classified_as:[{_label:'Height'}],value:1500}] }] };
    const restricted = gettyArtwork(work, media);
    media.subject_to = [{classified_as:[{id:'http://creativecommons.org/publicdomain/zero/1.0/'}]}];
    return { restricted, open: normalizeArtwork(gettyArtwork(work, media)) };
  });
  expect(result.restricted).toBeNull();
  expect(result.open).toMatchObject({ source:'getty', date_start:1889, imageWidth:2000, is_public_domain:true,
    categories:{ types:['painting'], regions:['european'] } });
});

test('a failing source does not discard works from another museum', async ({ page }) => {
  await openGallery(page);
  await page.evaluate(async () => {
    document.getElementById('sourceSMK').checked = true;
    loadSMKData = async () => { throw new Error('Museum unavailable'); };
    await loadAllArtworks();
  });
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await expect(page.locator('#collectionStatus')).toContainText('SMK');
});

test('Getty adapter follows activity records and separately licensed media', async ({ page }) => {
  await openGallery(page);
  await page.route('https://data.getty.edu/**', route => {
    const url = route.request().url();
    if (url.endsWith('/activity-stream')) return route.fulfill({ json: { last:{id:'https://data.getty.edu/museum/collection/activity-stream/page/1'} } });
    if (url.includes('/activity-stream/page/')) return route.fulfill({ json: { orderedItems:[
      {type:'Update', object:{type:'HumanMadeObject',id:'https://data.getty.edu/museum/collection/object/test-1'}},
      {type:'Delete', object:{type:'HumanMadeObject',id:'https://data.getty.edu/museum/collection/object/deleted'}}
    ] } });
    if (url.includes('/collection/object/')) return route.fulfill({ json: {
      id:'test-1', _label:'Getty painting', classified_as:[{_label:'Paintings'}],
      shows:[{id:'https://data.getty.edu/media/image/test-1'}],
      produced_by:{timespan:{begin_of_the_begin:'1880-01-01'}}
    } });
    return route.fulfill({ json: {
      subject_to:[{classified_as:[{id:'http://creativecommons.org/publicdomain/zero/1.0/'}]}],
      digitally_shown_by:[{ access_point:[{id:'https://media.getty.edu/iiif/image/test-1'}] }]
    } });
  });
  const result = await page.evaluate(() => loadGettyData());
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({title:'Getty painting', source:'getty', is_public_domain:true, categories:{types:['painting']}});
});

test('unknown high-resolution metadata is verified against the loaded pixels', async ({ page }) => {
  await openGallery(page);
  await page.route('https://images.test/low', route => route.fulfill({ contentType:'image/svg+xml', body:svg }));
  await page.route('https://images.test/high', route => route.fulfill({ contentType:'image/svg+xml', body:svg.replace('width="120" height="90"', 'width="1700" height="1000"') }));
  await page.evaluate(() => { activeFilters.properties = ['highRes']; });
  await setImages(page, ['https://images.test/low', 'https://images.test/high']);
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  await expect(page.locator('#art')).toHaveJSProperty('naturalWidth', 1700);
});

test('Getty painting selection queries the painting catalogue instead of recent artifact updates', async ({ page }) => {
  await openGallery(page);
  let searched = false;
  await page.route('https://data.getty.edu/**', route => {
    const url = route.request().url();
    if (url.includes('/sparql?')) {
      searched = true;
      expect(decodeURIComponent(url)).toContain('300033618');
      return route.fulfill({ json:{ results:{ bindings:[{object:{value:'https://data.getty.edu/museum/collection/object/painting-1'}}] } } });
    }
    if (url.includes('/collection/object/')) return route.fulfill({ json:{ id:'painting-1', _label:'A painting', classified_as:[{_label:'Paintings'}], shows:[{id:'https://data.getty.edu/media/image/painting-1'}] } });
    return route.fulfill({ json:{ subject_to:[{classified_as:[{id:'http://creativecommons.org/publicdomain/zero/1.0/'}]}], digitally_shown_by:[{access_point:[{id:'https://media.getty.edu/iiif/image/painting-1'}]}] } });
  });
  const result = await page.evaluate(() => loadGettyData(() => {}, {filters:getSelectedFilters()}));
  expect(searched).toBe(true);
  expect(result).toHaveLength(1);
  expect(result[0].categories.types).toContain('painting');
});

test('wrapped action buttons use Up/Down according to their visible layout', async ({ page }) => {
  await openGallery(page);
  await page.addStyleTag({content:'.menu-actions { width: 400px; }'});
  await page.evaluate(() => { toggleMenu(); switchTab('settings'); });
  const apply = page.getByRole('button', {name:/Filter anwenden/});
  const save = page.getByRole('button', {name:/Speichern/});
  expect((await save.boundingBox()).y).toBeGreaterThan((await apply.boundingBox()).y);
  await apply.focus();
  await page.keyboard.press('ArrowDown');
  await expect(save).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(apply).toBeFocused();
});
