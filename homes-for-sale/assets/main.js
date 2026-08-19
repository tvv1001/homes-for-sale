// Support ?clear-cache=1 to unregister the service worker and wipe all
// caches on demand, e.g. http://localhost:8090/?clear-cache=1
async function clearServiceWorkerCacheIfRequested() {
	const params = new URLSearchParams(location.search);
	if (!params.has('clear-cache')) return false;

	console.log('clear-cache requested: unregistering service worker and clearing caches…');
	if ('serviceWorker' in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((r) => r.unregister()));
	}
	if ('caches' in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	}

	// reload without the query param for a clean, cache-free load
	const url = new URL(location.href);
	url.searchParams.delete('clear-cache');
	location.replace(url.toString());
	return true;
}

// Register the service worker and provide any client-side helpers
clearServiceWorkerCacheIfRequested().then((cleared) => {
	if (cleared) return; // page is reloading
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker
				.register('./sw.js')
				.then(() => console.log('Service Worker Registered Successfully!'))
				.catch((err) => console.log('Service Worker Registration Failed:', err));
		});
	}
});

// We'll load listing metadata from assets/listings.json so it's editable without changing JS
let LISTINGS = [];

function loadListings() {
	return fetch('assets/listings.json')
		.then((res) => res.json())
		.then((data) => {
			LISTINGS = data.listings.map((l) => ({
				...l,
				url: `listing-${l.id}.html`
			}));
			return LISTINGS;
		})
		.catch((err) => {
			console.warn('Could not load listings.json, falling back to empty list', err);
			LISTINGS = [];
			return LISTINGS;
		});
}

// Attach left/right swipe gesture support to an element, e.g. a carousel's
// slide area. Calls onPrev()/onNext() when a horizontal swipe is detected.
function attachSwipeGestures(el, onPrev, onNext) {
	if (!el) return;
	let startX = null;
	const SWIPE_THRESHOLD = 40;

	el.addEventListener(
		'touchstart',
		(e) => {
			startX = e.changedTouches[0].clientX;
		},
		{ passive: true },
	);
	el.addEventListener(
		'touchend',
		(e) => {
			if (startX === null) return;
			const dx = e.changedTouches[0].clientX - startX;
			if (dx > SWIPE_THRESHOLD) onPrev();
			else if (dx < -SWIPE_THRESHOLD) onNext();
			startX = null;
		},
		{ passive: true },
	);
}

// Home page: render one card per listing, each linking to its detail page
function initHomeCards() {
	const root = document.getElementById('home-listings');
	if (!root) return;

	root.innerHTML = '';
	LISTINGS.forEach((listing) => {
		const card = document.createElement('a');
		card.className = 'card listing-card';
		card.href = listing.url;

		const img = document.createElement('img');
		img.src = listing.images[0];
		img.alt = listing.title;
		img.loading = 'lazy';
		card.appendChild(img);

		const body = document.createElement('div');
		body.className = 'listing-card-body';
		body.innerHTML = `<h3>${listing.title}</h3>`;
		card.appendChild(body);

		root.appendChild(card);
	});
}

