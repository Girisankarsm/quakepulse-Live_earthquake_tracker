import { DEFAULT_ALERT_THRESHOLD, SIGNIFICANT_THRESHOLD, MAP_DISPLAY_LIMIT } from '../config.js';

export function applyFilters(events, {
  minMagnitude = 0,
  maxDepth = null,
  placeQuery = '',
  types = null,
} = {}) {
  const q = String(placeQuery || '').trim().toLowerCase();
  return events.filter((e) => {
    if (e.magnitude < minMagnitude) return false;
    if (maxDepth != null && e.depth > maxDepth) return false;
    if (q && !e.place.toLowerCase().includes(q)) return false;
    if (types && types.length && !types.includes(e.type)) return false;
    return true;
  });
}

export function computeKpis(events, significantThreshold = SIGNIFICANT_THRESHOLD) {
  if (!events.length) {
    return {
      totalEvents: 0,
      averageMagnitude: 0,
      medianDepthKm: 0,
      largestMagnitude: 0,
      largestPlace: '—',
      significantEvents: 0,
      totalEnergyJoules: 0,
      shallowEventsPct: 0,
      deepEventsPct: 0,
      feltEvents: 0,
      tsunamiFlags: 0,
    };
  }

  const sortedByMag = [...events].sort((a, b) => b.magnitude - a.magnitude);
  const largest = sortedByMag[0];
  const depths = events.map((e) => e.depth).sort((a, b) => a - b);
  const mid = Math.floor(depths.length / 2);
  const medianDepth =
    depths.length % 2 === 0 ? (depths[mid - 1] + depths[mid]) / 2 : depths[mid];

  const avgMag = events.reduce((s, e) => s + e.magnitude, 0) / events.length;
  const energy = events.reduce((s, e) => s + e.energyJ, 0);
  const shallow = events.filter((e) => e.depth < 70).length;
  const deep = events.filter((e) => e.depth >= 300).length;

  return {
    totalEvents: events.length,
    averageMagnitude: round(avgMag, 2),
    medianDepthKm: round(medianDepth, 1),
    largestMagnitude: round(largest.magnitude, 1),
    largestPlace: largest.place,
    significantEvents: events.filter((e) => e.magnitude >= significantThreshold).length,
    totalEnergyJoules: energy,
    shallowEventsPct: round((shallow / events.length) * 100, 1),
    deepEventsPct: round((deep / events.length) * 100, 1),
    feltEvents: events.filter((e) => e.felt != null && e.felt > 0).length,
    tsunamiFlags: events.filter((e) => e.tsunami).length,
  };
}

export function getAlerts(events, threshold = DEFAULT_ALERT_THRESHOLD) {
  return events
    .filter((e) => e.magnitude >= threshold)
    .sort((a, b) => b.magnitude - a.magnitude || b.timeMs - a.timeMs);
}

export function formatEnergy(joules) {
  if (joules >= 1e18) return `${(joules / 1e18).toFixed(2)} EJ`;
  if (joules >= 1e15) return `${(joules / 1e15).toFixed(2)} PJ`;
  if (joules >= 1e12) return `${(joules / 1e12).toFixed(2)} TJ`;
  if (joules >= 1e9) return `${(joules / 1e9).toFixed(2)} GJ`;
  return `${Math.round(joules).toLocaleString()} J`;
}

export function sampleForDisplay(events, limit = MAP_DISPLAY_LIMIT) {
  if (events.length <= limit) {
    return { events, sampled: false };
  }

  const strong = events
    .filter((e) => e.magnitude >= 4)
    .sort((a, b) => b.magnitude - a.magnitude || b.timeMs - a.timeMs);
  const weak = events.filter((e) => e.magnitude < 4);

  // Always prefer strong events, but never exceed the display limit.
  const keepStrong = strong.slice(0, limit);
  const slots = Math.max(0, limit - keepStrong.length);
  const sampledWeak = deterministicSample(weak, slots);
  const combined = [...keepStrong, ...sampledWeak].sort((a, b) => a.timeMs - b.timeMs);
  return { events: combined, sampled: true };
}

/** Deterministic sample so map/chart views stay stable across refreshes. */
function deterministicSample(arr, n) {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.floor(i * step)]);
  }
  return out;
}

