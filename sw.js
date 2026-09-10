const CACHE='word-magician-shell-174ceae85841';
const ASSETS=['./','./index.html','./styles.css','./app.js','./data.js','./state.js','./card-image.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('word-magician-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const saved=await cache.match(event.request);
    if(saved)return saved;
    try{return await fetch(event.request);}
    catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE')self.skipWaiting();
  if(event.data?.type==='STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const entries=await Promise.all(ASSETS.map(asset=>cache.match(asset)));
    event.ports[0]?.postMessage({ready:entries.every(Boolean),version:CACHE});
  })());
});
