const CACHE_NAME = 'fitlab-static-v1';
const STATIC_FILES = ['./', './index.html', './css/style.css', './js/app.js', './js/ui.js', './js/auth.js', './js/foods.js', './js/meals.js', './js/supabase.js', './manifest.json', './logo.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => { const requestUrl = new URL(event.request.url); if (requestUrl.origin !== self.location.origin) return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); });
