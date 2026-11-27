const { test, expect } = require('@playwright/test');
const createServer = require('./server.cjs');
const pkg = require('../package.json');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let server;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="tan"/></svg>';
test.beforeAll(async () => { server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); });
test.afterAll(async () => { server.closeAllConnections(); await new Promise(r=>server.close(r)); });
test.beforeEach(async ({page}) => {
  await page.route('https://**/*',r=>r.abort());
  await page.route('https://api.artic.edu/**',r=>r.fulfill({json:{data:[{id:1,image_id:'test',title:'Original work',classification_title:'Painting',date_start:1880,is_public_domain:true}]}}));
  await page.route('https://api.smk.dk/**',r=>r.fulfill({json:{items:[]}}));
  await page.route('https://www.artic.edu/iiif/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  await page.evaluate(()=>clearTimeout(interval));
});

async function remoteOK(page) {
  await page.evaluate(()=>{
    const control=document.activeElement;
    for (const type of ['keydown','keypress','keyup']) control.dispatchEvent(new KeyboardEvent(type,{keyCode:13,which:13,bubbles:true,cancelable:true}));
    // Model the additional activation click delivered by some TV engines.
    control.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
  });
}

test('all museum and period choices toggle once without native input focus or activation',async({page})=>{
  await page.evaluate(()=>{
    document.querySelectorAll('input[type=checkbox]').forEach(input=>{
      input.focus=()=>{throw new Error('Native checkbox focused')};
      input.click=()=>{throw new Error('Native checkbox clicked')};
    });
    window.changeCounts={};
    menu.addEventListener('change',event=>{changeCounts[event.target.id]=(changeCounts[event.target.id]||0)+1});
    toggleMenu();
  });
  for (const tab of ['sources','periods']) {
    await page.evaluate(tab=>{switchTab(tab);focusCurrentMenuItem()},tab);
    const controls=page.locator('#'+tab+' .checkbox-control');
    const count=await controls.count();
    for (let i=0;i<count;i++) {
      const control=controls.nth(i);
      const id=await control.getAttribute('data-checkbox-id');
      const before=await page.locator('#'+id).evaluate(input=>input.checked);
      await expect(control).toBeFocused();
      await remoteOK(page);
      await expect(control).toHaveAttribute('aria-checked',String(!before));
      expect(await page.locator('#'+id).evaluate(input=>input.checked)).toBe(!before);
      expect(await page.evaluate(id=>changeCounts[id],id)).toBe(1);
      if(i<count-1) await page.keyboard.press('ArrowDown');
    }
  }
});

test('two successive OK presses work, while duplicate clicks are suppressed and pointer clicks still work',async({page})=>{
  await page.evaluate(()=>{toggleMenu();focusCurrentMenuItem()});
  const control=page.locator('[data-checkbox-id="sourceAIC"]');
  await remoteOK(page); await expect(control).toHaveAttribute('aria-checked','false');
  await remoteOK(page); await expect(control).toHaveAttribute('aria-checked','true');
  await control.click(); await expect(control).toHaveAttribute('aria-checked','false');
});

test('apply from any tab actually loads newly selected museums and periods once',async({page})=>{
  await page.route('https://expo.bsz-bw.de/skk/sammlung/**',r=>r.fulfill({json:{head:{numFound:1},records:[{imdasid:'A11',titel:'New baroque work',anfang:'1650',objektbezeichnung:'Gemälde',bilder:[{typ:'LZA',uuid:'abc-11',rechte:'Public Domain',width:'6000',height:'4000'}]}]}}));
  await page.route('https://expodelivery.bsz-bw.de/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
  const generation=await page.evaluate(()=>{toggleMenu();switchTab('sources');return collectionRequestId});
  for(const id of ['sourceAIC','sourceSMK','sourceKarlsruhe']) {
    await page.locator('[data-checkbox-id="'+id+'"]').focus(); await remoteOK(page);
  }
  await page.evaluate(()=>switchTab('periods'));
  await page.locator('[data-checkbox-id="periodBaroque"]').focus();await remoteOK(page);
  await page.locator('#applySettingsButton').focus();await remoteOK(page);
  await expect(page.locator('#menuOverlay')).toBeHidden();
  await expect(page.locator('#infoBox')).toContainText('New baroque work');
  expect(await page.evaluate(()=>collectionRequestId)).toBe(generation+1);
  expect(await page.evaluate(()=>getSelectedSources())).toEqual(['karlsruhe']);
  await page.reload();
  await expect(page.locator('#infoBox')).toContainText('New baroque work');
  await page.evaluate(()=>{toggleMenu();switchTab('periods')});
  await expect(page.locator('[data-checkbox-id="periodBaroque"]')).toHaveAttribute('aria-checked','true');
});

test('Back applies filter edits; frame and speed edits keep the current collection',async({page})=>{
  const generation=await page.evaluate(()=>{toggleMenu();switchTab('periods');return collectionRequestId});
  await page.locator('[data-checkbox-id="periodModern"]').focus();await remoteOK(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#menuOverlay')).toBeHidden();
  await expect(page.locator('#frame')).toBeVisible();
  expect(await page.evaluate(()=>collectionRequestId)).toBe(generation+1);
  await page.evaluate(()=>{toggleMenu();switchTab('settings')});
  await page.locator('#frameStyleButton').focus();await page.keyboard.press('Enter');
  await page.locator('#fasterButton').focus();await page.keyboard.press('Enter');
  await page.locator('#applySettingsButton').focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>collectionRequestId)).toBe(generation+1);
});

test('borderless fill covers the viewport and persists, while the original white border remains available',async({page})=>{
  await page.evaluate(()=>{styleIndex=styles.indexOf('cropMax');updatePassepartoutStyle()});
  await expect(page.locator('.inner-frame')).toHaveCSS('border-top-width','6px');
  await page.evaluate(()=>{styleIndex=styles.indexOf('cropMaxBorderless');updatePassepartoutStyle();saveSettings()});
  await expect(page.locator('.inner-frame')).toHaveCSS('border-top-width','0px');
  await expect(page.locator('.inner-frame')).toHaveCSS('box-shadow','none');
  await expect(page.locator('#art')).toHaveCSS('object-fit','cover');
  const box=await page.locator('.inner-frame').boundingBox();
  expect(box).toEqual({x:0,y:0,width:page.viewportSize().width,height:page.viewportSize().height});
  await page.reload();await expect(page.locator('#frame')).toBeVisible();
  await expect(page.locator('#styleLabel')).toHaveText('Bildfüllend ohne weißen Rahmen');
  await expect(page.locator('.inner-frame')).toHaveCSS('border-top-width','0px');
});

test('version display, module entry point and all asset URLs agree',async({page})=>{
  await expect(page.locator('#appVersion')).toHaveText('ArtGalleryTB '+pkg.version);
  const cacheVersion=pkg.version.replace(/\./g,'-');
  expect(pkg.appPath).toBe('app/index.html?v='+cacheVersion);
  const urls=await page.locator('script[src],link[rel=stylesheet]').evaluateAll(elements=>elements.map(e=>e.getAttribute('src')||e.getAttribute('href')));
  expect(urls.every(url=>url.endsWith('?v='+cacheVersion))).toBe(true);
  // TizenBrew extracts the suffix before stripping query arguments. A dotted
  // version in the URL would make its proxy serve these files as type "1".
  expect([pkg.appPath,...urls].every(url=>['html','js','css'].includes(url.split('.').pop().split('?')[0]))).toBe(true);
});

test('app boots and OK selects a museum through the TizenBrew module URL and MIME handling',async({page})=>{
  const prefix='/module/'+encodeURIComponent('gh/dchwilk/ArtGalleryTB@v'+pkg.version)+'/';
  const root=path.resolve(__dirname,'..');
  const proxy=http.createServer((req,res)=>{
    const relative=req.url.slice(prefix.length);
    const file=path.resolve(root,new URL(relative,'http://local/').pathname.slice(1));
    if(!req.url.startsWith(prefix)||!file.startsWith(root+path.sep)){res.writeHead(404).end();return}
    const extension=path.basename(relative).split('.').pop().split('?')[0];
    const mime={html:'text/html',js:'application/javascript',css:'text/css'}[extension]||'application/octet-stream';
    fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',mime);res.end(body)});
  });
  await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:'+proxy.address().port+prefix+pkg.appPath);
    await expect(page.locator('#frame')).toBeVisible();
    await page.keyboard.press('m');await page.keyboard.press('Enter');await remoteOK(page);
    await expect(page.locator('[data-checkbox-id="sourceAIC"]')).toHaveAttribute('aria-checked','false');
    await expect(page.locator('#appVersion')).toHaveText('ArtGalleryTB '+pkg.version);
    expect(errors).toEqual([]);
  } finally {proxy.closeAllConnections();await new Promise(r=>proxy.close(r))}
});

