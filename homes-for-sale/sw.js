const CACHE_NAME = 'gallery-cache-v25';
const ASSETS = [
	'./',
	'./index.html',
	'./gallery.html',
	'./assets/style.css',
	'./assets/main.js',
	// Add image paths here if you want them pre-cached, e.g.
	// './assets/images/photo1.jpg'
];

// Install event: cache core assets and images discovered in listings.json
self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then(async (cache) => {
			// cache core assets first
			await cache.addAll(ASSETS);
			// try to fetch listings.json and cache listed images
			try {
				const res = await fetch('./assets/listings.json');
				if (res && res.ok) {
					const data = await res.json();
					const images = [];
					if (Array.isArray(data.listings)) {
						data.listings.forEach((l) => {
							if (Array.isArray(l.images)) images.push(...l.images.map((p) => (p.startsWith('./') ? p : `./${p}`)));
						});
					}
					// dedupe
					const uniq = [...new Set(images)];
					await Promise.all(uniq.map((url) => cache.add(url).catch(() => null)));
				}
			} catch (err) {
				// ignore failures here; SW will cache dynamically on fetch
				console.warn('sw: could not cache listing images at install', err);
			}
		}),
	);
});

// Activate: cleanup old caches and take control of open pages immediately
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.map((key) => {
						if (key !== CACHE_NAME) return caches.delete(key);
					}),
				),
			)
			.then(() => self.clients.claim()),
	);
});

// App shell files (HTML/JS/CSS) that should always be fetched fresh when
// online, falling back to cache only if offline. This avoids the app
// getting stuck on a stale cached version after edits.
const NETWORK_FIRST = /\.(?:html|js|css)$/;

// Fetch: network-first for app shell files, cache-first for everything else
// (images etc.), with dynamic caching of successful GET responses.
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	const isAppShell = event.request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

	if (isAppShell) {
		event.respondWith(
			fetch(event.request)
				.then((networkResponse) => {
					if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
						const responseClone = networkResponse.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
					}
					return networkResponse;
				})
				.catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))),
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) return cachedResponse;
			return fetch(event.request)
				.then((networkResponse) => {
					// Only cache valid responses
					if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
						return networkResponse;
					}
					const responseClone = networkResponse.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
					return networkResponse;
				})
				.catch(() => {
					// Fallback to cached root page for navigation requests
					if (event.request.mode === 'navigate') return caches.match('./index.html');
				});
		}),
	);
});
