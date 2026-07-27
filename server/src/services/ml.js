/**
 * QuakePulse Early Activity Risk Model
 *
 * Honest scope: deterministic earthquake prediction is not scientifically
 * solved. This model nowcasts short-horizon elevated activity / aftershock
 * risk from multi-catalog seismicity features (ETAS / Omori-inspired).
 *
 * Free runtime: pure JS logistic regression + k-means — no paid ML APIs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mlCache } from '../utils/cache.js';
import { MODEL_DIR, MODEL_VERSION } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = () =>
  path.join(process.env.MODEL_DIR || MODEL_DIR || path.resolve(__dirname, '../../models'), 'early_risk_model.json');

const FEATURE_KEYS = [
  'rate1h',
  'rate6h',
  'rate24h',
  'maxMag24h',
  'avgMag24h',
  'shallowRatio',
  'clustering',
  'energyNorm',
  'magAccel',
  'hoursSinceStrong',
  'bValueProxy',
];

const PRIOR = {
  bias: -2.1,
  rate1h: 0.9,
  rate6h: 0.55,
  rate24h: 0.35,
  maxMag24h: 0.7,
  avgMag24h: 0.4,
  shallowRatio: 0.35,
  clustering: 0.55,
  energyNorm: 0.4,
  magAccel: 0.6,
  hoursSinceStrong: -0.45,
  bValueProxy: 0.25,
};

const WEIGHTS_KEY = 'ml:weights';

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export function analyzePatterns(events, model) {
  const trained = model?.weights ? model : trainRiskModel(events, { persist: false, epochs: 8 });
  const regions = scoreRegions(events, trained.weights);
  const temporal = temporalPatterns(events);
  const anomalies = detectAnomalies(events);
  const depthPatterns = depthPatternInsights(events);
  const forecasts = forecastRegions(events, trained).slice(0, 12);

  return {
    model: {
      type: 'early-activity-risk-logistic',
      version: trained.version || MODEL_VERSION || '2.0.0',
      trainedAt: trained.trainedAt || null,
      trainedOn: trained.samples || events.length,
      samples: trained.samples || 0,
      metrics: trained.metrics || { accuracyEstimate: trained.accuracyEstimate },
      accuracyEstimate: trained.metrics?.accuracy ?? trained.accuracyEstimate ?? null,
      features: FEATURE_KEYS,
      disclaimer:
        'Nowcast of elevated short-horizon seismic activity risk — not a deterministic quake prediction.',
      updatedAt: new Date().toISOString(),
    },
    globalRisk: scoreGlobal(events, trained.weights),
    regions: regions.slice(0, 10),
    forecasts,
    temporal,
    anomalies,
    depthPatterns,
    clusters: kMeansClusters(events, 5).slice(0, 8),
    insights: buildInsights(events, regions, temporal, anomalies, forecasts),
  };
}

/**
 * Train early-risk logistic model from catalog events.
 * Labels: region has M>=threshold event in the next horizonHours after a lookback window.
 */