function createLightbox() {
	const modal = document.createElement('div');
	modal.id = 'lightbox-modal';
	modal.innerHTML = `
	<div class="lb-inner">
	  <button id="lb-close" aria-label="Close">×</button>
	  <img id="lb-img" src="" alt="" />
	  <div id="lb-caption"></div>
	</div>`;
	document.body.appendChild(modal);

	const lbImg = modal.querySelector('#lb-img');
	const lbClose = modal.querySelector('#lb-close');

	let currentImages = [];
	let currentIndex = 0;

	function showIndex(i) {
		if (!currentImages.length) return;
		currentIndex = (i + currentImages.length) % currentImages.length;
		lbImg.src = currentImages[currentIndex];
	}

	document.addEventListener('click', (e) => {
		const t = e.target.closest('.card img, .slide-image');
		if (t && !t.closest('.listing-card')) {
			// build the ordered list of images in scope (listing/gallery section) so
			// arrow keys and swipes can cycle through the same set the user is browsing
			const scope = t.closest('.gallery-section, main.container[data-listing-id]') || document;
			const srcs = Array.from(scope.querySelectorAll('.slide-image, .thumb-grid img, .grid img')).map((img) => img.src);
			currentImages = [...new Set(srcs)];
			currentIndex = currentImages.indexOf(t.src);
			if (currentIndex === -1) currentIndex = 0;
			lbImg.src = t.src;
			modal.classList.add('open');
		}
	});
	lbClose.addEventListener('click', () => modal.classList.remove('open'));
	modal.addEventListener('click', (e) => {
		if (e.target === modal) modal.classList.remove('open');
	});

	document.addEventListener('keydown', (e) => {
		if (!modal.classList.contains('open')) return;
		if (e.key === 'ArrowRight') showIndex(currentIndex + 1);
		if (e.key === 'ArrowLeft') showIndex(currentIndex - 1);
		if (e.key === 'Escape') modal.classList.remove('open');
	});

	// swipe support (touch devices)
	let touchStartX = null;
	modal.addEventListener(
		'touchstart',
		(e) => {
			touchStartX = e.changedTouches[0].clientX;
		},
		{ passive: true },
	);
	modal.addEventListener(
		'touchend',
		(e) => {
			if (touchStartX === null) return;
			const dx = e.changedTouches[0].clientX - touchStartX;
			const SWIPE_THRESHOLD = 40;
			if (dx > SWIPE_THRESHOLD) showIndex(currentIndex - 1);
			else if (dx < -SWIPE_THRESHOLD) showIndex(currentIndex + 1);
			touchStartX = null;
		},
		{ passive: true },
	);
}

// Populate the gallery page (gallery.html) with a per-listing image carousel
function initGallery() {
	const galleryRoot = document.getElementById('gallery-root');
	if (!galleryRoot) return;

	galleryRoot.innerHTML = '';
	LISTINGS.forEach((listing) => {
		const section = document.createElement('section');
		section.className = 'gallery-section';

		const heading = document.createElement('h2');
		heading.innerHTML = `${listing.title} <a class="btn small" href="listing-${listing.id}.html">View listing</a>`;
		section.appendChild(heading);

		const sub = document.createElement('p');
		sub.className = 'muted';
		sub.textContent = listing.sub;
		section.appendChild(sub);

		const viewer = document.createElement('div');
		viewer.className = 'viewer';
		viewer.innerHTML = `
			<div class="slide-wrap">
				<img class="slide-image" src="${listing.images[0]}" alt="${listing.title} photo 1">
			</div>
		`;
		section.appendChild(viewer);

		const thumbGrid = document.createElement('div');
		thumbGrid.className = 'thumb-grid';
		section.appendChild(thumbGrid);

		const slideImg = viewer.querySelector('.slide-image');
		let slideIndex = 0;

		function setSlide(i) {
			slideIndex = (i + listing.images.length) % listing.images.length;
			slideImg.src = listing.images[slideIndex];
			slideImg.alt = `${listing.title} photo ${slideIndex + 1}`;
			thumbGrid.querySelectorAll('img').forEach((n, idx) => n.classList.toggle('active', idx === slideIndex));
		}

		listing.images.forEach((src, i) => {
			const t = document.createElement('img');
			t.src = src;
			t.alt = `${listing.title} thumb ${i + 1}`;
			t.loading = 'lazy';
			t.className = i === 0 ? 'active' : '';
			t.addEventListener('click', () => setSlide(i));
			thumbGrid.appendChild(t);
		});

		attachSwipeGestures(
			viewer.querySelector('.slide-wrap'),
			() => setSlide(slideIndex - 1),
			() => setSlide(slideIndex + 1),
		);

		galleryRoot.appendChild(section);
	});
}

