const { test, expect } = require('@playwright/test');
const createServer = require('./server.cjs');
let server;
const pageErrors = new WeakMap();

test.beforeAll(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

// Dispatch the legacy numeric codes sent by Tizen, without a modern `key` value.
async function remote(page, code, type = 'keydown') {
  await page.evaluate(({ code, type }) => {
    document.activeElement.dispatchEvent(new KeyboardEvent(type, {
      keyCode: code, which: code, bubbles: true, cancelable: true
    }));
  }, { code, type });
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://api.artic.edu/**', route => route.fulfill({ json: { data: [
    { id: 1, title: 'Artwork 1', artist_display: 'Test Artist', image_id: 'test', classification_title: 'Painting', is_public_domain: true }
  ] } }));
  await page.route('https://www.artic.edu/iiif/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="tan"/></svg>'
  }));
  await page.route('https://api.smk.dk/**', route => route.fulfill({ json: { items: [] } }));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  // Keep navigation tests independent of museum availability and random order.
  await page.evaluate(() => {
    clearInterval(interval);
    artworks = [1, 2, 3].map(id => ({ id, title: 'Artwork ' + id, source: 'aic', image_id: 'test' }));
    randomizedOrder = [0, 1, 2];
    currentIndex = 0;
    img.onerror = null;
    showArtwork();
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('apply filters reloads via the existing museum loader', async ({ page }, testInfo) => {
  await remote(page, 10009);
  const step = testInfo.project.name === 'tv-720p' ? 39 : 40;
  for (let i = 0; i < 5; i++) await remote(page, step);
  await remote(page, 13);
  await remote(page, 40);
  await remote(page, 13);
  await expect(page.locator('#menuOverlay')).toBeHidden();
  await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#artworkCount')).toHaveText('1');
});

test('long Up tolerates unsupported fullscreen and focus loss', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
    infoHoldStart = Date.now() - 4000;
  });
  await remote(page, 38, 'keyup');
  await expect(page.locator('#infoBox')).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('Unsupported'));
    infoHoldStart = Date.now() - 4000;
  });
  await remote(page, 38, 'keyup');
  await remote(page, 38);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await remote(page, 38, 'keyup');
  await expect(page.locator('#infoBox')).toBeHidden();
  await remote(page, 39);
  await expect(page.locator('#infoBox')).toContainText('Artwork 2');
});

test('arrows return from content to the selected tab in either layout', async ({ page }, testInfo) => {
  await remote(page, 10009);
  await remote(page, testInfo.project.name === 'tv-720p' ? 40 : 39);
  await expect(page.locator('#sourceAIC')).toBeFocused();
  await remote(page, testInfo.project.name === 'tv-720p' ? 38 : 37);
  await expect(page.locator('[data-tab="sources"]')).toBeFocused();
});

test('bootstrap loads artwork and installs one input handler', async ({ page }) => {
  await expect(page.locator('#art')).toHaveJSProperty('naturalWidth', 100);
  await page.evaluate(() => { initNavigation(); initNavigation(); });
  await remote(page, 39);
  await expect(page.locator('#infoBox')).toContainText('Artwork 2');
});

test('every tab and the save buttons are reachable using only the D-pad', async ({ page }, testInfo) => {
  await remote(page, 10009);
  const step = testInfo.project.name === 'tv-720p' ? 39 : 40;
  for (const tab of ['types', 'periods', 'departments', 'properties', 'settings']) {
    await remote(page, step);
    await expect(page.locator('[data-tab="' + tab + '"]')).toBeFocused();
    await expect(page.locator('#' + tab)).toBeVisible();
  }
  await remote(page, 13);
  await expect(page.locator('#brightnessEnabled')).toBeFocused();
  await remote(page, 40);
  await expect(page.getByRole('button', { name: /Filter anwenden/ })).toBeFocused();
  await remote(page, 39);
  await expect(page.getByRole('button', { name: /Speichern/ })).toBeFocused();
  await remote(page, 13);
  await expect(page.locator('#menuOverlay')).toBeHidden();
  await remote(page, 39);
  await expect(page.locator('#infoBox')).toContainText('Artwork 2');
});

test('menu arrows and OK never alter slideshow settings', async ({ page }) => {
  await remote(page, 10009);
  await remote(page, 13);
  await remote(page, 40);
  await remote(page, 13);
  await expect(page.locator('#sourceMET')).toBeChecked();
  await remote(page, 38);
  await remote(page, 38, 'keyup');
  await expect(page.locator('#infoBox')).toBeHidden();
  await expect(page.locator('#styleLabel')).toHaveText('klassisch');
  await expect(page.locator('#infoBox')).toContainText('Artwork 1');
});