export function buildOverviewSeries(events) {
  const byHour = new Map();
  const magBins = { '0–2': 0, '2–4': 0, '4–6': 0, '6+': 0 };
  let cumulativeEnergy = 0;
  const energySeries = [];

  const sorted = [...events].sort((a, b) => a.timeMs - b.timeMs);
  for (const e of sorted) {
    const hour = e.time.slice(0, 13) + ':00:00.000Z';
    const bucket = byHour.get(hour) || { time: hour, count: 0, avgMag: 0, _sum: 0 };
    bucket.count += 1;
    bucket._sum += e.magnitude;
    bucket.avgMag = round(bucket._sum / bucket.count, 2);
    byHour.set(hour, bucket);

    if (e.magnitude < 2) magBins['0–2'] += 1;
    else if (e.magnitude < 4) magBins['2–4'] += 1;
    else if (e.magnitude < 6) magBins['4–6'] += 1;
    else magBins['6+'] += 1;

    cumulativeEnergy += e.energyJ;
    energySeries.push({
      time: e.time,
      energyJ: cumulativeEnergy,
      magnitude: e.magnitude,
    });
  }

  return {
    hourly: [...byHour.values()].sort((a, b) => a.time.localeCompare(b.time)),
    magnitudeHistogram: Object.entries(magBins).map(([bin, count]) => ({ bin, count })),
    cumulativeEnergy: downsample(energySeries, 200),
  };
}

export function buildDepthAnalysis(events) {
  const categories = { Shallow: [], Intermediate: [], Deep: [] };
  for (const e of events) {
    categories[e.depthCategory]?.push(e);
  }

  const profiles = Object.entries(categories).map(([category, list]) => ({
    category,
    count: list.length,
    avgMagnitude: list.length ? round(avg(list.map((e) => e.magnitude)), 2) : 0,
    avgDepth: list.length ? round(avg(list.map((e) => e.depth)), 1) : 0,
    maxMagnitude: list.length ? round(Math.max(...list.map((e) => e.magnitude)), 1) : 0,
    energySharePct: events.length
      ? round(
          (list.reduce((s, e) => s + e.energyJ, 0) /
            events.reduce((s, e) => s + e.energyJ, 0)) *
            100,
          1,
        )
      : 0,
  }));

  const scatter = sampleForDisplay(events, 800).events.map((e) => ({
    id: e.id,
    magnitude: e.magnitude,
    depth: e.depth,
    place: e.place,
    depthCategory: e.depthCategory,
    time: e.time,
  }));

  const depthBins = buildDepthBins(events);

  return { profiles, scatter, depthBins };
}

function buildDepthBins(events) {
  const edges = [0, 10, 30, 70, 150, 300, 500, 700];
  const bins = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const count = events.filter((e) => e.depth >= lo && e.depth < hi).length;
    bins.push({ label: `${lo}–${hi} km`, count, lo, hi });
  }
  const deep = events.filter((e) => e.depth >= 700).length;
  bins.push({ label: '700+ km', count: deep, lo: 700, hi: null });
  return bins;
}

export function buildRegionalRanking(events, limit = 12) {
  const map = new Map();
  for (const e of events) {
    const key = e.region || 'Unknown';
    const row = map.get(key) || {
      region: key,
      count: 0,
      maxMagnitude: 0,
      energyJ: 0,
      shallow: 0,
    };
    row.count += 1;
    row.maxMagnitude = Math.max(row.maxMagnitude, e.magnitude);
    row.energyJ += e.energyJ;
    if (e.depth < 70) row.shallow += 1;
    map.set(key, row);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.maxMagnitude - a.maxMagnitude)
    .slice(0, limit)
    .map((r) => ({
      ...r,
      maxMagnitude: round(r.maxMagnitude, 1),
      shallowPct: round((r.shallow / r.count) * 100, 0),
      energyLabel: formatEnergy(r.energyJ),
    }));
}

export function buildTimeline(events) {
  return [...events]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((e) => ({
      time: e.time,
      magnitude: e.magnitude,
      depth: e.depth,
      place: e.place,
      id: e.id,
    }));
}

/** Aggregated analytics payload expected by dashboard / tests. */
export function deepAnalytics(events) {
  const overview = buildOverviewSeries(events);
  return {
    topRegions: buildRegionalRanking(events, 15),
    magBuckets: overview.magnitudeHistogram.map((b) => ({
      label: b.bin,
      count: b.count,
    })),
    overview,
    depth: buildDepthAnalysis(events),
    timeline: buildTimeline(sampleForDisplay(events, 500).events),
  };
}

function downsample(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

function avg(nums) {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
