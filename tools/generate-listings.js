#!/usr/bin/env node
// Simple Node script to generate assets/listings.json by scanning assets/images/*
// Usage: node tools/generate-listings.js > assets/listings.json

const fs = require('fs');
const path = require('path');

const imagesRoot = path.join(__dirname, '..', 'assets', 'images');

function isImage(name) {
	return /\.(jpe?g|png|webp|gif|heic)$/i.test(name);
}

function scan() {
	const folders = fs.readdirSync(imagesRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
	const listings = [];
	folders.forEach((dir) => {
		const id = dir.name;
		const dirPath = path.join(imagesRoot, id);
		const files = fs.readdirSync(dirPath).filter(isImage);
		// choose a title from folder, simple humanize
		const title = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		listings.push({
			id,
			title,
			sub: '',
			address: '',
			price: '',
			beds: 0,
			baths: 0,
			sqft: 0,
			year: null,
			agent: { name: '', email: '' },
			description: '',
			priceHistory: [],
			images: files.map((f) => `assets/images/${id}/${f}`),
		});
	});
	return { listings };
}

if (require.main === module) {
	const out = JSON.stringify(scan(), null, 2);
	fs.writeFileSync(path.join(__dirname, '..', 'assets', 'listings.json'), out);
	console.log('Wrote assets/listings.json');
}

module.exports = scan;
