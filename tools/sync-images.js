#!/usr/bin/env node
// Scans assets/images/<listing-id>/ for each listing and syncs the listing's
// `images` array in assets/listings.json — without touching any other fields.
//
// - Existing images that are still present on disk keep their current order.
// - New files found in the folder (not yet listed) are appended, sorted
//   naturally (e.g. extra-2.jpg before extra-10.jpg).
// - Images listed in JSON but no longer present on disk are dropped.
//
// Usage: node tools/sync-images.js

const fs = require('fs');
const path = require('path');

const imagesRoot = path.join(__dirname, '..', 'assets', 'images');
const listingsPath = path.join(__dirname, '..', 'assets', 'listings.json');

function isImage(name) {
	return /\.(jpe?g|png|webp|gif|heic)$/i.test(name);
}

function naturalCompare(a, b) {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function computeUpdatedImages(listing) {
	const dirPath = path.join(imagesRoot, listing.id);
	if (!fs.existsSync(dirPath)) {
		console.warn(`No images folder for listing "${listing.id}" (expected ${dirPath}), skipping`);
		return null;
	}

	const filesOnDisk = fs
		.readdirSync(dirPath)
		.filter(isImage)
		.sort(naturalCompare);
	const relPaths = new Set(filesOnDisk.map((f) => `assets/images/${listing.id}/${f}`));

	const existing = Array.isArray(listing.images) ? listing.images : [];
	// keep existing entries that still exist, preserving their order
	const kept = existing.filter((p) => relPaths.has(p));
	const keptSet = new Set(kept);
	// append newly found files not already listed
	const added = filesOnDisk.map((f) => `assets/images/${listing.id}/${f}`).filter((p) => !keptSet.has(p));

	const updated = [...kept, ...added];

	if (added.length) console.log(`Listing "${listing.id}": added ${added.length} new image(s)`);
	const removedCount = existing.length - kept.length;
	if (removedCount) console.log(`Listing "${listing.id}": removed ${removedCount} missing image(s)`);

	return updated;
}

function syncImages() {
	const raw = fs.readFileSync(listingsPath, 'utf8');
	const data = JSON.parse(raw);
	const listings = data.listings || [];

	const updates = listings.map(computeUpdatedImages);

	// Rewrite only the `"images": [ ... ]` blocks in place (in file order) so
	// unrelated formatting/content in listings.json is left untouched.
	let index = 0;
	const updated = raw.replace(/"images":\s*\[[\s\S]*?\]/g, (match) => {
		const items = updates[index];
		index += 1;
		if (!items) return match; // folder missing, leave block as-is
		const body = items.map((p) => `\t\t\t\t"${p}"`).join(',\n');
		return `"images": [\n${body}\n\t\t\t]`;
	});

	fs.writeFileSync(listingsPath, updated, 'utf8');
	console.log('Updated', listingsPath);
}

if (require.main === module) syncImages();

module.exports = syncImages;
