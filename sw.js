const C='okaimono-v10';const F=['./','index.html','style.css','app.js','ai.js','consult.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','data/regions.json','data/stores.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
// 店データ（data/*.json）はネットワーク優先（更新が届くように。圏外ならキャッシュ）。そのほかはキャッシュ優先。
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 const put=n=>{if(n&&n.ok){const cp=n.clone();caches.open(C).then(c=>c.put(e.request,cp))}return n};
 if(/\/data\/[^/]+\.json$/.test(u.pathname)){e.respondWith(fetch(e.request,{cache:'no-cache'}).then(put).catch(()=>caches.match(e.request)));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(put)))});
