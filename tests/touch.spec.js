const { test, expect } = require('@playwright/test');
const createServer = require('./server.cjs');
test.use({ hasTouch: true, isMobile: true });
let server;
const errors = new WeakMap();
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="tan"/></svg>';
test.beforeAll(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
test.beforeEach(async({page})=>{
  errors.set(page,[]);page.on('pageerror',error=>errors.get(page).push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.route('https://**/*',r=>r.abort());
  await page.route('https://api.artic.edu/**',r=>r.fulfill({json:{data:[{id:1,title:'Initial',image_id:'test',classification_title:'Painting',is_public_domain:true}]}}));
  await page.route('https://api.smk.dk/**',r=>r.fulfill({json:{items:[]}}));
  await page.route('https://www.artic.edu/iiif/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>collectionLoading)).toBe(false);
  await page.evaluate(()=>{
    clearTimeout(interval);resetImageLoading();
    artworks=Array.from({length:3},(_,id)=>({id,title:'Touch image '+id,source:'aic',image_id:'test'+id}));
    randomizedOrder=[0,1,2];currentIndex=0;showArtwork();
  });
  await expect(page.locator('#infoBox')).toContainText('Touch image 0');
  await page.evaluate(()=>clearTimeout(interval));
});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

async function swipe(page,from,to) {
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
    for(let n=1;n<=4;n++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*n/4,y:from.y+(to.y-from.y)*n/4,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await session.detach()}
}

test('invisible side zones change images; the centre opens the menu without selecting an item',async({page})=>{
  await expect(page.locator('button:visible')).toHaveCount(0);
  await page.touchscreen.tap(365,300);
  await expect(page.locator('#infoBox')).toContainText('Touch image 1');
  await page.touchscreen.tap(25,300);
  await expect(page.locator('#infoBox')).toContainText('Touch image 0');
  const before=await page.evaluate(()=>Array.from(settingsCheckboxes(),i=>i.checked));
  await page.touchscreen.tap(195,300);
  await expect(page.locator('#menuOverlay')).toBeVisible();
  expect(await page.evaluate(()=>Array.from(settingsCheckboxes(),i=>i.checked))).toEqual(before);
});

test('bottom taps toggle information across the full width without changing the image',async({page})=>{
  for(const x of [25,195,365]) {
    await page.touchscreen.tap(x,805);await expect(page.locator('#infoBox')).toBeVisible();
    await page.touchscreen.tap(x,805);await expect(page.locator('#infoBox')).toBeHidden();
  }
  expect(await page.evaluate(()=>currentIndex)).toBe(0);
});

test('swipes change images, show information and open the menu once',async({page})=>{
  await swipe(page,{x:300,y:350},{x:80,y:350});
  await expect(page.locator('#infoBox')).toContainText('Touch image 1');
  await swipe(page,{x:80,y:350},{x:300,y:350});
  await expect(page.locator('#infoBox')).toContainText('Touch image 0');
  await swipe(page,{x:195,y:350},{x:195,y:200});
  await expect(page.locator('#infoBox')).toBeVisible();
  await swipe(page,{x:195,y:350},{x:195,y:200});
  await expect(page.locator('#infoBox')).toBeHidden();
  await swipe(page,{x:195,y:200},{x:195,y:350});
  await expect(page.locator('#menuOverlay')).toBeVisible();
  expect(await page.evaluate(()=>currentIndex)).toBe(0);
});

test('visible menu controls remain tappable and menu swipes scroll instead of changing artwork',async({page})=>{
  await page.touchscreen.tap(195,300);
  const control=page.locator('[data-checkbox-id="sourceMET"]');
  await control.tap();await expect(control).toHaveAttribute('aria-checked','true');
  await page.locator('[data-tab="settings"]').tap();
  const index=await page.evaluate(()=>currentIndex);
  await swipe(page,{x:195,y:570},{x:195,y:230});
  await expect.poll(()=>page.locator('.menu-content').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  // A mobile browser consumes a tap to stop momentum scrolling. Wait for the
  // native scroll to settle before testing the button's separate activation.
  await page.locator('.menu-content').evaluate(element=>new Promise(resolve=>{
    let previous=element.scrollTop,stable=0,frames=0;
    function tick(){const current=element.scrollTop;stable=Math.abs(current-previous)<0.5?stable+1:0;previous=current;
      if(stable>=6||++frames>=180)resolve();else requestAnimationFrame(tick)}
    requestAnimationFrame(tick);
  }));
  await expect(page.locator('#menuOverlay')).toBeVisible();
  expect(await page.evaluate(()=>currentIndex)).toBe(index);
  await page.locator('#applySettingsButton').tap();
  await expect(page.locator('#menuOverlay')).toBeHidden();
});

test('portrait and landscape preserve the image, settings and generation',async({page})=>{
  const before=await page.evaluate(()=>({src:img.src,index:currentIndex,request:collectionRequestId,saved:localStorage.getItem(SETTINGS_KEY)}));
  for(const size of [{width:844,height:390},{width:390,height:844}]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>({src:img.src,index:currentIndex,request:collectionRequestId,saved:localStorage.getItem(SETTINGS_KEY)}))).toEqual(before);
    const box=await page.locator('#frame').boundingBox();
    expect(box.width).toBe(size.width);expect(box.height).toBe(size.height);
    await page.touchscreen.tap(size.width/2,size.height-25);await expect(page.locator('#infoBox')).toBeVisible();
    await page.touchscreen.tap(size.width/2,size.height-25);await expect(page.locator('#infoBox')).toBeHidden();
  }
});

test('rotation keeps an open menu and pending selections with the apply button visible',async({page})=>{
  await page.touchscreen.tap(195,300);
  await page.locator('[data-tab="periods"]').tap();
  await page.locator('[data-checkbox-id="periodModern"]').tap();
  for(const size of [{width:844,height:390},{width:390,height:844}]) {
    await page.setViewportSize(size);
    await expect(page.locator('#menuOverlay')).toBeVisible();
    await expect(page.locator('[data-tab="periods"]')).toHaveClass(/active/);
    await expect(page.locator('[data-checkbox-id="periodModern"]')).toHaveAttribute('aria-checked','true');
    const box=await page.locator('#applySettingsButton').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(size.width);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  }
});

test('rotation in the middle of a gesture cancels it',async({page})=>{
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:350,id:1}]});
    await page.setViewportSize({width:844,height:390});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await page.evaluate(()=>currentIndex)).toBe(0);
    await expect(page.locator('#menuOverlay')).toBeHidden();
  }finally{await session.detach()}
});

