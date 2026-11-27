const {test, expect} = require('@playwright/test');
const createServer = require('./server.cjs');
const fs = require('node:fs');
const path = require('node:path');
let server;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="tan"/></svg>';
test.beforeAll(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
test.beforeEach(async({page})=>{
  await page.route('https://**/*',r=>r.abort());
  await page.route('https://api.artic.edu/**',r=>r.fulfill({json:{data:[{id:1,title:'Default',image_id:'test',classification_title:'Painting',is_public_domain:true}]}}));
  await page.route('https://www.artic.edu/iiif/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.route('https://api.smk.dk/**',r=>r.fulfill({json:{items:[]}}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.locator('#frame')).toBeVisible();
  await page.evaluate(()=>clearTimeout(interval));
});

test('NGA catalogue has independent unrestricted primary images and every shard is valid',async({page})=>{
  const root=path.join(__dirname,'../app/data/nga');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  let count=0;const ids=new Set();
  for(const shard of manifest.shards){
    const rows=JSON.parse(fs.readFileSync(path.join(root,shard.file),'utf8'));
    expect(rows.length).toBe(shard.count);
    expect(rows.every(row=>row.length===manifest.columns.length && /^https:\/\/api\.nga\.gov\/iiif\/[\w-]+$/.test(row[manifest.columns.indexOf('imageService')]))).toBe(true);
    for(const row of rows)ids.add(row[manifest.columns.indexOf('id')]);
    count+=rows.length;
  }
  expect(count).toBe(manifest.total);expect(ids.size).toBe(count);expect(count).toBeGreaterThan(60000);
  const result=await page.evaluate(async()=>{
    const filters=getSelectedFilters();const batches=[];
    const works=await loadNGAData(batch=>batches.push(batch.length),{filters});
    return {count:works.length,batches,valid:works.every(work=>work.source==='nga'&&work.is_public_domain&&work.categories.types.includes('painting'))};
  });
  expect(result.count).toBeGreaterThan(100);expect(result.valid).toBe(true);
  expect(result.batches.length).toBe(2);
  const european=await page.evaluate(async()=>{
    const filters={...getSelectedFilters(),departments:['european']};
    const works=await loadNGAData(()=>{},{filters});
    return works.length;
  });
  expect(european).toBeGreaterThan(50);
});

test('new NGA source works with remote activation, saved selection and progressive image display',async({page})=>{
  await page.route('https://api.nga.gov/iiif/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.evaluate(()=>{toggleMenu();switchTab('sources');document.querySelector('[data-checkbox-id="sourceNGA"]').focus();});
  await page.keyboard.press('Enter');
  await expect(page.locator('#sourceNGA')).toBeChecked();
  await page.evaluate(()=>{
    document.getElementById('sourceAIC').checked=false;document.getElementById('sourceSMK').checked=false;closeMenu();
  });
  await expect(page.locator('#infoBox')).toContainText('National Gallery of Art');
  await expect(page.locator('#loadingInfo')).toBeHidden();
  expect(await page.evaluate(()=>artworks.every(work=>work.source==='nga'))).toBe(true);
  await page.reload();await expect(page.locator('#sourceNGA')).toBeChecked();
  await expect(page.locator('#frame')).toBeVisible();
});

test('Rijks follows opaque next links, streams early and validates image-level rights',async({page})=>{
  const calls=[];
  await page.route('https://data.rijksmuseum.nl/**',r=>{
    calls.push(r.request().url());const second=r.request().url().includes('pageToken');
    return r.fulfill({json:{orderedItems:[{id:'https://id.rijksmuseum.nl/'+(second?'22':'11')}],
      next:second?undefined:{id:'https://data.rijksmuseum.nl/search/collection?pageToken=opaque'}}});
  });
  await page.route('https://id.rijksmuseum.nl/**',r=>r.fulfill({json:{
    id:r.request().url().split('?')[0],identified_by:[{type:'Name',content:'Misty sea'}],
    classified_as:[{notation:[{'@language':'en','@value':'painting'}]}],
    produced_by:{part:[{carried_out_by:[{notation:[{'@language':'en','@value':'Jan Toorop'}]}]}],timespan:{begin_of_the_begin:'1899-01-01'}},
    subject_of:[{digitally_carried_by:[{access_point:[{id:'https://iiif.micr.io/test/full/max/0/default.jpg'}],referred_to_by:[{content:'https://creativecommons.org/publicdomain/mark/1.0/'}]}]}]
  }}));
  const result=await page.evaluate(async()=>{
    const batches=[];const works=await loadRijksData(batch=>batches.push(batch.length),{filters:getSelectedFilters()});
    const restricted=rijksArtwork({subject_to:[{id:'https://creativecommons.org/publicdomain/zero/1.0/'}],subject_of:[{digitally_carried_by:[{access_point:[{id:'https://iiif.micr.io/test/full/max/0/default.jpg'}]}]}]});
    return {works,batches,restricted};
  });
  expect(calls).toHaveLength(2);expect(calls[1]).toContain('pageToken=opaque');
  expect(result.batches).toEqual([1,1]);expect(result.restricted).toBeNull();
  expect(result.works[0]).toMatchObject({artist_display:'Jan Toorop',date_start:1899,is_public_domain:true,categories:{types:['painting']}});
  expect(result.works[0].imageUrl).toBe('https://iiif.micr.io/test/full/!1920,1080/0/default.jpg');
});

test('Cleveland samples beyond its former first 200 entries and requests the selected kind',async({page})=>{
  const offsets=[];
  await page.route('https://openaccess-api.clevelandart.org/**',r=>{
    const u=new URL(r.request().url());expect(u.searchParams.get('type')).toBe('Painting');expect(u.searchParams.has('cc0')).toBe(true);
    const offset=Number(u.searchParams.get('skip'));offsets.push(offset);
    return r.fulfill({json:{info:{total:4000},data:[{id:offset,title:'Painting',type:'Painting',images:{print:{url:'https://images.test/'+offset,width:2000,height:1500}},share_license_status:'CC0'}]}});
  });
  const count=await page.evaluate(async()=>{
    const original=Math.random;let seed=123;Math.random=()=>((seed=seed*16807%2147483647)/2147483647);
    try{return (await loadClevelandData(()=>{},{filters:getSelectedFilters()})).length;}finally{Math.random=original;}
  });
  expect(count).toBe(8);expect(new Set(offsets).size).toBe(8);expect(Math.max(...offsets)).toBeGreaterThan(200);
});

test('Met uses v1.1 pagination and stays inside the 10000-result search window',async({page})=>{
  const offsets=[];
  await page.route('https://collectionapi.metmuseum.org/**',r=>{
    const u=new URL(r.request().url());
    if(u.pathname.endsWith('/search')){
      expect(u.pathname).toContain('/v1.1/');expect(u.searchParams.get('medium')).toBe('Paintings');
      const offset=Number(u.searchParams.get('offset')||0);offsets.push(offset);
      expect(offset+Number(u.searchParams.get('limit'))).toBeLessThanOrEqual(10000);
      return r.fulfill({json:{total:14424,objectIDs:[100+offset]}});
    }
    return r.fulfill({json:{objectID:Number(u.pathname.split('/').pop()),title:'Met painting',classification:'Paintings',primaryImage:'https://images.test/met',isPublicDomain:true}});
  });
  const count=await page.evaluate(async()=>(await loadMETData(()=>{},{filters:getSelectedFilters()})).length);
  expect(count).toBe(5);expect(new Set(offsets).size).toBe(5);
});

test('Getty samples the catalogue beyond its former fixed 160-record window',async({page})=>{
  const offsets=[];
  await page.route('https://data.getty.edu/**',r=>{
    const u=new URL(r.request().url());
    if(u.pathname.endsWith('/sparql')){
      const q=u.searchParams.get('query');expect(q).toContain('300033618');
      if(q.includes('COUNT('))return r.fulfill({json:{results:{bindings:[{count:{value:'1046'}}]}}});
      const offset=Number(q.match(/OFFSET (\d+)/)[1]);offsets.push(offset);
      return r.fulfill({json:{results:{bindings:[{object:{value:'https://data.getty.edu/museum/collection/object/p-'+offset}}]}}});
    }
    if(u.pathname.includes('/collection/object/'))return r.fulfill({json:{id:u.href,_label:'Getty painting',classified_as:[{_label:'Paintings'}],shows:[{id:'https://data.getty.edu/media/image/1'}]}});
    return r.fulfill({json:{subject_to:[{classified_as:[{id:'http://creativecommons.org/publicdomain/zero/1.0/'}]}],digitally_shown_by:[{access_point:[{id:'https://media.getty.edu/iiif/image/1'}]}]}});
  });
  const count=await page.evaluate(async()=>{
    const original=Math.random;let seed=995;Math.random=()=>((seed=seed*16807%2147483647)/2147483647);
    try{return (await loadGettyData(()=>{},{filters:getSelectedFilters()})).length;}finally{Math.random=original;}
  });
  expect(count).toBe(4);expect(Math.max(...offsets)).toBeGreaterThan(160);
});

test('filter migration preserves combined drawing and print selections and duplicate time categories',async({page})=>{
  await page.evaluate(()=>localStorage.setItem(SETTINGS_KEY,JSON.stringify({version:1,checkboxes:{sourceDrawings:true,sourcePaintings:false,deptModern:true,deptContemporary:true}})));
  await page.reload();
  for(const id of ['sourceDrawings','sourcePrints','periodModern','periodContemporary'])await expect(page.locator('#'+id)).toBeChecked();
  expect(await page.locator('#deptModern').count()).toBe(0);
  await page.evaluate(()=>{document.getElementById('sourcePrints').checked=false;saveSettings();});
  await page.reload();await expect(page.locator('#sourcePrints')).not.toBeChecked();
});

test('filters distinguish prints, date overlap, unknown origin and screen shape without guessing museum origin',async({page})=>{
  const result=await page.evaluate(()=>{
    const base={types:['painting'],departments:[],periods:[],properties:['publicDomain'],landscape:false};
    const work={classification_title:'Painting',is_public_domain:true,date_start:1740,date_end:1760};
    return {
      print:normalizeArtwork({classification_title:'Etching'}).categories.types,
      drawing:normalizeArtwork({classification_title:'Drawing'}).categories.types,
      overlap:matchesFilters(work,{...base,periods:[{start:1750,end:1949}]}),
      unknownExcluded:matchesFilters(work,{...base,departments:['european']}),
      unknownIncluded:matchesFilters(work,{...base,departments:['european'],includeUnknown:true}),
      museumGuess:normalizeArtwork({...work,department_title:'Rijksmuseum'}).categories.regions,
      ratio:[matchesScreenRatio(1920,1080),matchesScreenRatio(1400,1200),matchesScreenRatio(3000,1000)],
      restrictedUnknown:matchesFilters({}, {...base,includeUnknown:true})
    };
  });
  expect(result).toEqual({print:['print'],drawing:['drawing'],overlap:true,unknownExcluded:false,unknownIncluded:true,museumGuess:[],ratio:[true,false,false],restrictedUnknown:false});
});

test('high resolution checks downloaded pixels even if the catalogue promises a huge zoomable original',async({page})=>{
  expect(await page.evaluate(()=>{
    activeFilters={properties:['highRes'],landscape:false};
    return imageMatchesRequirements({naturalWidth:800,naturalHeight:600},{imageWidth:9000,imageHeight:6000,is_zoomable:true});
  })).toBe(false);
  expect(await page.evaluate(()=>artworkImageUrl({imageUrl:'https://iiif.micr.io/test/full/!1920,1080/0/default.jpg'}))).toContain('/full/!1920,1920/');
});

test('empty results identify a restrictive filter without silently changing selections',async({page})=>{
  await page.evaluate(()=>{document.getElementById('deptAsian').checked=true;loadAllArtworks();});
  await expect(page.locator('#loadingText')).toContainText('Herkunft erweitern: 1');
  await expect(page.locator('#deptAsian')).toBeChecked();
});
