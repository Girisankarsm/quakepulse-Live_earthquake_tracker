import Parser from 'rss-parser';
import { NEWS_CACHE_TTL_SECONDS } from '../config.js';
import { newsCache, cached } from '../utils/cache.js';
import { fetchJson } from '../utils/http.js';

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'QuakePulse/3.0 (+https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

const FEEDS = [
  {
    id: 'usgs-news',
    source: 'USGS News',
    url: 'https://www.usgs.gov/news/news-releases/feed',
  },
  {
    id: 'gdacs',
    source: 'GDACS',
    url: 'https://www.gdacs.org/xml/rss.xml',
  },
  {
    id: 'google-eq',
    source: 'Google News',
    url: 'https://news.google.com/rss/search?q=earthquake+OR+seismic+OR+tremor&hl=en-US&gl=US&ceid=US:en',
  },
];

const QUAKE_KEYWORDS = [
  'earthquake',
  'seismic',
  'tremor',
  'aftershock',
  'magnitude',
  'quake',
  'tsunami',
  'fault',
  'tectonic',
];

export async function fetchNews({ region = '', limit = 24 } = {}) {
  const key = `news:${region || 'global'}:${limit}`;

  const { data, cached: fromCache } = await cached(
    newsCache,
    key,
    NEWS_CACHE_TTL_SECONDS,
    async () => collectNews(region, limit),
  );

  return { ...data, cached: fromCache, fetchedAt: new Date().toISOString() };
}

export function fetchGlobalNews(limit = 24) {
  return fetchNews({ region: '', limit });
}

export async function fetchRegionalNews(regions = [], limit = 24) {
  const list = Array.isArray(regions) ? regions.filter(Boolean).slice(0, 6) : [];
  if (!list.length) return fetchNews({ limit });

  const batches = await Promise.allSettled(
    list.map((region) => fetchNews({ region, limit: Math.ceil(limit / list.length) + 2 })),
  );

  const items = [];
  const errors = [];
  for (let i = 0; i < batches.length; i++) {
    const r = batches[i];
    if (r.status === 'fulfilled') items.push(...(r.value.items || []));
    else errors.push({ region: list[i], error: r.reason?.message || 'failed' });
  }

  const deduped = dedupeByTitle(items)
    .sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0))
    .slice(0, limit);

  return {
    count: deduped.length,
    regions: list,
    items: deduped,
    errors,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

export function matchNewsToEvents(items = [], events = []) {
  const regions = [
    ...new Set(events.map((e) => (e.region || '').toLowerCase()).filter(Boolean)),
  ];
  return items.map((item) => {
    const hay = `${item.title} ${item.summary || ''}`.toLowerCase();
    const matchedRegion =
      regions.find((r) => r && hay.includes(r.toLowerCase())) ||
      item.regionHint ||
      null;
    return { ...item, matchedRegion, related: Boolean(matchedRegion) };
  });
}

async function collectNews(region, limit) {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).map((item) => normalizeItem(item, feed.source));
    }),
  );

  let items = [];
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }

  // Optional region-focused Google feed
  if (region) {
    try {
      const q = encodeURIComponent(`${region} earthquake`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      const parsed = await parser.parseURL(url);
      items.push(
        ...(parsed.items || []).map((item) => normalizeItem(item, `News · ${region}`)),
      );
    } catch {
      // non-fatal
    }
  }

  items = items
    .filter((i) => i.title && i.link)
    .filter((i) => isSeismicRelevant(i.title + ' ' + (i.summary || '')))
    .sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0));

  items = dedupeByTitle(items).slice(0, limit);

  // Fallback: USGS significant event feed as headlines if RSS sparse
  if (items.length < 4) {
    try {
      const sig = await fetchJson(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
      );
      const extras = (sig.features || []).slice(0, 8).map((f) => ({
        id: f.id,
        title: `M${f.properties?.mag} — ${f.properties?.place}`,
        link: f.properties?.url || '',
        source: 'USGS Significant',
        published: f.properties?.time
          ? new Date(f.properties.time).toISOString()
          : null,
        publishedMs: f.properties?.time || 0,
        summary: 'Significant earthquake from USGS feed',
        regionHint: extractHint(f.properties?.place || ''),
      }));
      items = dedupeByTitle([...items, ...extras]).slice(0, limit);
    } catch {
      // ignore
    }
  }

  return {
    count: items.length,
    region: region || null,
    items,
  };
}

function normalizeItem(item, source) {
  const published = item.isoDate || item.pubDate || null;
  const publishedMs = published ? Date.parse(published) || 0 : 0;
  return {
    id: item.guid || item.link || `${source}-${item.title}`,
    title: cleanText(item.title),
    link: item.link || '',
    source,
    published: publishedMs ? new Date(publishedMs).toISOString() : null,
    publishedMs,
    summary: cleanText(item.contentSnippet || item.content || item.summary || '').slice(
      0,
      280,
    ),
    regionHint: null,
  };
}

function isSeismicRelevant(text) {
  const t = text.toLowerCase();
  // USGS news feed is broad — keep only quake-related; GDACS/Google already scoped
  return QUAKE_KEYWORDS.some((k) => t.includes(k)) || t.includes('usgs');
}

function dedupeByTitle(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function cleanText(s = '') {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHint(place) {
  const parts = place.split(',').map((p) => p.trim());
  return parts[parts.length - 1] || null;
}
