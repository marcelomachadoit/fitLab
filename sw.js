const CACHE_NAME = 'fitlab-static-v22';
const PREVIOUS_CACHES = ['fitlab-static-v1', 'fitlab-static-v2', 'fitlab-static-v3', 'fitlab-static-v4', 'fitlab-static-v5', 'fitlab-static-v6', 'fitlab-static-v7', 'fitlab-static-v8', 'fitlab-static-v9', 'fitlab-static-v10', 'fitlab-static-v11', 'fitlab-static-v12', 'fitlab-static-v13', 'fitlab-static-v14', 'fitlab-static-v15', 'fitlab-static-v16', 'fitlab-static-v17', 'fitlab-static-v18', 'fitlab-static-v19', 'fitlab-static-v20', 'fitlab-static-v21'];
const STATIC_FILES = ['./', './index.html', './css/style.css', './js/app.js', './js/ui.js', './js/auth.js', './js/foods.js', './js/meals.js', './js/recipes.js', './js/goals.js', './js/supabase.js', './manifest.json', './logo.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))); self.skipWaiting(); });
self.addEventListener('activate', (event) => {
	event.waitUntil(Promise.all(PREVIOUS_CACHES.map((cacheName) => caches.delete(cacheName))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
	const requestUrl = new URL(event.request.url);
	if (requestUrl.origin !== self.location.origin) return;

	// Sempre procura uma versão nova do HTML; o cache fica apenas como fallback offline.
	if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('.html')) {
		event.respondWith(fetch(event.request).then((response) => {
			const copy = response.clone();
			caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
			return response;
		}).catch(() => caches.match(event.request)));
		return;
	}

	event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
