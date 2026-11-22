/* マネー管理 オフライン用 Service Worker
   - アプリ本体は最初の起動で保存し、電波がなくても開けるようにする
   - 電波があるときは最新版を取りにいくが、3秒で返事がなければ保存済みの版で開く
   - 家計のデータはこのファイルでは扱わない（iPhoneの中の保存場所にある） */
const CACHE='money-v3';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
const CDN='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/';

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function putCache(req,res){
  if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(CACHE).then(x=>x.put(req,c))}
  return res;
}
function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);

  // PDF読み取り用ライブラリ：一度使えば保存して、次からは保存版を使う
  if(url.href.startsWith(CDN)){
    e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>putCache(req,r))));
    return;
  }
  if(url.origin!==location.origin)return;

  // アプリ本体を開くとき：最新版を3秒だけ待ち、だめなら保存版で開く
  if(req.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('index.html')){
    const net=fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>{x.put('./index.html',c.clone());x.put('./',c)})}return r});
    e.respondWith(Promise.race([net,timeout(3000)]).catch(()=>
      caches.match('./index.html').then(m=>m||caches.match('./')).then(m=>m||net)
    ));
    e.waitUntil(net.catch(()=>{}));
    return;
  }

  // アイコンなど：保存版をすぐ返し、裏で更新
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(m=>{
    const upd=fetch(req).then(r=>putCache(req,r)).catch(()=>m);
    return m||upd;
  }));
});
