const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const workerSource=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

function precacheUrls() {
  const match=workerSource.match(/const PRECACHE_URLS\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(match,'service worker exposes a static pre-cache list');
  return vm.runInNewContext(match[1]);
}

function filesBelow(folder) {
  return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(folder,entry.name);
    return entry.isDirectory()?filesBelow(full):[full];
  });
}

test('manifest and iPad metadata describe the local standalone app',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.name,"Let's Party – Einhorn Abenteuer");
  assert.equal(manifest.short_name,"Let's Party");
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  assert.ok(manifest.icons.some(icon=>icon.src==='Assets/magic/sparkling_pastel_rainbow_unicorn.png.png'));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html,/apple-mobile-web-app-capable" content="yes"/);
  assert.match(html,/rel="apple-touch-icon"/);
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(app,/serviceWorker\.register\('\.\/service-worker\.js'/);
  assert.match(app,/postMessage\?\.\(\{type:'REFRESH_AUDIO_CACHE'\}\)/);
});

test('pre-cache includes every local app asset and every shell file',()=>{
  const urls=precacheUrls(),set=new Set(urls);
  for(const file of ['index.html','manifest.webmanifest','app.js','content.js','game.js','narration.js','photo-store.js','styles.css']) {
    assert.ok(set.has('./'+file),file+' is pre-cached');
  }
  for(const file of filesBelow(path.join(root,'Assets'))) {
    const relative='./'+path.relative(root,file).replaceAll('\\','/');
    assert.ok(set.has(relative),relative+' is pre-cached');
  }
  for(const url of urls) {
    assert.doesNotMatch(url,/^https?:/);
    if(url==='./') continue;
    assert.ok(fs.existsSync(path.join(root,decodeURIComponent(url.slice(2)))),url+' exists with exact casing');
  }
});

test('service worker refreshes audio online and falls back to the newest cached copy offline',async()=>{
  const listeners={},cacheStores=new Map(),scope='http://localhost:8080/';
  const networkOverrides=new Map(),networkRequests=[];
  let skipped=false,claimed=false,networkOnline=true,networkCalls=0;
  const normalize=input=>new URL(typeof input==='string'?input:input.url,scope).href.split('?')[0];
  const mime=file=>file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/plain';
  const diskBody=url=>{
    const pathname=decodeURIComponent(new URL(url,scope).pathname.slice(1));
    const relative=!pathname||pathname.endsWith('/')?'index.html':pathname;
    return fs.readFileSync(path.join(root,relative));
  };
  const cacheApi=name=>({
    async addAll(urls) {
      const store=cacheStores.get(name);
      for(const url of urls) store.set(normalize(url),new Response(diskBody(url),{status:200,headers:{'Content-Type':mime(url)}}));
    },
    async match(input) {return cacheStores.get(name).get(normalize(input))?.clone();},
    async put(input,response) {cacheStores.get(name).set(normalize(input),response.clone());}
  });
  const cachesMock={
    async open(name) {if(!cacheStores.has(name)) cacheStores.set(name,new Map());return cacheApi(name);},
    async keys() {return [...cacheStores.keys()];},
    async delete(name) {return cacheStores.delete(name);}
  };
  const workerSelf={
    registration:{scope},location:{origin:'http://localhost:8080'},
    clients:{async claim(){claimed=true;}},async skipWaiting(){skipped=true;},
    addEventListener(type,listener){listeners[type]=listener;}
  };
  const context={self:workerSelf,caches:cachesMock,URL,Request,Response,Headers,console,
    fetch:async request=>{
      networkCalls++;networkRequests.push({url:normalize(request),cache:request.cache||'',range:request.headers?.get?.('range')||''});
      if(!networkOnline) throw new Error('offline');
      const url=normalize(request),body=networkOverrides.get(url)||diskBody(url);
      return new Response(body,{status:200,headers:{'Content-Type':mime(url)}});
    }};
  vm.runInNewContext(workerSource,context,{filename:'service-worker.js'});

  let pending;
  listeners.install({waitUntil(promise){pending=promise;}});await pending;
  assert.equal(skipped,true);assert.equal(cacheStores.get('lets-party-v5').size,precacheUrls().length);
  const audioPrecache=networkRequests.filter(request=>request.url.endsWith('.mp3'));
  assert.equal(audioPrecache.length,precacheUrls().filter(url=>url.endsWith('.mp3')).length);
  assert.ok(audioPrecache.every(request=>request.cache==='no-store'));
  cacheStores.set('lets-party-v4',new Map());
  listeners.activate({waitUntil(promise){pending=promise;}});await pending;
  assert.equal(claimed,true);assert.equal(cacheStores.has('lets-party-v4'),false);

  let responsePromise;
  const replacedUrl=scope+'Assets/Audio/story/scene-01.mp3';
  networkOverrides.set(replacedUrl,Buffer.from('new narration with unchanged filename'));
  const refreshStart=networkRequests.length;
  listeners.message({data:{type:'REFRESH_AUDIO_CACHE'},waitUntil(promise){pending=promise;}});await pending;
  assert.equal(await (await cacheApi('lets-party-v5').match(replacedUrl)).text(),'new narration with unchanged filename');
  const refreshRequests=networkRequests.slice(refreshStart);
  assert.equal(refreshRequests.length,precacheUrls().filter(url=>url.endsWith('.mp3')).length);
  assert.ok(refreshRequests.every(request=>request.cache==='no-store'));

  listeners.fetch({request:{method:'GET',mode:'cors',url:replacedUrl,headers:new Headers()},respondWith(promise){responsePromise=promise;}});
  assert.equal(await (await responsePromise).text(),'new narration with unchanged filename');
  const freshRequest=networkRequests.at(-1);
  assert.equal(freshRequest.cache,'no-store');assert.equal(freshRequest.range,'');

  networkOnline=false;
  listeners.fetch({request:{method:'GET',mode:'cors',url:replacedUrl,headers:new Headers()},respondWith(promise){responsePromise=promise;}});
  assert.equal(await (await responsePromise).text(),'new narration with unchanged filename');

  listeners.fetch({request:{method:'GET',mode:'navigate',url:scope+'some/offline/page',headers:new Headers()},respondWith(promise){responsePromise=promise;}});
  const navigation=await responsePromise;
  assert.match(await navigation.text(),/<!doctype html>/i);

  const callsBefore=networkCalls,audioUrl=scope+'Assets/Audio/story/final.mp3';
  listeners.fetch({request:{method:'GET',mode:'cors',url:audioUrl,headers:new Headers({'Range':'bytes=10-19'})},respondWith(promise){responsePromise=promise;}});
  const audio=await responsePromise;
  assert.equal(audio.status,206);assert.equal(audio.headers.get('Content-Range'),'bytes 10-19/1423302');
  assert.equal((await audio.arrayBuffer()).byteLength,10);
  assert.equal(networkCalls,callsBefore+1,'audio tries the network before using its cached fallback');
  assert.equal(networkRequests.at(-1).cache,'no-store');assert.equal(networkRequests.at(-1).range,'');
});
