/* Решатель — офлайн-кеш (B10).
   Версия кэша меняется при каждой сборке: старая чистка уходит сама. */
const VERSION = "6.0.2";
const CACHE = "reshatel-" + VERSION;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

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

  /* страница: сначала сеть, кэш — только если сети нет.
     Раньше было наоборот, и после каждой выкладки человек ещё одну загрузку
     видел старую версию: «может у меня не та версия». */
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          const copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        }
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(hit){
          return hit || caches.match("./");
        });
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
