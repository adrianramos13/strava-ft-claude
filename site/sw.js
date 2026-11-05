/* Service worker: la app funciona sin conexión y avisa los domingos donde el navegador lo permite. */
const VERSION = 'entreno-v2';
const APP = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/analysis.js', 'js/importar.js', 'js/planner.js', 'js/charts.js', 'js/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'avisos').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// red primero (para recibir mejoras), caché si no hay conexión
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const propio = e.request.url.startsWith(self.location.origin);
  e.respondWith(fetch(e.request, propio ? {cache: 'no-cache'} : {}).then((r) => {
    if (r.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('cdnjs.cloudflare.com'))) {
      const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia));
    }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true}).then((r) => r || caches.match('index.html'))));
});

// aviso del domingo (Android con la app instalada; el navegador decide cuándo se ejecuta)
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'domingo') return;
  e.waitUntil((async () => {
    const ahora = new Date();
    if (ahora.getDay() !== 0 || ahora.getHours() < 12) return;
    const clave = `aviso-${ahora.toISOString().slice(0, 10)}`;
    const c = await caches.open('avisos');
    if (await c.match(clave)) return;
    await c.put(clave, new Response('1'));
    await self.registration.showNotification('Planifica tu semana', {
      body: '¿Cuántos días vas a entrenar? Sube también tu export de Strava.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'domingo', data: {url: './#semana'}});
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#semana', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope));
    if (w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
