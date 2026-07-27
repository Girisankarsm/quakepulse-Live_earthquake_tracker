/**
 * Multi-source seismic dataset download & merge.
 * Free catalogs: USGS FDSN, USGS GeoJSON feeds, EMSC, IRIS FDSN.
 * Scraping: USGS significant events HTML (fallback signal).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_SOURCES, DATASET_DIR } from '../config.js';
import { fetchJson, FetchError } from '../utils/http.js';
import { parseFeatures, enrichEvents } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, '../../data');

function dataDir() {
  return process.env.DATASET_DIR || DATASET_DIR || DEFAULT_DIR;
}

/**
 * Download and merge major free earthquake catalogs for training.
 * @param {{ days?: number, minMagnitude?: number, persist?: boolean }} opts
 */
export async function downloadTrainingDataset(opts = {}) {
  const days = opts.days ?? 30;
  const minMagnitude = opts.minMagnitude ?? 2.5;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  const jobs = [
    { id: 'usgs-fdsn', run: () => fetchUsgsFdsn(start, end, minMagnitude) },
    { id: 'usgs-feed', run: () => fetchUsgsFeedMonth(minMagnitude) },
    { id: 'emsc', run: () => fetchEmsc(start, end, minMagnitude) },
    { id: 'iris', run: () => fetchIris(start, end, Math.max(minMagnitude, 4)) },
    { id: 'scrape-usgs', run: () => scrapeUsgsSignificant() },
  ];

  const sources = {};
  const all = [];

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const events = await job.run();
      return { id: job.id, events };
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      sources[r.value.id] = {
        ok: true,
        count: r.value.events.length,
      };
      all.push(...r.value.events);
    } else {
      const id = jobs[results.indexOf(r)]?.id || 'unknown';
      sources[id] = {
        ok: false,
        error: r.reason?.message || String(r.reason),
      };
    }
  }

  const merged = dedupeEvents(all).filter((e) => e.magnitude >= minMagnitude);
  const events = enrichEvents(merged).sort((a, b) => a.timeMs - b.timeMs);

  const meta = {
    downloadedAt: new Date().toISOString(),
    window: { start: start.toISOString(), end: end.toISOString(), days },
    minMagnitude,
    sources,
    totalRaw: all.length,
    totalMerged: events.length,
  };

  if (opts.persist !== false) {
    await persistDataset(events, meta);
  }

  return { events, meta };
}

export async function loadPersistedDataset() {
  const dir = dataDir();
  const eventsPath = path.join(dir, 'training_events.json');
  const metaPath = path.join(dir, 'training_meta.json');
  try {
    const [eventsRaw, metaRaw] = await Promise.all([
      fs.readFile(eventsPath, 'utf8'),
      fs.readFile(metaPath, 'utf8'),
    ]);
    return {
      events: enrichEvents(JSON.parse(eventsRaw)),
      meta: JSON.parse(metaRaw),
      fromDisk: true,
    };
  } catch {
    return null;
  }
}

async function persistDataset(events, meta) {
  const dir = dataDir();
  await fs.mkdir(dir, { recursive: true });
  // Persist lean records for disk size
  const lean = events.map((e) => ({
    id: e.id,
    magnitude: e.magnitude,
    depth: e.depth,
    place: e.place,
    time: e.time,
    timeMs: e.timeMs,
    latitude: e.latitude,
    longitude: e.longitude,
    status: e.status,
    type: e.type,
    url: e.url,
    felt: e.felt,
    tsunami: e.tsunami,
    sig: e.sig,
    alert: e.alert,
    source: e.source || null,
  }));
  await fs.writeFile(path.join(dir, 'training_events.json'), JSON.stringify(lean));
  await fs.writeFile(path.join(dir, 'training_meta.json'), JSON.stringify(meta, null, 2));
}

/** USGS FDSN Event Web Service — primary global catalog. */
async function fetchUsgsFdsn(start, end, minMagnitude) {
  const url = new URL(DATA_SOURCES.usgsFdsn);
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', start.toISOString().slice(0, 19));
  url.searchParams.set('endtime', end.toISOString().slice(0, 19));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('orderby', 'time-asc');
  url.searchParams.set('limit', '20000');

  const payload = await fetchJson(url.toString(), { timeout: 60_000 });
  return tagSource(parseFeatures(payload.features || []), 'usgs-fdsn');
}

/** USGS all_month GeoJSON feed — high freshness. */
async function fetchUsgsFeedMonth(minMagnitude) {
  const payload = await fetchJson(DATA_SOURCES.usgsFeedMonth, { timeout: 45_000 });
  return tagSource(
    parseFeatures(payload.features || []).filter((e) => e.magnitude >= minMagnitude),
    'usgs-feed',
  );
}

/** EMSC / Seismic Portal — European-Mediterranean + global coverage. */
async function fetchEmsc(start, end, minMagnitude) {
  // Prefer text catalog (most reliable on seismicportal)
  const url = new URL(DATA_SOURCES.emscFdsn);
  url.searchParams.set('format', 'text');
  url.searchParams.set('starttime', start.toISOString().slice(0, 19));
  url.searchParams.set('endtime', end.toISOString().slice(0, 19));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('limit', '10000');
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('nodata', '204');

  const text = await fetchJson(url.toString(), { timeout: 60_000 });
  if (typeof text === 'string' && text.trim()) {
    return tagSource(parseIrisText(text), 'emsc');
  }

  // Fallback GeoJSON
  const geoUrl = new URL(DATA_SOURCES.emscFdsn);
  geoUrl.searchParams.set('format', 'json');
  geoUrl.searchParams.set('starttime', start.toISOString().slice(0, 19));
  geoUrl.searchParams.set('endtime', end.toISOString().slice(0, 19));
  geoUrl.searchParams.set('minmagnitude', String(minMagnitude));
  geoUrl.searchParams.set('limit', '10000');

  const payload = await fetchJson(geoUrl.toString(), { timeout: 60_000 });
  if (payload?.type === 'FeatureCollection' || Array.isArray(payload?.features)) {
    return tagSource(parseFeatures(payload.features || []), 'emsc');
  }
  if (Array.isArray(payload)) {
    return tagSource(payload.map(normalizeEmscRow).filter(Boolean), 'emsc');
  }
  const rows = payload?.events || payload?.data || [];
  if (Array.isArray(rows)) {
    return tagSource(rows.map(normalizeEmscRow).filter(Boolean), 'emsc');
  }
  return [];
}

