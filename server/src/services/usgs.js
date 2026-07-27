import { USGS_FEEDS, CACHE_TTL_SECONDS } from '../config.js';
import { fetchJson, FetchError } from '../utils/http.js';
import { feedCache, cached } from '../utils/cache.js';
import { parseFeatures, enrichEvents } from './parser.js';
import { applyFilters } from './analytics.js';

export { parseFeatures, enrichEvents } from './parser.js';
export { sampleForDisplay } from './analytics.js';

/** Alias used by legacy api routes — maps place → placeQuery. */
export function filterEvents(events, filters = {}) {
  return applyFilters(events, {
    minMagnitude: filters.minMagnitude,
    maxDepth: filters.maxDepth,
    placeQuery: filters.place || filters.placeQuery || '',
    types: filters.types,
  });
}

export function resolveFeed(period = 'day') {
  const feed = USGS_FEEDS[period];
  if (!feed) {
    const err = new Error(`Unknown feed period: ${period}`);
    err.status = 400;
    throw err;
  }
  return { period, ...feed };
}

export async function fetchEarthquakes(period = 'day') {
  const feed = resolveFeed(period);
  const key = `usgs:${period}`;

  const result = await cached(feedCache, key, CACHE_TTL_SECONDS, async () => {
    const payload = await fetchJson(feed.url);
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.features)) {
      throw new FetchError('USGS response missing features array');
    }
    const events = enrichEvents(parseFeatures(payload.features)).sort(
      (a, b) => b.timeMs - a.timeMs,
    );
    return {
      period,
      label: feed.label,
      generated: payload.metadata?.generated
        ? new Date(payload.metadata.generated).toISOString()
        : new Date().toISOString(),
      count: events.length,
      events,
    };
  });

  return {
    ...result.data,
    cached: result.cached,
    stale: Boolean(result.stale),
    warning: result.warning || null,
    fetchedAt: new Date().toISOString(),
  };
}
