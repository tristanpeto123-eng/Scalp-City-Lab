const CACHE='scalp-city-lab-v1-3d-v5-BT01-agent-v1';
const CORE=['./','./index.html','./styles.css','./backtester-agent.css','./backtester-agent-ui.js','./cfd-engine.js','./backtester-agent.js','./backtester-agent-worker.js','./backtester-agent.json','./app.js','./scene3d.js','./training-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./scalp-city-concept.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('scalp-city-lab-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==location.origin)return;
  const networkFirst=req.mode==='navigate'||/\.(?:html|js|css)$/.test(url.pathname);
  if(networkFirst){
    event.respondWith(fetch(req).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));return resp}).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));return resp})));
});
