/**
 * Multi-source seismic dataset download & merge.
 * Chunked USGS FDSN + EMSC for long windows; USGS live feeds; significant events.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_SOURCES, DATASET_DIR } from '../config.js';
import { fetchJson, FetchError } from '../utils/http.js';
import { parseFeatures, enrichEvents } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, '../../data');
const CHUNK_DAYS = 10;

function dataDir() {
  return process.env.DATASET_DIR || DATASET_DIR || DEFAULT_DIR;
}

/**
 * Download and merge major free earthquake catalogs for training.
 * @param {{ days?: number, minMagnitude?: number, persist?: boolean }} opts
 */
export async function downloadTrainingDataset(opts = {}) {
  const days = Math.min(Math.max(opts.days ?? 90, 7), 120);
  const minMagnitude = opts.minMagnitude ?? 2.5;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  console.log(`[datasets] window ${days}d · minM ${minMagnitude} · chunk ${CHUNK_DAYS}d`);

  const jobs = [
    { id: 'usgs-fdsn', run: () => fetchUsgsFdsnChunked(start, end, minMagnitude) },
    { id: 'usgs-feed-month', run: () => fetchUsgsGeoJson(DATA_SOURCES.usgsFeedMonth, minMagnitude, 'usgs-feed') },
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
    { id: 'emsc', run: () => fetchEmscChunked(start, end, Math.max(minMagnitude, 2.5)) },
    { id: 'scrape-usgs', run: () => scrapeUsgsSignificant() },
  ];

  const sources = {};
  const all = [];

  // Sequential for FDSN rate limits; parallel within is fine via Promise.allSettled
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
  try {
    const [eventsRaw, metaRaw] = await Promise.all([
      fs.readFile(path.join(dir, 'training_events.json'), 'utf8'),
      fs.readFile(path.join(dir, 'training_meta.json'), 'utf8'),
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
      const batch = await fetchUsgsFdsn(chunk.start, chunk.end, minMagnitude);
      out.push(...batch);
      await sleep(200);
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
      const batch = await fetchEmsc(chunk.start, chunk.end, minMagnitude);
      out.push(...batch);
      await sleep(250);
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

function clean(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { FetchError };
