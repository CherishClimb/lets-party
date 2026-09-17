/* Complete offline cache for the static birthday adventure. */
'use strict';

const APP_CACHE_PREFIX = 'lets-party-';
const CACHE_NAME = 'lets-party-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app.js',
  './content.js',
  './game.js',
  './narration.js',
  './photo-store.js',
  './styles.css',
  './Assets/Audio/story/ambient.mp3',
  './Assets/Audio/story/final.mp3',
  './Assets/Audio/story/final-01.mp3',
  './Assets/Audio/story/final-02.mp3',
  './Assets/Audio/story/final-03.mp3',
  './Assets/Audio/story/final-04.mp3',
  './Assets/Audio/story/scene-01.mp3',
  './Assets/Audio/story/scene-02.mp3',
  './Assets/Audio/story/scene-03.mp3',
  './Assets/Audio/story/scene-04.mp3',
  './Assets/Audio/story/scene-05.mp3',
  './Assets/Audio/story/scene-06.mp3',
  './Assets/Audio/story/storm.mp3',
  './Assets/Audio/story/treasure-01.mp3',
  './Assets/Audio/story/treasure-02.mp3',
  './Assets/Audio/story/treasure-03.mp3',
  './Assets/Lucy geburtstag einlagungskarte.png',
  './Assets/lucy-unicorn-cutout.png',
  './Assets/magic/butterflies.png.png',
  './Assets/magic/decos.png',
  './Assets/magic/enchanted_forest_stormscape_with_castle.png.png',
  './Assets/magic/flowers.png.png',
  './Assets/magic/forest-day.png.png',
  './Assets/magic/leaves-branch.png.png',
  './Assets/magic/sparkles.png.png',
  './Assets/magic/sparkling_pastel_rainbow_unicorn.png.png',
  './Assets/magic/treasure-chest.png.png',
  './Assets/pose 1.png',
  './Assets/pose 2.png',
  './Assets/pose 3.png',
  './Assets/pose4.png',
  './Assets/pose 5.png',
  './Assets/pose 6.png',
  './Assets/pose 7.png',
  './Assets/pose 8.png',
  './Assets/pose 9.png',
  './Assets/team-characters.png'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names
      .filter(name=>name.startsWith(APP_CACHE_PREFIX)&&name!==CACHE_NAME)
      .map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith(request.mode==='navigate'?navigationResponse(request):cacheFirst(request));
});

async function navigationResponse(request) {
  const cache=await caches.open(CACHE_NAME);
  try {
    const response=await fetch(request);
    if(response.ok) await cache.put(request,response.clone());
    return response;
  } catch {
    return (await cache.match(new URL('./index.html',self.registration.scope).href))
      || cache.match(new URL('./',self.registration.scope).href);
  }
}

async function cacheFirst(request) {
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached) return rangedResponse(request,cached);
  const response=await fetch(request);
  if(response.ok&&response.status===200) await cache.put(request,response.clone());
  return response;
}

async function rangedResponse(request,response) {
  const range=request.headers.get('range');
  if(!range) return response;
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match) return response;
  const buffer=await response.arrayBuffer(),size=buffer.byteLength;
  let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]||0));
  let end=match[2]&&match[1]?Number(match[2]):size-1;
  end=Math.min(end,size-1);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>end||start>=size) {
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  }
  const headers=new Headers(response.headers);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+size);
  headers.set('Content-Length',String(end-start+1));
  return new Response(buffer.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}
