/* Решатель — офлайн-кеш (B10).
   Версия кэша меняется при каждой сборке: старая чистка уходит сама. */
const VERSION = "4.4.0";
const CACHE = "reshatel-" + VERSION;
const SHELL = ["./", "./index.html"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* кешируем по одному: отсутствие необязательного файла не должно ломать установку */
      return Promise.all(SHELL.map(function(u){
        return c.add(new Request(u, {cache:"reload"})).catch(function(){ return null; });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k.indexOf("reshatel-")===0 && k!==CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("message", function(e){
  if(e.data && e.data.type === "skip") self.skipWaiting();
});

self.addEventListener("fetch", function(e){
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;   /* чужие домены не трогаем */

  /* страница: сначала кэш (мгновенный запуск), потом тихое обновление из сети */
  if(req.mode === "navigate"){
    e.respondWith(
      caches.match("./index.html").then(function(hit){
        const fresh = fetch(req).then(function(res){
          if(res && res.ok) caches.open(CACHE).then(function(c){ c.put("./index.html", res.clone()); });
          return res;
        }).catch(function(){ return hit; });
        return hit || fresh;
      })
    );
    return;
  }

  /* остальное: кэш → сеть, с докладыванием в кэш */
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.ok && res.type === "basic"){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
    })
  );
});
