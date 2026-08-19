#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const listingsPath = path.join(__dirname, '..', 'assets', 'listings.json');
const outPath = path.join(__dirname, '..', 'sitemap.xml');

function loadListings() {
	const raw = fs.readFileSync(listingsPath, 'utf8');
	return JSON.parse(raw).listings || [];
}

function lastModFor(listing) {
	if (!listing.priceHistory || !listing.priceHistory.length) return new Date().toISOString().slice(0, 10);
	// use most recent date in priceHistory if present
	const dates = listing.priceHistory
		.map((p) => p.date)
		.filter(Boolean)
		.sort()
		.reverse();
	return dates.length ? dates[0] : new Date().toISOString().slice(0, 10);
}

function generate() {
	const listings = loadListings();
	const base = 'https://tvv1001.github.io/homes-for-sale';
	const urls = [];

	// root and gallery
	urls.push({ loc: `${base}/`, lastmod: new Date().toISOString().slice(0, 10) });
	urls.push({ loc: `${base}/gallery.html`, lastmod: new Date().toISOString().slice(0, 10) });

	listings.forEach((l) => {
		urls.push({ loc: `${base}/listing-${l.id}.html`, lastmod: lastModFor(l) });
	});

	const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
	urls.forEach((u) => {
		xml.push('  <url>');
		xml.push(`    <loc>${u.loc}</loc>`);
		xml.push(`    <lastmod>${u.lastmod}</lastmod>`);
		xml.push('  </url>');
	});
	xml.push('</urlset>');

	fs.writeFileSync(outPath, xml.join('\n') + '\n', 'utf8');
	console.log('Wrote', outPath);
}

if (require.main === module) generate();

module.exports = generate;