/** IRIS FDSN event service — research-grade global catalog. */
async function fetchIris(start, end, minMagnitude) {
  const url = new URL(DATA_SOURCES.irisFdsn);
  url.searchParams.set('starttime', start.toISOString().slice(0, 19));
  url.searchParams.set('endtime', end.toISOString().slice(0, 19));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('format', 'text');
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('nodata', '204');

  const text = await fetchJson(url.toString(), { timeout: 60_000 });
  if (typeof text !== 'string' || !text.trim()) return [];
  return tagSource(parseIrisText(text), 'iris');
}

/**
 * Lightweight scrape of USGS significant earthquakes list page.
 * Used as an auxiliary significant-event signal when APIs are sparse.
 */
async function scrapeUsgsSignificant() {
  const html = await fetchJson(DATA_SOURCES.usgsSignificantHtml, { timeout: 30_000 });
  if (typeof html !== 'string') return [];

  const events = [];
  // Match USGS list rows / mag-place patterns in HTML
  const magPlace = /M\s*([0-9]+\.[0-9])\s*[-–—]\s*([^<\n]{5,120})/gi;
  let m;
  while ((m = magPlace.exec(html)) !== null) {
    const magnitude = Number(m[1]);
    const place = clean(m[2]);
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

  // Prefer structured JSON embedded in page if present
  const jsonLd = html.match(
    /https:\/\/earthquake\.usgs\.gov\/earthquakes\/eventpage\/[a-z0-9]+/gi,
  );
  if (jsonLd?.length) {
    for (const link of [...new Set(jsonLd)].slice(0, 40)) {
      const id = link.split('/').pop();
      if (!events.find((e) => e.id === id)) {
        events.push({
          id,
          magnitude: 0,
          depth: 0,
          place: 'USGS significant event',
          time: new Date().toISOString(),
          timeMs: Date.now(),
          latitude: 0,
          longitude: 0,
          status: 'scraped',
          type: 'earthquake',
          url: link,
          felt: null,
          tsunami: 0,
          sig: null,
          alert: null,
        });
      }
    }
  }

  return events.filter((e) => e.magnitude > 0);
}

function parseIrisText(text) {
  const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
  const out = [];
  for (const line of lines) {
    // EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName
    const parts = line.split('|');
    if (parts.length < 13) continue;
    const timeMs = Date.parse(parts[1]);
    const lat = Number(parts[2]);
    const lon = Number(parts[3]);
    const depth = Number(parts[4]);
    const mag = Number(parts[10]);
    if (!Number.isFinite(timeMs) || !Number.isFinite(mag)) continue;
    out.push({
      id: `iris-${parts[0]}`,
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

function normalizeEmscRow(row) {
  if (!row) return null;
  if (row.geometry && row.properties) {
    const [parsed] = parseFeatures([row]);
    return parsed || null;
  }
  const timeMs = Date.parse(row.time || row.origin_time || row.date || '');
  const mag = Number(row.mag ?? row.magnitude ?? row.mag_value);
  if (!Number.isFinite(timeMs) || !Number.isFinite(mag)) return null;
  return {
    id: String(row.id || row.unid || `emsc-${timeMs}`),
    magnitude: mag,
    depth: Number(row.depth ?? row.depth_km ?? 0) || 0,
    place: row.flynn_region || row.region || row.place || 'Unknown',
    time: new Date(timeMs).toISOString(),
    timeMs,
    latitude: Number(row.lat ?? row.latitude ?? 0) || 0,
    longitude: Number(row.lon ?? row.longitude ?? 0) || 0,
    status: row.status || 'automatic',
    type: 'earthquake',
    url: row.url || '',
    felt: null,
    tsunami: 0,
    sig: null,
    alert: null,
  };
}

function tagSource(events, source) {
  return events.map((e) => ({ ...e, source }));
}

function dedupeEvents(events) {
  const byId = new Map();
  const byKey = new Map();

  for (const e of events) {
    if (e.id && !String(e.id).startsWith('scrape-')) {
      const prev = byId.get(e.id);
      if (!prev || (e.source === 'usgs-fdsn' && prev.source !== 'usgs-fdsn')) {
        byId.set(e.id, e);
      }
      continue;
    }
    // Spatial-temporal key for scraped / anonymous
    const key = [
      e.timeMs ? Math.round(e.timeMs / 60_000) : 0,
      e.magnitude?.toFixed?.(1) || e.magnitude,
      e.latitude?.toFixed?.(1),
      e.longitude?.toFixed?.(1),
    ].join('|');
    if (!byKey.has(key)) byKey.set(key, e);
  }

  const merged = [...byId.values(), ...byKey.values()];
  // Drop zero-coord scrape stubs that add no training value
  return merged.filter(
    (e) => !(e.source === 'scrape-usgs' && e.latitude === 0 && e.longitude === 0 && e.magnitude === 0),
  );
}

function clean(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export { FetchError };