// Populate listing detail pages when present
function initDetailPage() {
	const detailRoot = document.querySelector('main.container[data-listing-id]');
	if (!detailRoot) return;
	const id = detailRoot.getAttribute('data-listing-id');
	const listing = LISTINGS.find((l) => l.id === id);
	if (!listing) return;
	// fill header info
	const h1 = detailRoot.querySelector('h1');
	if (h1) h1.textContent = listing.title;
	const desc = detailRoot.querySelector('.listing-description');
	if (desc) desc.innerHTML = listing.description || '';

	// facts & features (grouped, e.g. Interior / Property / Construction)
	const featuresEl = detailRoot.querySelector('.listing-facts-features');
	if (featuresEl) {
		featuresEl.innerHTML = '';
		if (Array.isArray(listing.featuresGroups) && listing.featuresGroups.length) {
			const heading = document.createElement('h2');
			heading.textContent = 'Facts & features';
			featuresEl.appendChild(heading);

			listing.featuresGroups.forEach((group) => {
				const groupEl = document.createElement('div');
				groupEl.className = 'ff-group';

				const groupHeading = document.createElement('h3');
				groupHeading.textContent = group.heading;
				groupEl.appendChild(groupHeading);

				(group.items || []).forEach((item) => {
					const block = document.createElement('div');
					block.className = 'ff-block';
					if (Array.isArray(item.subitems) && item.subitems.length) {
						const blockHeading = document.createElement('h4');
						blockHeading.textContent = item.label;
						block.appendChild(blockHeading);
						const ul = document.createElement('ul');
						item.subitems.forEach((sub) => {
							const li = document.createElement('li');
							li.innerHTML = `<span class="ff-label">${sub.label}:</span> ${sub.value}`;
							ul.appendChild(li);
						});
						block.appendChild(ul);
					} else {
						block.innerHTML = `<span class="ff-label">${item.label}:</span> ${item.value}`;
					}
					groupEl.appendChild(block);
				});

				featuresEl.appendChild(groupEl);
			});
		}
	}

	// prominent price, above the fold, next to the photo viewer
	const priceTag = detailRoot.querySelector('.listing-price-tag');
	if (priceTag) priceTag.textContent = listing.price;

	// parcel number, shown near the top of the facts tile, right under the price
	const parcelEl = detailRoot.querySelector('.listing-parcel');
	if (parcelEl) {
		if (!listing.parcelNumber) {
			parcelEl.innerHTML = '';
		} else if (listing.parcelUrl) {
			parcelEl.innerHTML = `Parcel #: <a href="${listing.parcelUrl}" target="_blank" rel="noopener">${listing.parcelNumber}</a>`;
		} else {
			parcelEl.textContent = `Parcel #: ${listing.parcelNumber}`;
		}
	}

	const facts = detailRoot.querySelector('.listing-facts');
	if (facts) {
		facts.innerHTML = `
			<table>
				<tr><th>Beds</th><td>${listing.beds}</td></tr>
				<tr><th>Baths</th><td>${listing.baths}</td></tr>
				<tr><th>${listing.areaUnit || 'Sqft'}</th><td>${listing.sqft}</td></tr>
				<tr><th>Year</th><td>${listing.year}</td></tr>
				<tr><th>Address</th><td>${listing.address || ''}</td></tr>
			</table>
		`;
	}
	const agent = detailRoot.querySelector('.listing-agent');
	if (agent) {
		if (listing.contact && listing.contact.url) {
			agent.innerHTML = `<a href="${listing.contact.url}" target="_blank" rel="noopener">${listing.contact.label}</a>`;
		} else if (listing.agent) {
			agent.innerHTML = `<strong>${listing.agent.name}</strong>${listing.agent.email ? `<br><a href="mailto:${listing.agent.email}">${listing.agent.email}</a>` : ''}`;
		} else {
			agent.innerHTML = '';
		}
	}

	// featured photo viewer at the top of the page
	const viewer = detailRoot.querySelector('.listing-hero .viewer');
	if (viewer) {
		const slideImg = viewer.querySelector('.slide-image');
		const thumbGrid = detailRoot.querySelector('.listing-hero .thumb-grid');
		let slideIndex = 0;

		function setSlide(i) {
			slideIndex = (i + listing.images.length) % listing.images.length;
			slideImg.src = listing.images[slideIndex];
			slideImg.alt = `${listing.title} photo ${slideIndex + 1}`;
			if (thumbGrid) thumbGrid.querySelectorAll('img').forEach((n, idx) => n.classList.toggle('active', idx === slideIndex));
		}

		if (thumbGrid) {
			thumbGrid.innerHTML = '';
			listing.images.forEach((src, i) => {
				const t = document.createElement('img');
				t.src = src;
				t.alt = `${listing.title} thumb ${i + 1}`;
				t.loading = 'lazy';
				t.className = i === 0 ? 'active' : '';
				t.addEventListener('click', () => setSlide(i));
				thumbGrid.appendChild(t);
			});
		}

		attachSwipeGestures(
			viewer.querySelector('.slide-wrap'),
			() => setSlide(slideIndex - 1),
			() => setSlide(slideIndex + 1),
		);

		setSlide(0);
	}

	// populate photos grid
	const grid = detailRoot.querySelector('.grid');
	if (grid) {
		grid.innerHTML = '';
		listing.images.forEach((src) => {
			const div = document.createElement('div');
			div.className = 'card';
			const img = document.createElement('img');
			img.src = src;
			img.loading = 'lazy';
			div.appendChild(img);
			grid.appendChild(div);
		});
	}

	// price history
	const ph = detailRoot.querySelector('.listing-price-history');
	if (ph) {
		ph.innerHTML = '';
		if (Array.isArray(listing.priceHistory)) {
			const ul = document.createElement('ul');
			ul.className = 'price-history';
			listing.priceHistory.forEach((p) => {
				const li = document.createElement('li');
				li.innerHTML = `<strong>${p.price}</strong> — ${p.event} <span class="muted">(${p.date})</span>`;
				ul.appendChild(li);
			});
			ph.appendChild(ul);
		}
	}

	// map placeholder (link to Google Maps query, or a direct mapUrl override)
	const mapEl = detailRoot.querySelector('.listing-map');
	if (mapEl) {
		if (listing.mapUrl) {
			mapEl.innerHTML = `<a target="_blank" rel="noopener" href="${listing.mapUrl}">Open map for ${listing.mapLabel || listing.title}</a>`;
		} else {
			const q = encodeURIComponent(listing.address || listing.title || '');
			mapEl.innerHTML = `<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${q}">Open map for ${listing.address || listing.title}</a>`;
		}
	}

	// contact form (mailto fallback)
	const contactEl = detailRoot.querySelector('.listing-contact');
	if (contactEl) {
		contactEl.innerHTML = `
			<form class="contact-form">
				<label>Agent: <strong>${listing.agent.name}</strong></label>
				<label>Your name <input name="name" required></label>
				<label>Your email <input name="email" type="email" required></label>
				<label>Message <textarea name="message">I'm interested in ${listing.title}</textarea></label>
				<button type="submit" class="btn">Contact Agent</button>
			</form>
		`;
		const form = contactEl.querySelector('.contact-form');
		form.addEventListener('submit', (ev) => {
			ev.preventDefault();
			const data = new FormData(form);
			const subject = encodeURIComponent(`Inquiry: ${listing.title}`);
			const body = encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`);
			location.href = `mailto:${listing.agent.email}?subject=${subject}&body=${body}`;
		});
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	await loadListings();
	initHomeCards();
	initGallery();
	initDetailPage();
	createLightbox();
});