test('two-finger gestures do not trigger navigation',async({page})=>{
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:300,id:1},{x:250,y:300,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await page.evaluate(()=>currentIndex)).toBe(0);
    await expect(page.locator('#menuOverlay')).toBeHidden();
    await expect(page.locator('#infoBox')).toBeHidden();
  }finally{await session.detach()}
});

test('Nest Hub sized touch viewport supports the same invisible zones and info button',async({page})=>{
  await page.setViewportSize({width:1024,height:600});
  await page.touchscreen.tap(980,220);await expect(page.locator('#infoBox')).toContainText('Touch image 1');
  await page.touchscreen.tap(512,570);await expect(page.locator('#infoBox')).toBeVisible();
  await page.touchscreen.tap(512,220);await expect(page.locator('#menuOverlay')).toBeVisible();
  await page.locator('[data-tab="settings"]').tap();
  await page.locator('#infoButton').tap();await expect(page.locator('#infoBox')).toBeHidden();
  await expect(page.locator('#menuOverlay')).toBeVisible();
});

test('Touch Events fallback works without Pointer Events',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'PointerEvent',{value:undefined,configurable:true}));
  await page.reload();await expect(page.locator('#frame')).toBeVisible();
  await page.touchscreen.tap(195,805);await expect(page.locator('#infoBox')).toBeVisible();
  await page.touchscreen.tap(195,805);await expect(page.locator('#infoBox')).toBeHidden();
  await swipe(page,{x:195,y:350},{x:195,y:200});await expect(page.locator('#infoBox')).toBeVisible();
});

test('touch can open the menu even when no artwork is available',async({page})=>{
  await page.evaluate(()=>{document.getElementById('sourceAIC').checked=false;document.getElementById('sourceSMK').checked=false;return loadAllArtworks()});
  await expect(page.locator('#frame')).toBeHidden();
  await page.touchscreen.tap(195,300);
  await expect(page.locator('#menuOverlay')).toBeVisible();
});

test('holding a finger does not trigger a tap action',async({page})=>{
  await page.clock.install();
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:360,y:350,id:1}]});
    await page.clock.fastForward(600);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await page.evaluate(()=>currentIndex)).toBe(0);
    await expect(page.locator('#menuOverlay')).toBeHidden();
  }finally{await session.detach()}
});

test('touch Back button closes settings in portrait and landscape',async({page})=>{
  for(const size of [{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);
    await page.touchscreen.tap(size.width/2,size.height/2);
    await expect(page.locator('#menuOverlay')).toBeVisible();
    await page.locator('[data-tab="settings"]').tap();
    await page.locator('#closeSettingsButton').tap();
    await expect(page.locator('#menuOverlay')).toBeHidden();
  }
});

test('long artwork information stays readable and scrollable across phone orientations',async({page})=>{
  const title='A long artwork title with several details about the landscape and the people in the painting';
  await page.evaluate(title=>{
    clearTimeout(interval);
    renderArtworkInfo({id:'very-long-identifier-'.repeat(18),source:'karlsruhe',title,date_display:'um 1880',
      artist_display:'An artist with a long name and additional attribution',place_of_origin:'A place with a long description',
      medium_display:'Oil on canvas; '.repeat(12),dimensions:'120 × 180 cm',credit_line:'Collection and photographer credit. '.repeat(20),is_public_domain:true});
  },title);
  await page.touchscreen.tap(195,810);
  for(const size of [{width:390,height:844},{width:844,height:390},{width:932,height:430},{width:430,height:932},{width:390,height:844}]){
    await page.setViewportSize(size);
    await expect(page.locator('#infoBox')).toBeVisible();
    await expect(page.locator('#infoBox strong')).toHaveText(title);
    const box=await page.locator('#infoBox').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.width).toBe(size.width);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
    const metrics=await page.locator('#infoBox').evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),source:parseFloat(getComputedStyle(e.querySelector('small')).fontSize),width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}));
    expect(metrics.font).toBeGreaterThanOrEqual(16);expect(metrics.source).toBeGreaterThanOrEqual(14);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
    await page.locator('#infoBox').evaluate(e=>{e.scrollTop=0});
    await swipe(page,{x:size.width/2,y:size.height-45},{x:size.width/2,y:size.height-Math.min(180,box.height-30)});
    await expect.poll(()=>page.locator('#infoBox').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#infoBox')).toBeVisible();
    expect(await page.evaluate(()=>currentIndex)).toBe(0);
  }
});
