/**
 * Multi-source seismic catalog download, compact storage, and stats.
 *
 * Storage format (v2):
 *   catalog.ndjson.gz  — one compact row per event (streamable, ~3–5× smaller)
 *   catalog.meta.json  — schema, window, sources, depth/mag histograms
 *
 * Legacy training_events.json still readable for migration.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { DATA_SOURCES, DATASET_DIR } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { parseFeatures, enrichEvents } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, '../../data');
const CHUNK_DAYS = 7;
const SCHEMA_VERSION = 2;

/** Compact row: [id, mag, depth, lat, lon, timeMs, place, source] */
const COLS = ['id', 'magnitude', 'depth', 'latitude', 'longitude', 'timeMs', 'place', 'source'];

function dataDir() {
  return process.env.DATASET_DIR || DATASET_DIR || DEFAULT_DIR;
}

function catalogPaths() {
  const dir = dataDir();
  return {
    dir,
    ndjsonGz: path.join(dir, 'catalog.ndjson.gz'),
    meta: path.join(dir, 'catalog.meta.json'),
    legacyJson: path.join(dir, 'training_events.json'),
    legacyMeta: path.join(dir, 'training_meta.json'),
  };
}

/**
 * Download and merge major free earthquake catalogs.
 * @param {{ days?: number, minMagnitude?: number, persist?: boolean }} opts
 */
export async function downloadTrainingDataset(opts = {}) {
  const days = Math.min(Math.max(opts.days ?? 120, 7), 180);
  const minMagnitude = opts.minMagnitude ?? 2.0;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  console.log(`[datasets] window ${days}d · minM ${minMagnitude} · chunk ${CHUNK_DAYS}d · schema v${SCHEMA_VERSION}`);

  const jobs = [
    { id: 'usgs-fdsn', run: () => fetchUsgsFdsnChunked(start, end, minMagnitude) },
    {
      id: 'usgs-fdsn-m45',
      run: () => fetchUsgsFdsnChunked(start, end, Math.max(minMagnitude, 4.5)),
    },
    {
      id: 'usgs-feed-month',
      run: () => fetchUsgsGeoJson(DATA_SOURCES.usgsFeedMonth, minMagnitude, 'usgs-feed'),
    },
    {
      id: 'usgs-m25-month',
      run: () =>
        fetchUsgsGeoJson(DATA_SOURCES.usgsM25Month, Math.max(minMagnitude, 2.5), 'usgs-m25'),
    },
    {
      id: 'usgs-m45-month',
      run: () =>
        fetchUsgsGeoJson(DATA_SOURCES.usgsM45Month, Math.max(minMagnitude, 4.5), 'usgs-m45'),
    },
    { id: 'usgs-significant', run: () => fetchUsgsSignificantFeed() },
    { id: 'emsc', run: () => fetchEmscChunked(start, end, Math.max(minMagnitude, 2.0)) },
    { id: 'scrape-usgs', run: () => scrapeUsgsSignificant() },
  ];

  const sources = {};
  const all = [];

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const events = await job.run();
      console.log(`[datasets] ${job.id}: ${events.length} events`);
      return { id: job.id, events };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const id = jobs[i].id;
    if (r.status === 'fulfilled') {
      sources[id] = { ok: true, count: r.value.events.length };
      all.push(...r.value.events);
    } else {
      sources[id] = { ok: false, error: r.reason?.message || String(r.reason) };
      console.warn(`[datasets] ${id} failed:`, sources[id].error);
    }
  }

  // Merge with existing catalog for deeper history
  const prior = await loadPersistedDataset().catch(() => null);
  if (prior?.events?.length) {
    all.push(...prior.events);
    sources['prior-catalog'] = { ok: true, count: prior.events.length };
  }

  const merged = dedupeEvents(all).filter((e) => e.magnitude >= minMagnitude);
  const events = enrichEvents(merged).sort((a, b) => a.timeMs - b.timeMs);

  const meta = buildCatalogMeta(events, {
    downloadedAt: new Date().toISOString(),
    window: { start: start.toISOString(), end: end.toISOString(), days },
    minMagnitude,
    sources,
    totalRaw: all.length,
    totalMerged: events.length,
  });

  if (opts.persist !== false) {
    await persistDataset(events, meta);
  }

  return { events, meta };
}

