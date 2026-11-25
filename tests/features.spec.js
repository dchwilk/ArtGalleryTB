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

test('settings persist across reload and filters apply before the first collection is shown', async ({ page }) => {
  await openGallery(page);
  await page.keyboard.press('g');
  await page.keyboard.press('Enter');
  await page.keyboard.press('d');
  await page.evaluate(() => {
    document.getElementById('deptEuropean').checked = true;
    document.getElementById('sourcePaintings').checked = true;
    document.getElementById('onlyPublicDomain').checked = true;
    saveSettings();
  });
  await page.reload();
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await expect(page.locator('#timeLabel')).toHaveText('45');
  await expect(page.locator('#colorLabel')).toHaveText('Sand');
  await expect(page.locator('#styleLabel')).toHaveText('modern');
  await expect(page.locator('#deptEuropean')).toBeChecked();
  await expect(page.locator('#sourcePaintings')).toBeChecked();
  await expect(page.locator('#onlyPublicDomain')).toBeChecked();
  await expect(page.locator('#artworkCount')).toHaveText('1');
  await expect(page.locator('#infoBox')).toContainText('European work');
});

test('checkbox changes and the Save action persist actual control states', async ({ page }) => {
  await openGallery(page);
  await page.keyboard.press('m');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // Disable AIC via real remote-equivalent activation.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(SETTINGS_KEY)));
  expect(saved.checkboxes.sourceAIC).toBe(false);
  await page.evaluate(() => closeMenu());
  await page.reload();
  await expect(page.locator('#loadingText')).toHaveText('Keine Kunstwerke gefunden. Bitte Filter anpassen.');
  await expect(page.locator('#sourceAIC')).not.toBeChecked();
});

test('malformed, future and invalid stored settings keep safe defaults', async ({ page }) => {
  await openGallery(page);
  for (const saved of ['broken JSON', JSON.stringify({ version: 2, timer: 99 }), JSON.stringify({
    version: 1, timer: -100, matColor: 'invalid', frameStyle: 'invalid', checkboxes: { sourceAIC: 'false' }
  })]) {
    await page.evaluate(saved => localStorage.setItem(SETTINGS_KEY, saved), saved);
    await page.reload();
    await expect(page.locator('#loadingInfo')).toBeHidden();
    await expect(page.locator('#timeLabel')).toHaveText('30');
    await expect(page.locator('#colorLabel')).toHaveText('Eierschale');
    await expect(page.locator('#sourceAIC')).toBeChecked();
  }
});

test('blocked storage does not prevent startup or remote actions', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await openGallery(page);
  await page.keyboard.press('g');
  await expect(page.locator('#colorLabel')).toHaveText('Sand');
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await expect(page.locator('#menuOverlay')).toBeHidden();
});

test('department selections use OR within the group and AND with artwork types', async ({ page }) => {
  await openGallery(page);
  expect(await page.evaluate(() => {
    document.getElementById('sourcePaintings').checked = false;
    document.getElementById('deptEuropean').checked = true;
    document.getElementById('deptAsian').checked = true;
    filterArtworks();
    return artworks.map(work => work.id);
  })).toEqual([1, 3]);
  expect(await page.evaluate(() => {
    document.getElementById('sourcePaintings').checked = true;
    filterArtworks();
    return artworks.map(work => work.id);
  })).toEqual([1]);
  expect(await page.evaluate(() => [
    matchesDepartment({ department_title: 'American Paintings and Sculpture' }, 'european'),
    matchesDepartment({ department_title: 'Modern and Contemporary Art' }, 'modern'),
    matchesDepartment({ department_title: 'Modern and Contemporary Art' }, 'contemporary'),
    matchesDepartment({ department_title: 'Japanese Art' }, 'asian'),
    matchesDepartment({ department_title: 'Rijksmuseum' }, 'european')
  ])).toEqual([false, true, true, true, false]);
});

test('broken and missing images are skipped once; an entirely broken list stops', async ({ page }) => {
  await openGallery(page);
  let attempts = 0;
  await page.route('https://images.test/**', route => { attempts++; return route.abort(); });
  await setImages(page, ['https://images.test/bad1', '', 'https://images.test/bad2']);
  await expect(page.locator('#loadingText')).toContainText('Keine passenden Bilder konnten geladen werden');
  await expect(page.locator('.loading-spinner')).toBeHidden();
  expect(attempts).toBe(2);
  await page.clock.install();
  await page.clock.fastForward(120000);
  await page.keyboard.press('ArrowRight');
  expect(attempts).toBe(2);
  await page.keyboard.press('m');
  await expect(page.locator('#menuOverlay')).toBeVisible();
});