test('Save and Back are reachable in the sidebar with the remote',async({page},testInfo)=>{
  await page.keyboard.press('m');
  if(testInfo.project.name==='tv-720p') {
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#applySettingsButton')).toBeFocused();
    await page.keyboard.press('ArrowRight');
  }else{
    for(let i=0;i<6;i++)await page.keyboard.press('ArrowDown');
    await expect(page.locator('#applySettingsButton')).toBeFocused();
    await page.keyboard.press('ArrowDown');
  }
  await expect(page.locator('#closeSettingsButton')).toBeFocused();
  expect(await page.locator('#applySettingsButton').evaluate(e=>Boolean(e.closest('.menu-sidebar')))).toBe(true);
  await remoteOK(page);
  await expect(page.locator('#menuOverlay')).toBeHidden();
});

test('Back button applies pending changes and closes the whole settings menu',async({page})=>{
  const generation=await page.evaluate(()=>{toggleMenu();switchTab('periods');return collectionRequestId});
  await page.locator('[data-checkbox-id="periodModern"]').focus();await remoteOK(page);
  await page.locator('#closeSettingsButton').focus();await remoteOK(page);
  await expect(page.locator('#menuOverlay')).toBeHidden();
  expect(await page.evaluate(()=>collectionRequestId)).toBe(generation+1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(SETTINGS_KEY)).checkboxes.periodModern)).toBe(true);
});

test('Samsung Back key closes settings from any tab without leaving the gallery',async({page})=>{
  const url=page.url();
  for(const tab of ['sources','periods','settings']){
    await page.evaluate(tab=>{toggleMenu();switchTab(tab);focusCurrentMenuItem()},tab);
    await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{keyCode:10009,which:10009,bubbles:true,cancelable:true})));
    await expect(page.locator('#menuOverlay')).toBeHidden();
    expect(page.url()).toBe(url);
  }
});