export async function loadPersistedDataset() {
  const paths = catalogPaths();

  // Prefer compact NDJSON.gz
  if (fs.existsSync(paths.ndjsonGz) && fs.existsSync(paths.meta)) {
    const meta = JSON.parse(await fsp.readFile(paths.meta, 'utf8'));
    const events = await readNdjsonGz(paths.ndjsonGz);
    return { events: enrichEvents(events), meta, fromDisk: true, format: 'ndjson.gz' };
  }

  // Legacy JSON array
  try {
    const [eventsRaw, metaRaw] = await Promise.all([
      fsp.readFile(paths.legacyJson, 'utf8'),
      fsp.readFile(paths.legacyMeta, 'utf8'),
    ]);
    const events = enrichEvents(JSON.parse(eventsRaw));
    const meta = buildCatalogMeta(events, JSON.parse(metaRaw));
    // Migrate quietly
    await persistDataset(events, meta).catch(() => {});
    return { events, meta, fromDisk: true, format: 'legacy-json' };
  } catch {
    return null;
  }
}

export async function getDatasetStats() {
  const loaded = await loadPersistedDataset();
  if (!loaded) {
    return { loaded: false, format: null, count: 0 };
  }
  const paths = catalogPaths();
  let bytes = 0;
  try {
    const st = await fsp.stat(paths.ndjsonGz);
    bytes = st.size;
  } catch {
    try {
      const st = await fsp.stat(paths.legacyJson);
      bytes = st.size;
    } catch {
      bytes = 0;
    }
  }

  const sample = loaded.events
    .slice(-8)
    .reverse()
    .map((e) => ({
      id: e.id,
      magnitude: e.magnitude,
      depth: e.depth,
      place: e.place,
      time: e.time,
      latitude: e.latitude,
      longitude: e.longitude,
      source: e.source || null,
      region: e.region,
    }));

  return {
    loaded: true,
    format: loaded.format || 'ndjson.gz',
    schemaVersion: loaded.meta?.schemaVersion || SCHEMA_VERSION,
    count: loaded.events.length,
    bytes,
    bytesLabel: formatBytes(bytes),
    downloadedAt: loaded.meta?.downloadedAt || null,
    window: loaded.meta?.window || null,
    minMagnitude: loaded.meta?.minMagnitude ?? null,
    sources: loaded.meta?.sources || {},
    depth: loaded.meta?.depth || null,
    magnitude: loaded.meta?.magnitude || null,
    geography: loaded.meta?.geography || null,
    sample,
  };
}

export function buildCatalogMeta(events, base = {}) {
  const depthBins = { '0-10': 0, '10-70': 0, '70-300': 0, '300+': 0 };
  const magBins = { '0-2': 0, '2-3': 0, '3-4': 0, '4-5': 0, '5-6': 0, '6+': 0 };
  const bySource = {};
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  let energy = 0;

  for (const e of events) {
    const d = e.depth ?? 0;
    if (d < 10) depthBins['0-10'] += 1;
    else if (d < 70) depthBins['10-70'] += 1;
    else if (d < 300) depthBins['70-300'] += 1;
    else depthBins['300+'] += 1;

    const m = e.magnitude ?? 0;
    if (m < 2) magBins['0-2'] += 1;
    else if (m < 3) magBins['2-3'] += 1;
    else if (m < 4) magBins['3-4'] += 1;
    else if (m < 5) magBins['4-5'] += 1;
    else if (m < 6) magBins['5-6'] += 1;
    else magBins['6+'] += 1;

    const src = e.source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;

    if (Number.isFinite(e.latitude)) {
      minLat = Math.min(minLat, e.latitude);
      maxLat = Math.max(maxLat, e.latitude);
    }
    if (Number.isFinite(e.longitude)) {
      minLon = Math.min(minLon, e.longitude);
      maxLon = Math.max(maxLon, e.longitude);
    }
    energy += e.energyJ || 10 ** (1.5 * Math.max(0, m) + 4.8);
  }

  const times = events.map((e) => e.timeMs).filter(Number.isFinite);
  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    columns: COLS,
    totalMerged: events.length,
    depth: {
      bins: depthBins,
      avgKm: events.length
        ? round(events.reduce((s, e) => s + (e.depth || 0), 0) / events.length, 1)
        : 0,
      medianKm: median(events.map((e) => e.depth || 0)),
      shallowPct: events.length
        ? round((events.filter((e) => (e.depth || 0) < 70).length / events.length) * 100, 1)
        : 0,
    },
    magnitude: {
      bins: magBins,
      avg: events.length
        ? round(events.reduce((s, e) => s + e.magnitude, 0) / events.length, 2)
        : 0,
      max: events.length ? round(Math.max(...events.map((e) => e.magnitude)), 1) : 0,
      m4Plus: events.filter((e) => e.magnitude >= 4).length,
      m5Plus: events.filter((e) => e.magnitude >= 5).length,
      m6Plus: events.filter((e) => e.magnitude >= 6).length,
    },
    geography: {
      lat: [round(minLat, 2), round(maxLat, 2)],
      lon: [round(minLon, 2), round(maxLon, 2)],
    },
    time: times.length
      ? {
          first: new Date(Math.min(...times)).toISOString(),
          last: new Date(Math.max(...times)).toISOString(),
        }
      : null,
    bySource,
    totalEnergyJ: energy,
  };
}