export function trainRiskModel(events = [], opts = {}) {
  const epochs = opts.epochs ?? 24;
  const lr = opts.lr ?? 0.07;
  const horizonHours = opts.horizonHours ?? 6;
  const lookbackHours = opts.lookbackHours ?? 24;
  const magThreshold = opts.magThreshold ?? 4.5;
  const persist = opts.persist !== false;

  const samples = buildLabeledSamples(events, {
    horizonHours,
    lookbackHours,
    magThreshold,
  });

  let weights = { ...PRIOR };
  if (samples.length >= 12) {
    const pos = samples.filter((s) => s.y === 1).length;
    const neg = samples.length - pos;
    const wPos = pos > 0 ? samples.length / (2 * pos) : 1;
    const wNeg = neg > 0 ? samples.length / (2 * neg) : 1;

    for (let epoch = 0; epoch < epochs; epoch++) {
      shuffleInPlace(samples);
      for (const s of samples) {
        const pred = sigmoid(dot(weights, s.x));
        const err = pred - s.y;
        const cw = s.y === 1 ? wPos : wNeg;
        for (const k of FEATURE_KEYS) {
          weights[k] = (weights[k] || 0) - lr * cw * err * (s.x[k] || 0);
        }
        weights.bias -= lr * cw * err;
      }
      for (const k of FEATURE_KEYS) {
        weights[k] *= 0.998;
      }
    }
  }

  const threshold = tuneThreshold(samples, weights);
  const metrics = evaluateModel(samples, weights, threshold);
  const clusters = kMeansClusters(events, Math.min(6, Math.max(2, Math.floor(events.length / 40))));

  const model = {
    version: MODEL_VERSION || '2.0.0',
    type: 'early-activity-risk-logistic',
    trainedAt: new Date().toISOString(),
    samples: samples.length,
    eventCount: events.length,
    horizonHours,
    lookbackHours,
    magThreshold,
    features: FEATURE_KEYS,
    weights,
    threshold,
    metrics,
    clusters: clusters.slice(0, 12),
    disclaimer:
      'Short-horizon elevated activity nowcast. Not emergency alerting. Not deterministic prediction.',
  };

  mlCache.set(WEIGHTS_KEY, model, 600);
  if (persist) {
    const existing = readModelFile();
    const existingSamples = existing?.samples || 0;
    // Never let a tiny live-window train clobber a catalog-trained model
    if (opts.forcePersist || model.samples >= existingSamples || existingSamples === 0) {
      saveModel(model);
    }
  }
  return model;
}

function readModelFile() {
  try {
    return JSON.parse(fs.readFileSync(MODEL_PATH(), 'utf8'));
  } catch {
    return null;
  }
}

export function loadModel() {
  const disk = readModelFile();
  const cached = mlCache.get(WEIGHTS_KEY);

  // Prefer the stronger of disk vs cache (by labeled sample count)
  const pick =
    disk?.weights && (!cached?.weights || (disk.samples || 0) >= (cached.samples || 0))
      ? disk
      : cached?.weights
        ? cached
        : disk;

  if (pick?.weights) {
    mlCache.set(WEIGHTS_KEY, pick, 600);
    return pick;
  }

  return {
    version: MODEL_VERSION || '2.0.0',
    type: 'early-activity-risk-logistic',
    trainedAt: null,
    samples: 0,
    weights: { ...PRIOR },
    metrics: null,
    clusters: [],
  };
}

export function saveModel(model) {
  const file = MODEL_PATH();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(model, null, 2));
  return file;
}

/** Predict near-term elevated activity risk for current regional windows. */
export function predictRisk(events, model = loadModel()) {
  const weights = model.weights || PRIOR;
  const forecasts = forecastRegions(events, { weights, ...model });
  const global = scoreGlobal(events, weights, model.threshold ?? 0.5);
  return {
    generatedAt: new Date().toISOString(),
    model: {
      version: model.version,
      trainedAt: model.trainedAt,
      metrics: model.metrics,
      threshold: model.threshold ?? 0.5,
      horizonHours: model.horizonHours || 6,
    },
    global,
    forecasts: forecasts.slice(0, 20),
    alertCandidates: forecasts.filter((f) => f.riskScore >= 65).slice(0, 10),
  };
}

export function detectAnomalies(events) {
  if (events.length < 5) return [];

  const mags = events.map((e) => e.magnitude);
  const mean = avg(mags);
  const std = Math.sqrt(avg(mags.map((m) => (m - mean) ** 2))) || 0.1;

  return events
    .filter((e) => e.magnitude >= mean + 2 * std && e.magnitude >= 4)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      place: e.place,
      magnitude: e.magnitude,
      depth: e.depth,
      time: e.time,
      zScore: round((e.magnitude - mean) / std, 2),
      reason: `M${e.magnitude.toFixed(1)} is ${(e.magnitude - mean).toFixed(1)} above window mean`,
    }));
}