test('keyboard defaults cannot double activate controls or hidden buttons', async ({ page }) => {
  await page.keyboard.press('m');
  await page.keyboard.press('Enter');
  let changes = 0;
  await page.exposeFunction('recordChange', () => changes++);
  await page.locator('#sourceAIC').evaluate(element => element.addEventListener('change', () => window.recordChange()));
  await page.keyboard.press('Enter');
  await expect(page.locator('#sourceAIC')).not.toBeChecked();
  await expect.poll(() => changes).toBe(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(page.locator('#styleLabel')).toHaveText('modern');
  await expect(page.locator('#menuOverlay')).toBeHidden();
});

test('an interrupted Up hold cannot toggle info after closing the menu', async ({ page }) => {
  await remote(page, 38);
  await remote(page, 10009);
  await remote(page, 10009);
  await remote(page, 38, 'keyup');
  await expect(page.locator('#infoBox')).toBeHidden();
});

test('empty artwork lists remain navigable without corrupting the index', async ({ page }) => {
  await page.evaluate(() => { artworks = []; randomizedOrder = []; currentIndex = 0; });
  await remote(page, 37);
  await remote(page, 39);
  expect(await page.evaluate(() => currentIndex)).toBe(0);
  await remote(page, 10009);
  await expect(page.locator('#menuOverlay')).toBeVisible();
});

test('OK enters the selected tab and toggles a checkbox once', async ({ page }) => {
  await remote(page, 10009);
  await expect(page.locator('[data-tab="sources"]')).toBeFocused();
  await remote(page, 13);
  await expect(page.locator('#sourceAIC')).toBeFocused();
  await remote(page, 13);
  await expect(page.locator('#sourceAIC')).not.toBeChecked();
});

test('OK toggles checkboxes even when programmatic click cannot activate them', async ({ page }) => {
  await page.evaluate(() => { document.querySelectorAll('input[type=checkbox]').forEach(input => { input.click = () => {}; }); });
  await remote(page, 10009);
  await remote(page, 13);
  await remote(page, 13);
  await expect(page.locator('#sourceAIC')).not.toBeChecked();
  await remote(page, 13, 'keyup');
  await expect(page.locator('#sourceAIC')).not.toBeChecked();
  await remote(page, 13);
  await expect(page.locator('#sourceAIC')).toBeChecked();
});

test('side-by-side actions use Left/Right and Up returns to the preceding row', async ({ page }) => {
  await page.evaluate(() => { toggleMenu(); switchTab('settings'); });
  const apply = page.getByRole('button', { name: /Filter anwenden/ });
  const save = page.getByRole('button', { name: /Speichern/ });
  await apply.focus();
  await remote(page, 39);
  await expect(save).toBeFocused();
  await remote(page, 37);
  await expect(apply).toBeFocused();
  await remote(page, 39);
  await remote(page, 38);
  await expect(page.locator('#brightnessEnabled')).toBeFocused();
});

test('red opens and closes the menu', async ({ page }) => {
  await remote(page, 403);
  await expect(page.locator('#menuOverlay')).toBeVisible();
  await remote(page, 403);
  await expect(page.locator('#menuOverlay')).toBeHidden();
});

test('reopening the menu keeps a single tab matching its visible section', async ({ page }, testInfo) => {
  await remote(page, 10009);
  await remote(page, testInfo.project.name === 'tv-720p' ? 39 : 40);
  await remote(page, 13);
  await remote(page, 10009);
  await remote(page, 10009);
  await expect(page.locator('.menu-tab.active')).toHaveCount(1);
  const tab = await page.locator('.menu-tab.active').getAttribute('data-tab');
  await expect(page.locator('#' + tab)).toHaveClass(/active/);
  await expect(page.locator('[data-tab="' + tab + '"]')).toBeFocused();
});

test('slideshow controls still work with numeric TV key codes', async ({ page }) => {
  await remote(page, 39);
  await expect(page.locator('#infoBox')).toContainText('Artwork 2');
  await remote(page, 37);
  await expect(page.locator('#infoBox')).toContainText('Artwork 1');
  await remote(page, 38);
  await remote(page, 38, 'keyup');
  await expect(page.locator('#infoBox')).toBeVisible();
  await remote(page, 40);
  await expect(page.locator('#infoBox')).toBeHidden();
  await remote(page, 415); // Dedicated Play, distinct from Play/Pause (10252).
  await expect(page.locator('#colorLabel')).toHaveText('Sand');
  await remote(page, 13);
  await expect(page.locator('#styleLabel')).toHaveText('modern');
  await remote(page, 427);
  await expect(page.locator('#timeLabel')).toHaveText('45');
  await remote(page, 428);
  await expect(page.locator('#timeLabel')).toHaveText('30');
});
