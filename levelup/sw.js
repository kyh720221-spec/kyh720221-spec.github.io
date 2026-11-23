const C='levelup-v19';const F=['./','index.html','style.css','app.js','sync.js','config.js','vendor/msal-browser.min.js','manifest.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin||/login\.microsoftonline|login\.live|graph\.microsoft|onedrive|sharepoint|1drv/.test(u.host))return;
 if(u.search.includes('code=')||u.hash.includes('code='))return;
 const net=fetch(new Request(e.request,{cache:'no-store'})).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp))}return res});
 const path=u.pathname,shell=/(?:^|\/)(index\.html|app\.js|sw\.js)$/.test(path)||path.endsWith('/levelup')||path.endsWith('/levelup/')||path.endsWith('config.js')||path==='/'||/\/$/.test(path);
 if(shell)e.respondWith(net.catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));
 else e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||net.catch(()=>caches.match('index.html'))));
});
