import NodeCache from 'node-cache';
import { CACHE_TTL_SECONDS, NEWS_CACHE_TTL_SECONDS } from '../config.js';

export const feedCache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: 30,
  useClones: false,
});

export const newsCache = new NodeCache({
  stdTTL: NEWS_CACHE_TTL_SECONDS,
  checkperiod: 60,
  useClones: false,
});

export const mlCache = new NodeCache({
  stdTTL: 120,
  checkperiod: 60,
  useClones: false,
});

/** Keeps last-good payloads after TTL expiry so feeds can degrade gracefully. */
const staleStore = new Map();

export async function cached(cache, key, ttl, loader) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    return { data: hit, cached: true, stale: false };
  }

  try {
    const data = await loader();
    cache.set(key, data, ttl);
    staleStore.set(key, data);
    return { data, cached: false, stale: false };
  } catch (err) {
    const stale = staleStore.get(key);
    if (stale) {
      return {
        data: stale,
        cached: true,
        stale: true,
        warning: err.message || 'Upstream fetch failed; serving stale cache',
      };
    }
    throw err;
  }
}
