#!/usr/bin/env node

/**
 * Kiwix Catalog Scraper
 * Crawls https://download.kiwix.org/zim/ and produces kiwix/catalog-cache.json
 * Used by kiwix.html to show the "Available Content" listing.
 */

const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://download.kiwix.org/zim/';
const CACHE_FILE = path.join(__dirname, '../../kiwix/catalog-cache.json');
const REQUEST_DELAY_MS = 250;
const RETRY_LIMIT = 3;

const catalog = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureFetchAvailable() {
    if (typeof fetch === 'function') {
        return fetch;
    }
    console.error('[Kiwix Scraper] This script requires Node 18+ with global fetch support.');
    process.exit(1);
}

const fetchFn = ensureFetchAvailable();

async function fetchText(url, attempt = 1) {
    try {
        const response = await fetchFn(url, {
            headers: {
                'User-Agent': 'SPS-Kiwix-Scraper/1.0 (+https://github.com/technetnew/SPS)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.text();
    } catch (error) {
        if (attempt < RETRY_LIMIT) {
            console.warn(`[Kiwix Scraper] Fetch failed for ${url} (attempt ${attempt}): ${error.message}. Retrying...`);
            await sleep(500 * attempt);
            return fetchText(url, attempt + 1);
        }
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
}

function parseSizeToBytes(sizeStr = '') {
    const normalized = sizeStr.trim().toUpperCase();
    const match = normalized.match(/^([\d.]+)\s*([KMGT])?B?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || '';

    const multipliers = {
        'K': 1024,
        'M': 1024 ** 2,
        'G': 1024 ** 3,
        'T': 1024 ** 4
    };

    return Math.round(value * (multipliers[unit] || 1));
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const gb = bytes / Math.pow(1024, 3);
    if (gb >= 1) {
        const decimals = gb >= 10 ? 1 : 2;
        return `${gb.toFixed(decimals)} GB`;
    }
    const mb = bytes / Math.pow(1024, 2);
    const decimals = mb >= 10 ? 1 : 2;
    return `${mb.toFixed(decimals)} MB`;
}

function buildEntry({ filename, category, sizeStr, modified, baseUrl }) {
    const sizeBytes = parseSizeToBytes(sizeStr);
    const displaySize = formatBytes(sizeBytes);
    const safeFilename = filename.trim();

    const parts = safeFilename.replace('.zim', '').split('_');
    const project = parts[0] || 'unknown';
    const language = parts[1] || 'eng';

    let isoDate = new Date().toISOString();
    if (modified) {
        const dateCandidate = new Date(modified.replace(/&nbsp;/gi, ' ').trim());
        if (!isNaN(dateCandidate.getTime())) {
            isoDate = dateCandidate.toISOString();
        }
    }

    return {
        name: safeFilename.replace('.zim', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `${project} content in ${language}`,
        size: displaySize,
        sizeBytes,
        url: `${baseUrl}${safeFilename}`,
        category,
        language,
        filename: safeFilename,
        lastModified: isoDate,
        date: isoDate
    };
}

async function discoverCategories() {
    const html = await fetchText(BASE_URL);
    const matches = [...html.matchAll(/<a href="([^"]+\/)">/gi)];
    const categories = matches
        .map(match => match[1].replace(/\/$/, ''))
        .filter(Boolean)
        .filter(name => name !== '..' && !name.toLowerCase().includes('parent'));

    const unique = [...new Set(categories)];
    if (!unique.length) {
        throw new Error('No categories discovered on the Kiwix mirror');
    }

    console.log(`[Kiwix Scraper] Found ${unique.length} categories`);
    return unique;
}

function parseRowsFromHtml(html) {
    const sanitized = html.replace(/&nbsp;/gi, ' ').replace(/\r/g, '');
    const rows = [];

    // Primary pattern: Apache directory listing table rows
    const tableRowRegex = /<tr[^>]*>.*?<\/tr>/gis;
    let match;
    while ((match = tableRowRegex.exec(sanitized)) !== null) {
        if (!match[0].includes('.zim')) continue;
        rows.push(match[0]);
    }

    // Fallback: preformatted rows
    if (!rows.length) {
        const lines = sanitized.split('\n').filter(line => line.includes('.zim'));
        rows.push(...lines);
    }

    return rows;
}

function extractEntryFromRow(row, category, baseUrl) {
    const linkMatch = row.match(/<a href="([^"]+\.zim)">([^<]+)<\/a>/i);
    if (!linkMatch) return null;

    const rawFilename = decodeURIComponent(linkMatch[1]);
    const filename = path.basename(rawFilename);

    const dateMatch = row.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    const sizeMatch = row.match(/>([\d.]+\s*[KMGT])\s*</i) || row.match(/([\d.]+\s*[KMGT])\s*$/i);

    const modified = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : null;
    const sizeStr = sizeMatch ? sizeMatch[1] : '0';

    return buildEntry({ filename, category, sizeStr, modified, baseUrl });
}

async function scrapeCategory(category) {
    const url = `${BASE_URL}${category}/`;
    try {
        const html = await fetchText(url);
        const rows = parseRowsFromHtml(html);
        let added = 0;

        for (const row of rows) {
            const entry = extractEntryFromRow(row, category, url);
            if (!entry) continue;
            catalog.push(entry);
            added++;
        }

        return added;
    } catch (error) {
        console.error(`[Kiwix Scraper] Error scanning ${category}: ${error.message}`);
        return 0;
    }
}

async function main() {
    console.log('[Kiwix Scraper] Starting catalog scan...');
    console.log(`[Kiwix Scraper] Target: ${BASE_URL}`);

    try {
        console.log('[Kiwix Scraper] Step 1: Discovering categories...');
        const categories = await discoverCategories();

        console.log(`[Kiwix Scraper] Step 2: Crawling ${categories.length} categories...`);
        for (const category of categories) {
            console.log(`[Kiwix Scraper] → ${category}`);
            const added = await scrapeCategory(category);
            console.log(`[Kiwix Scraper]    Added ${added} files (running total: ${catalog.length})`);
            await sleep(REQUEST_DELAY_MS);
        }

        if (!catalog.length) {
            throw new Error('Catalog scan finished without discovering any ZIM files.');
        }

        console.log('[Kiwix Scraper] Step 3: Writing cache...');
        catalog.sort((a, b) => a.sizeBytes - b.sizeBytes);

        const tmpFile = `${CACHE_FILE}.tmp`;
        await fs.writeFile(tmpFile, JSON.stringify(catalog, null, 2));
        await fs.rename(tmpFile, CACHE_FILE);

        console.log(`[Kiwix Scraper] ✓ Scan complete! Found ${catalog.length} ZIM files.`);
        console.log(`[Kiwix Scraper] Cache saved to: ${CACHE_FILE}`);
        process.exit(0);
    } catch (error) {
        console.error('[Kiwix Scraper] Fatal error:', error.message);
        process.exit(1);
    }
}

main();