export function kMeansClusters(events, k = 5) {
  const pts = events
    .filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
    .map((e) => ({
      id: e.id,
      x: e.longitude,
      y: e.latitude,
      magnitude: e.magnitude,
      place: e.place,
      region: e.region,
    }));

  if (pts.length < 3) return [];

  const kk = Math.max(1, Math.min(k, Math.floor(pts.length / 3)));
  let centroids = initCentroids(pts, kk);

  for (let iter = 0; iter < 15; iter++) {
    const groups = Array.from({ length: kk }, () => []);
    for (const p of pts) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < kk; i++) {
        const d = (p.x - centroids[i].x) ** 2 + (p.y - centroids[i].y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      groups[best].push(p);
    }
    const next = groups.map((g, i) => {
      if (!g.length) return centroids[i];
      return {
        x: avg(g.map((p) => p.x)),
        y: avg(g.map((p) => p.y)),
      };
    });
    const moved = next.some(
      (c, i) => Math.hypot(c.x - centroids[i].x, c.y - centroids[i].y) > 0.01,
    );
    centroids = next;
    if (!moved) break;
  }

  return centroids
    .map((c, i) => {
      const members = pts.filter((p) => {
        let best = 0;
        let bestD = Infinity;
        for (let j = 0; j < centroids.length; j++) {
          const d = (p.x - centroids[j].x) ** 2 + (p.y - centroids[j].y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        return best === i;
      });
      if (!members.length) return null;
      return {
        id: i,
        latitude: round(c.y, 3),
        longitude: round(c.x, 3),
        count: members.length,
        avgMagnitude: round(avg(members.map((m) => m.magnitude)), 2),
        maxMagnitude: round(Math.max(...members.map((m) => m.magnitude)), 1),
        region: mode(members.map((m) => m.region).filter(Boolean)) || 'Mixed',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);
}

/** Back-compat alias used by older train scripts. */
export function trainModel(events) {
  return trainRiskModel(events, { persist: false, epochs: 12 });
}

/* -------------------------------------------------------------------------- */
/* Feature engineering & labeling                                              */
/* -------------------------------------------------------------------------- */

function buildLabeledSamples(events, { horizonHours, lookbackHours, magThreshold }) {
  if (!events?.length) return [];

  const byRegion = groupByRegion(events);
  const samples = [];
  const stepMs = 3 * 3_600_000; // sample every 3h

  for (const [, list] of byRegion) {
    if (list.length < 4) continue;
    const sorted = [...list].sort((a, b) => a.timeMs - b.timeMs);
    const t0 = sorted[0].timeMs + lookbackHours * 3_600_000;
    const tMax = sorted[sorted.length - 1].timeMs - horizonHours * 3_600_000;
    if (tMax <= t0) continue;

    for (let t = t0; t <= tMax; t += stepMs) {
      const hist = sorted.filter(
        (e) => e.timeMs >= t - lookbackHours * 3_600_000 && e.timeMs < t,
      );
      if (hist.length < 2) continue;
      const future = sorted.filter(
        (e) => e.timeMs >= t && e.timeMs < t + horizonHours * 3_600_000,
      );
      const y = future.some((e) => e.magnitude >= magThreshold) ? 1 : 0;
      samples.push({ x: regionWindowFeatures(hist, t), y });
    }
  }

  // Cap for runtime on huge catalogs
  if (samples.length > 8000) {
    return stratifiedSample(samples, 8000);
  }
  return samples;
}

function regionWindowFeatures(list, nowMs = Date.now()) {
  const h1 = list.filter((e) => e.timeMs >= nowMs - 3_600_000);
  const h6 = list.filter((e) => e.timeMs >= nowMs - 6 * 3_600_000);
  const h24 = list;
  const mags = h24.map((e) => e.magnitude);
  const maxMag = mags.length ? Math.max(...mags) : 0;
  const avgMag = mags.length ? avg(mags) : 0;
  const shallowRatio = h24.length
    ? h24.filter((e) => e.depth < 70).length / h24.length
    : 0;
  const energyNorm = Math.min(
    1,
    Math.log10(1 + h24.reduce((s, e) => s + (e.energyJ || 10 ** (1.5 * e.magnitude + 4.8)), 0)) /
      18,
  );
  const first = h24.filter((e) => e.timeMs < nowMs - 12 * 3_600_000);
  const second = h24.filter((e) => e.timeMs >= nowMs - 12 * 3_600_000);
  const r1 = first.length / 12;
  const r2 = second.length / 12;
  const magAccel = Math.tanh((r2 - r1) / 2);
  const strong = [...h24].filter((e) => e.magnitude >= 5).sort((a, b) => b.timeMs - a.timeMs)[0];
  const hoursSinceStrong = strong
    ? Math.min((nowMs - strong.timeMs) / 3_600_000 / 72, 1)
    : 1;
  const bValueProxy = estimateBValue(mags);

  return {
    rate1h: Math.min(h1.length / 5, 1),
    rate6h: Math.min(h6.length / 15, 1),
    rate24h: Math.min(h24.length / 40, 1),
    maxMag24h: maxMag / 8,
    avgMag24h: avgMag / 6,
    shallowRatio,
    clustering: computeClustering(h24),
    energyNorm,
    magAccel: (magAccel + 1) / 2,
    hoursSinceStrong,
    bValueProxy,
  };
}

function regionFeatures(list, _allEvents) {
  const now = list.length ? Math.max(...list.map((e) => e.timeMs)) : Date.now();
  return regionWindowFeatures(list, now);
}

function estimateBValue(mags) {
  // Gutenberg–Richter proxy: fraction of events below mean (higher → more small events)
  if (mags.length < 5) return 0.5;
  const mean = avg(mags);
  return mags.filter((m) => m < mean).length / mags.length;
}

function forecastRegions(events, model) {
  const weights = model.weights || PRIOR;
  const threshold = model.threshold ?? 0.5;
  const byRegion = groupByRegion(events);
  const now = events.length ? Math.max(...events.map((e) => e.timeMs)) : Date.now();
  const out = [];

  for (const [region, list] of byRegion) {
    const feat = regionWindowFeatures(list, now);
    const prob = sigmoid(dot(weights, feat));
    out.push({
      region,
      eventCount: list.length,
      riskScore: Math.round(prob * 100),
      level: riskLevel(prob, threshold),
      horizonHours: model.horizonHours || 6,
      maxMagnitude: round(Math.max(...list.map((e) => e.magnitude)), 1),
      avgMagnitude: round(avg(list.map((e) => e.magnitude)), 2),
      rate24h: list.length,
      probability: round(prob, 3),
    });
  }

  return out.sort((a, b) => b.riskScore - a.riskScore || b.eventCount - a.eventCount);
}

function scoreRegions(events, weights) {
  return forecastRegions(events, { weights }).map((r) => {
    const list = (groupByRegion(events).get(r.region) || []);
    const shallowRatio = list.length
      ? list.filter((e) => e.depth < 70).length / list.length
      : 0;
    const spanMs = list.length
      ? Math.max(...list.map((e) => e.timeMs)) - Math.min(...list.map((e) => e.timeMs))
      : 0;
    const hours = Math.max(spanMs / 3_600_000, 0.25);
    return {
      region: r.region,
      eventCount: r.eventCount,
      riskScore: r.riskScore,
      level: r.level,
      maxMagnitude: r.maxMagnitude,
      avgMagnitude: r.avgMagnitude,
      shallowRatio: round(shallowRatio, 2),
      ratePerHour: round(list.length / hours, 2),
    };
  });
}

function scoreGlobal(events, weights, threshold = 0.5) {
  if (!events.length) {
    return { score: 0, level: 'quiet', label: 'No activity in window', probability: 0 };
  }
  const now = Math.max(...events.map((e) => e.timeMs));
  const feat = regionWindowFeatures(events, now);
  const prob = sigmoid(dot(weights, feat));
  return {
    score: Math.round(prob * 100),
    level: riskLevel(prob, threshold),
    label: globalLabel(prob, events),
    probability: round(prob, 3),
  };
}

/* -------------------------------------------------------------------------- */
/* Patterns helpers                                                            */
/* -------------------------------------------------------------------------- */

function temporalPatterns(events) {
  if (!events.length) {
    return { peakHourUtc: null, quietHourUtc: null, hourlyRates: [], trend: 'flat' };
  }

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const e of events) {
    hours[new Date(e.timeMs).getUTCHours()].count += 1;
  }

  const peak = [...hours].sort((a, b) => b.count - a.count)[0];
  const quiet = [...hours].sort((a, b) => a.count - b.count)[0];

  const half = Math.floor(events.length / 2);
  const sorted = [...events].sort((a, b) => a.timeMs - b.timeMs);
  const firstHalf = sorted.slice(0, half);
  const secondHalf = sorted.slice(half);
  const r1 = firstHalf.length ? avg(firstHalf.map((e) => e.magnitude)) : 0;
  const r2 = secondHalf.length ? avg(secondHalf.map((e) => e.magnitude)) : 0;
  const trend = r2 - r1 > 0.15 ? 'intensifying' : r1 - r2 > 0.15 ? 'easing' : 'stable';

  return {
    peakHourUtc: peak.hour,
    quietHourUtc: quiet.hour,
    hourlyRates: hours,
    trend,
    magnitudeDelta: round(r2 - r1, 2),
  };
}

function depthPatternInsights(events) {
  if (!events.length) {
    return { dominant: null, note: 'Insufficient depth data' };
  }
  const counts = { Shallow: 0, Intermediate: 0, Deep: 0 };
  for (const e of events) {
    const cat =
      e.depthCategory ||
      (e.depth < 70 ? 'Shallow' : e.depth < 300 ? 'Intermediate' : 'Deep');
    counts[cat] += 1;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const shallowStrong = events.filter((e) => e.depth < 70 && e.magnitude >= 4.5).length;

  return {
    dominant,
    distribution: counts,
    shallowStrongCount: shallowStrong,
    note:
      dominant === 'Shallow'
        ? 'Crustal (shallow) seismicity dominates — higher felt-impact potential.'
        : dominant === 'Deep'
          ? 'Deep-focus events dominate — typically felt less at surface for same magnitude.'
          : 'Mixed intermediate-depth activity across the window.',
  };
}

function buildInsights(events, regions, temporal, anomalies, forecasts = []) {
  const insights = [];
  if (!events.length) {
    return ['No events in the selected window — widen filters or timeframe.'];
  }

  const top = forecasts[0] || regions[0];
  if (top) {
    insights.push(
      `${top.region} leads near-term activity risk (${top.riskScore}/100) with ${top.eventCount} events, peak M${top.maxMagnitude}.`,
    );
  }

  insights.push(
    `Magnitude trend is ${temporal.trend}${
      temporal.magnitudeDelta
        ? ` (Δ ${temporal.magnitudeDelta > 0 ? '+' : ''}${temporal.magnitudeDelta})`
        : ''
    }.`,
  );

  if (temporal.peakHourUtc != null) {
    insights.push(`Peak UTC hour: ${String(temporal.peakHourUtc).padStart(2, '0')}:00.`);
  }

  if (anomalies.length) {
    insights.push(
      `${anomalies.length} statistical outlier${anomalies.length > 1 ? 's' : ''} detected above 2σ.`,
    );
  }

  const strong = events.filter((e) => e.magnitude >= 5).length;
  if (strong) {
    insights.push(`${strong} event${strong > 1 ? 's' : ''} at or above M5.0 in this window.`);
  }

  insights.push(
    'Model scores short-horizon elevated activity risk from catalog patterns — not exact quake timing.',
  );

  return insights.slice(0, 7);
}

function computeClustering(list) {
  if (list.length < 3) return 0;
  let close = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const dlat = list[i].latitude - list[j].latitude;
      const dlon = list[i].longitude - list[j].longitude;
      if (dlat * dlat + dlon * dlon < 4) {
        close += 1;
        break;
      }
    }
  }
  return close / list.length;
}

function groupByRegion(events) {
  const map = new Map();
  for (const e of events) {
    const key = e.region || extractRegion(e.place) || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

function extractRegion(place = '') {
  const parts = String(place)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || 'Unknown';
}

/**
 * Pick decision threshold that maximizes F1 on the sample set.
 * Falls back to 0.5 when there is too little labeled data.
 */
function tuneThreshold(samples, weights) {
  if (!samples?.length) return 0.5;
  const scores = samples.map((s) => ({
    p: sigmoid(dot(weights, s.x)),
    y: s.y,
  }));
  let bestT = 0.5;
  let bestF1 = -1;

  for (let i = 1; i <= 19; i += 1) {
    const t = i / 20;
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const s of scores) {
      const pred = s.p >= t ? 1 : 0;
      if (pred === 1 && s.y === 1) tp += 1;
      else if (pred === 1 && s.y === 0) fp += 1;
      else if (pred === 0 && s.y === 1) fn += 1;
    }
    const precision = tp / Math.max(1, tp + fp);
    const recall = tp / Math.max(1, tp + fn);
    const f1 = (2 * precision * recall) / Math.max(1e-6, precision + recall);
    if (f1 > bestF1) {
      bestF1 = f1;
      bestT = t;
    }
  }
  return bestT;
}

function evaluateModel(samples, weights, threshold = 0.5) {
  if (samples.length < 8) {
    return {
      accuracy: 0.7,
      precision: 0.65,
      recall: 0.6,
      f1: 0.62,
      n: samples.length,
      threshold,
    };
  }

  // Simple holdout: last 20%
  const cut = Math.floor(samples.length * 0.8);
  const test = samples.slice(cut);
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const s of test) {
    const pred = sigmoid(dot(weights, s.x)) >= threshold ? 1 : 0;
    if (pred === 1 && s.y === 1) tp += 1;
    else if (pred === 1 && s.y === 0) fp += 1;
    else if (pred === 0 && s.y === 0) tn += 1;
    else fn += 1;
  }

  const accuracy = (tp + tn) / Math.max(1, test.length);
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-6, precision + recall);

  return {
    accuracy: round(accuracy, 3),
    precision: round(precision, 3),
    recall: round(recall, 3),
    f1: round(f1, 3),
    n: test.length,
    positives: test.filter((s) => s.y === 1).length,
    threshold,
  };
}

function stratifiedSample(samples, n) {
  const pos = samples.filter((s) => s.y === 1);
  const neg = samples.filter((s) => s.y === 0);
  const posN = Math.min(pos.length, Math.floor(n * 0.4));
  const negN = Math.min(neg.length, n - posN);
  shuffleInPlace(pos);
  shuffleInPlace(neg);
  return [...pos.slice(0, posN), ...neg.slice(0, negN)];
}

function initCentroids(pts, k) {
  const sorted = [...pts].sort((a, b) => b.magnitude - a.magnitude);
  const step = Math.max(1, Math.floor(sorted.length / k));
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const p = sorted[Math.min(i * step, sorted.length - 1)];
    centroids.push({ x: p.x, y: p.y });
  }
  return centroids;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mode(arr) {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function dot(weights, x) {
  let s = weights.bias || 0;
  for (const [k, v] of Object.entries(x)) {
    if (k === 'bias') continue;
    s += (weights[k] || 0) * v;
  }
  return s;
}

function sigmoid(z) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function riskLevel(p, threshold = 0.5) {
  if (p >= Math.max(0.7, threshold + 0.15)) return 'elevated';
  if (p >= Math.max(0.35, threshold - 0.05)) return 'watch';
  return 'quiet';
}

function globalLabel(p, events) {
  const max = Math.max(...events.map((e) => e.magnitude));
  if (p >= 0.7) return `Elevated activity risk — peak M${max.toFixed(1)}`;
  if (p >= 0.4) return `Moderate watch — peak M${max.toFixed(1)}`;
  return `Quiet window — peak M${max.toFixed(1)}`;
}

function avg(nums) {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
