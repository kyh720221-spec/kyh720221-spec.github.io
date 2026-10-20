const C='levelup-v8';const F=['./','index.html','style.css','app.js','sync.js','config.js','vendor/msal-browser.min.js','manifest.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 // 로그인·Graph·다른 출처 요청은 절대 캐시하지 않음
 if(e.request.method!=='GET'||u.origin!==location.origin||/login\.microsoftonline|login\.live|graph\.microsoft|onedrive|sharepoint|1drv/.test(u.host))return;
 if(u.search.includes('code=')||u.hash.includes('code='))return;
 const net=fetch(e.request).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp))}return res});
 // config.js는 네트워크 우선(ID 교체가 바로 반영되도록), 나머지는 캐시 우선
 if(u.pathname.endsWith('config.js'))e.respondWith(net.catch(()=>caches.match(e.request)));
 else e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||net.catch(()=>caches.match('index.html'))));
});
