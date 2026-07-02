/* Service worker — cachea el "shell" de la app para que funcione sin conexión.
   El clima (api.open-meteo.com) siempre va directo a la red; si falla, el propio
   app.js usa el último pronóstico guardado en localStorage. */

const CACHE_NAME = 'gallinero-cache-v3';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(PRECACHE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method !== 'GET') return;

  // El clima siempre se pide en vivo a la red.
  if(req.url.includes('api.open-meteo.com')){
    event.respondWith(fetch(req).catch(()=>Response.error()));
    return;
  }

  // Resto: cache-first, con actualización en segundo plano y respaldo a la red.
  event.respondWith(
    caches.match(req).then(cached=>{
      const network = fetch(req).then(resp=>{
        if(resp && resp.ok){
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(req, copy));
        }
        return resp;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