test('a broken image advances to a good one and keeps matching metadata', async ({ page }) => {
  await openGallery(page);
  let successfulRequests = 0;
  await page.route('https://www.artic.edu/iiif/good', route => {
    successfulRequests++;
    return route.fulfill({ contentType: 'image/svg+xml', headers: { 'Cache-Control': 'no-store' }, body: svg });
  });
  await page.route('https://images.test/bad', route => route.abort());
  await setImages(page, ['https://images.test/bad', 'https://www.artic.edu/iiif/good']);
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  await expect(page.locator('#art')).toHaveAttribute('src', 'https://www.artic.edu/iiif/good');
  expect(successfulRequests).toBe(1);
});

test('slow image timeout skips forward without waiting indefinitely', async ({ page }) => {
  await openGallery(page);
  let pending;
  await page.route('https://images.test/stalled', route => { pending = route; });
  await page.clock.install();
  await setImages(page, ['https://images.test/stalled', 'https://www.artic.edu/iiif/good']);
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.clock.fastForward(20001);
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  await expect(page.locator('#loadingInfo')).toBeHidden();
  await pending.abort().catch(() => {});
});

test('slideshow starts the full display time only when the image has loaded', async ({ page }) => {
  await openGallery(page);
  let pending;
  await page.route('https://images.test/first', route => { pending = route; });
  await page.clock.install();
  await page.evaluate(() => { timer = 5; });
  await setImages(page, ['https://images.test/first', 'https://www.artic.edu/iiif/next']);
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.clock.fastForward(6000);
  expect(await page.evaluate(() => currentIndex)).toBe(0);
  await pending.fulfill({ contentType: 'image/svg+xml', body: svg });
  await expect(page.locator('#infoBox')).toContainText('Image 0');
  await page.clock.fastForward(4999);
  await expect(page.locator('#infoBox')).toContainText('Image 0');
  await page.clock.fastForward(1);
  await expect(page.locator('#infoBox')).toContainText('Image 1');
});

test('rapid navigation ignores outdated image responses and keeps the old image while loading', async ({ page }) => {
  await openGallery(page);
  const previous = await page.locator('#art').getAttribute('src');
  let slow;
  await page.route('https://images.test/slow', route => { slow = route; });
  await setImages(page, ['https://images.test/slow', 'https://www.artic.edu/iiif/latest']);
  await expect.poll(() => Boolean(slow)).toBe(true);
  await expect(page.locator('#art')).toHaveAttribute('src', previous);
  await expect(page.locator('#loadingInfo')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#infoBox')).toContainText('Image 1');
  await slow.fulfill({ contentType: 'image/svg+xml', body: svg }).catch(() => {});
  await expect(page.locator('#art')).toHaveAttribute('src', 'https://www.artic.edu/iiif/latest');
  await expect(page.locator('#infoBox')).toContainText('Image 1');
});

test('an older museum request cannot replace a newer filtered collection', async ({ page }) => {
  await openGallery(page);
  await page.evaluate(() => {
    window.savedLoader = loadAICData;
    loadAICData = () => new Promise(resolve => { window.finishOldCollection = resolve; });
    window.oldLoad = loadAllArtworks();
  });
  await page.evaluate(async () => {
    loadAICData = async () => [{ id: 99, title: 'Newest collection', imageUrl: 'https://www.artic.edu/iiif/newest', classification_title: 'Painting', is_public_domain: true }];
    await loadAllArtworks();
    window.finishOldCollection([{ id: 98, title: 'Old collection' }]);
    await window.oldLoad;
  });
  await expect(page.locator('#infoBox')).toContainText('Newest collection');
  await expect(page.locator('#artworkCount')).toHaveText('1');
  expect(await page.evaluate(() => artworks[0].id)).toBe(99);
});

test('spinner and status stay centered during museum and image loading', async ({ page }, testInfo) => {
  let pending;
  await page.route('https://api.artic.edu/**', route => { pending = route; });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('.loading-spinner')).toBeVisible();
  const box = await page.locator('#loadingInfo').boundingBox();
  const viewport = page.viewportSize();
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(1);
  const spinner = await page.locator('.loading-spinner').boundingBox();
  expect(Math.abs(spinner.x + spinner.width / 2 - viewport.width / 2)).toBeLessThan(1);
  expect(await page.locator('.loading-spinner').evaluate(el => getComputedStyle(el).animationName)).toBe('loading-spin');
  if (testInfo.project.name === 'tv-1080p') await page.screenshot({ path: '../outputs/ArtGalleryTB-Ladeanimation.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.loading-spinner').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await pending.abort().catch(() => {});
});
