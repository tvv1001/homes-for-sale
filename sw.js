// Cache name will be determined at install time by reading /cache-version.txt
let CACHE_NAME = 'gallery-cache-default';
const CACHE_PREFIX = 'gallery-cache-';
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
	// avoid clearing existing clients until activation
	self.skipWaiting();
	event.waitUntil(
		(async () => {
			// determine version from /cache-version.txt (written by deploy)
			try {
				const vres = await fetch('/cache-version.txt', { cache: 'no-store' });
				if (vres && vres.ok) {
					const ver = (await vres.text()).trim();
					if (ver) CACHE_NAME = CACHE_PREFIX + ver;
				}
			} catch (e) {
				// if version not available, keep default CACHE_NAME
				console.warn('sw: could not read cache-version.txt', e);
			}

			const cache = await caches.open(CACHE_NAME);
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

					// dedupe and pre-cache images
					const uniq = [...new Set(images)];
					await Promise.all(uniq.map((url) => cache.add(url).catch(() => null)));
				}
			} catch (err) {
				// ignore failures here; SW will cache dynamically on fetch
				console.warn('sw: could not cache listing images at install', err);
			}
					})();
				);
});

// Activate: cleanup old caches and take control of open pages immediately
self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// delete old caches whose keys don't match the current CACHE_NAME prefix+version
			const keys = await caches.keys();
			await Promise.all(
				keys.map((key) => {
					if (key === CACHE_NAME) return Promise.resolve();
					// only delete caches that match our prefix (avoid touching unrelated caches)
					if (key && key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) return caches.delete(key);
					return Promise.resolve();
				}),
			);
			await self.clients.claim();
		})(),
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
		(async () => {
			// Stale-while-revalidate: return cached response if available, and update cache in background.
			const cache = await caches.open(CACHE_NAME);
			const cachedResponse = await caches.match(event.request);
			const networkFetch = fetch(event.request)
				.then((networkResponse) => {
					if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') return networkResponse;
					const responseClone = networkResponse.clone();
					cache.put(event.request, responseClone).catch(() => null);
					return networkResponse;
				})
				.catch(() => null);

			if (cachedResponse) {
				// update cache in background, but serve cached immediately
				networkFetch;
				return cachedResponse;
			}

			// no cache: wait for network, otherwise fallback to navigation cached page
			const net = await networkFetch;
			if (net) return net;
			if (event.request.mode === 'navigate') return caches.match('./index.html');
			return null;
		})(),
	);
});
