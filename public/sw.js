/**
 * sw.js — MAESTRO V12 Service Worker v3.5
 * Updated cache version forces full cache clear
 */
var CACHE   = 'lux-v3.5';
var API_HOST = 'cafeslux-api-production.up.railway.app';

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(['/public/', '/public/index.html']).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  // API calls → always network
  if (url.hostname === API_HOST) {
    e.respondWith(fetch(e.request).catch(function(){
      return new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}});
    }));
    return;
  }
  // Everything else → network first, then cache
  e.respondWith(
    fetch(e.request).then(function(r){
      if(r && r.status === 200) {
        var clone = r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
      }
      return r;
    }).catch(function(){
      return caches.match(e.request).then(function(cached){
        return cached || caches.match('/public/index.html');
      });
    })
  );
});