async function persistDataset(events, meta) {
  const paths = catalogPaths();
  await fsp.mkdir(paths.dir, { recursive: true });

  // Compact NDJSON.gz — one array row per line
  const tmp = `${paths.ndjsonGz}.tmp`;
  await pipeline(
    async function* () {
      for (const e of events) {
        const row = [
          e.id,
          round(e.magnitude, 3),
          round(e.depth ?? 0, 2),
          round(e.latitude, 4),
          round(e.longitude, 4),
          e.timeMs,
          e.place || '',
          e.source || '',
        ];
        yield `${JSON.stringify(row)}\n`;
      }
    },
    zlib.createGzip({ level: 6 }),
    createWriteStream(tmp),
  );
  await fsp.rename(tmp, paths.ndjsonGz);
  await fsp.writeFile(paths.meta, JSON.stringify(meta, null, 2));

  // Drop bulky legacy file if present (keep meta pointer)
  try {
    await fsp.unlink(paths.legacyJson);
  } catch {
    /* ok */
  }
}

async function readNdjsonGz(file) {
  const events = [];
  const rl = createInterface({
    input: createReadStream(file).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (Array.isArray(row)) {
      events.push({
        id: row[0],
        magnitude: row[1],
        depth: row[2],
        latitude: row[3],
        longitude: row[4],
        timeMs: row[5],
        time: new Date(row[5]).toISOString(),
        place: row[6] || 'Unknown',
        source: row[7] || null,
        status: 'catalog',
        type: 'earthquake',
        url: '',
        felt: null,
        tsunami: 0,
        sig: null,
        alert: null,
      });
    } else if (row && typeof row === 'object') {
      // object-shaped NDJSON fallback
      events.push({
        ...row,
        time: row.time || new Date(row.timeMs).toISOString(),
      });
    }
  }
  return events;
}

function* timeChunks(start, end, chunkDays) {
  let cursor = start.getTime();
  const endMs = end.getTime();
  const step = chunkDays * 86_400_000;
  while (cursor < endMs) {
    const chunkEnd = Math.min(cursor + step, endMs);
    yield { start: new Date(cursor), end: new Date(chunkEnd) };
    cursor = chunkEnd;
  }
}

async function fetchUsgsFdsnChunked(start, end, minMagnitude) {
  const out = [];
  for (const chunk of timeChunks(start, end, CHUNK_DAYS)) {
    try {
      out.push(...(await fetchUsgsFdsn(chunk.start, chunk.end, minMagnitude)));
      await sleep(150);
    } catch (err) {
      console.warn(`[usgs-fdsn] chunk fail ${chunk.start.toISOString()}:`, err.message);
    }
  }
  return out;
}

async function fetchUsgsFdsn(start, end, minMagnitude) {
  const url = new URL(DATA_SOURCES.usgsFdsn);
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', start.toISOString().slice(0, 19));
  url.searchParams.set('endtime', end.toISOString().slice(0, 19));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('orderby', 'time-asc');
  url.searchParams.set('limit', '20000');
  const payload = await fetchJson(url.toString(), { timeout: 90_000 });
  return tagSource(parseFeatures(payload.features || []), 'usgs-fdsn');
}

async function fetchUsgsGeoJson(url, minMagnitude, source) {
  const payload = await fetchJson(url, { timeout: 60_000 });
  return tagSource(
    parseFeatures(payload.features || []).filter((e) => e.magnitude >= minMagnitude),
    source,
  );
}

async function fetchUsgsSignificantFeed() {
  const payload = await fetchJson(DATA_SOURCES.usgsSignificantFeed, { timeout: 30_000 });
  return tagSource(parseFeatures(payload.features || []), 'usgs-significant');
}

async function fetchEmscChunked(start, end, minMagnitude) {
  const out = [];
  for (const chunk of timeChunks(start, end, CHUNK_DAYS)) {
    try {
      out.push(...(await fetchEmsc(chunk.start, chunk.end, minMagnitude)));
      await sleep(200);
    } catch (err) {
      console.warn(`[emsc] chunk fail ${chunk.start.toISOString()}:`, err.message);
    }
  }
  return out;
}

async function fetchEmsc(start, end, minMagnitude) {
  const url = new URL(DATA_SOURCES.emscFdsn);
  url.searchParams.set('format', 'text');
  url.searchParams.set('starttime', start.toISOString().slice(0, 19));
  url.searchParams.set('endtime', end.toISOString().slice(0, 19));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('limit', '20000');
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('nodata', '204');
  const text = await fetchJson(url.toString(), { timeout: 90_000 });
  if (typeof text === 'string' && text.trim()) {
    return tagSource(parseFdsnText(text, 'emsc'), 'emsc');
  }
  return [];
}

async function scrapeUsgsSignificant() {
  try {
    const html = await fetchJson(DATA_SOURCES.usgsSignificantHtml, { timeout: 25_000 });
    if (typeof html !== 'string') return [];
    const events = [];
    const magPlace = /M\s*([0-9]+\.[0-9])\s*[-–—]\s*([^<\n]{5,120})/gi;
    let m;
    while ((m = magPlace.exec(html)) !== null) {
      const magnitude = Number(m[1]);
      const place = String(m[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(magnitude) || !place) continue;
      events.push({
        id: `scrape-${magnitude}-${hash(place)}`,
        magnitude,
        depth: 10,
        place,
        time: new Date().toISOString(),
        timeMs: Date.now(),
        latitude: 0,
        longitude: 0,
        status: 'scraped',
        type: 'earthquake',
        url: DATA_SOURCES.usgsSignificantHtml,
        felt: null,
        tsunami: 0,
        sig: null,
        alert: null,
      });
    }
    return events.filter((e) => e.magnitude > 0);
  } catch {
    return [];
  }
}

function parseFdsnText(text, source = 'fdsn') {
  const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
  const out = [];
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 13) continue;
    const timeMs = Date.parse(parts[1]);
    const lat = Number(parts[2]);
    const lon = Number(parts[3]);
    const depth = Number(parts[4]);
    const mag = Number(parts[10]);
    if (!Number.isFinite(timeMs) || !Number.isFinite(mag)) continue;
    out.push({
      id: `${source}-${parts[0]}`,
      magnitude: mag,
      depth: Number.isFinite(depth) ? depth : 0,
      place: parts[12] || 'Unknown',
      time: new Date(timeMs).toISOString(),
      timeMs,
      latitude: Number.isFinite(lat) ? lat : 0,
      longitude: Number.isFinite(lon) ? lon : 0,
      status: 'reviewed',
      type: 'earthquake',
      url: '',
      felt: null,
      tsunami: 0,
      sig: null,
      alert: null,
    });
  }
  return out;
}

function tagSource(events, source) {
  return events.map((e) => ({ ...e, source }));
}

function dedupeEvents(events) {
  const byKey = new Map();
  const rank = (s) =>
    ({
      'usgs-fdsn': 6,
      'usgs-significant': 5,
      'usgs-m45': 4,
      'usgs-m25': 3,
      'usgs-feed': 3,
      emsc: 2,
      'scrape-usgs': 1,
    }[s] || 0);

  for (const e of events) {
    const key = [
      e.timeMs ? Math.round(e.timeMs / 120_000) : 0,
      Number(e.magnitude).toFixed(1),
      Number(e.latitude).toFixed(1),
      Number(e.longitude).toFixed(1),
    ].join('|');
    const prev = byKey.get(key);
    if (!prev || rank(e.source) > rank(prev.source)) byKey.set(key, e);
  }

  return [...byKey.values()].filter(
    (e) =>
      !(e.source === 'scrape-usgs' && e.latitude === 0 && e.longitude === 0 && e.magnitude === 0),
  );
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, 1);
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}
