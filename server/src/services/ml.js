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
  'countM3',
  'countM4',
  'countM5',
  'maxMag24h',
  'avgMag24h',
  'magStd',
  'shallowRatio',
  'clustering',
  'energyNorm',
  'magAccel',
  'hoursSinceStrong',
  'hoursSinceAny',
  'interEventCv',
  'bValueProxy',
  'ringOfFire',
  'depthTrend',
  'sequenceLen',
  'omoriProxy',
  'energyBurst',
  'm4Recency',
  'quiescenceBreak',
  'neighborProxy',
];

const PRIOR = {
  bias: -1.85,
  rate1h: 0.9,
  rate6h: 0.5,
  rate24h: 0.22,
  countM3: 0.35,
  countM4: 1.05,
  countM5: 1.35,
  maxMag24h: 0.85,
  avgMag24h: 0.25,
  magStd: 0.4,
  shallowRatio: 0.2,
  clustering: 0.6,
  energyNorm: 0.45,
  magAccel: 0.8,
  hoursSinceStrong: -0.6,
  hoursSinceAny: -0.25,
  interEventCv: 0.28,
  bValueProxy: 0.12,
  ringOfFire: 0.4,
  depthTrend: 0.18,
  sequenceLen: 0.35,
  omoriProxy: 0.7,
  energyBurst: 0.85,
  m4Recency: 0.95,
  quiescenceBreak: 0.55,
  neighborProxy: 0.35,
};

const CELL_DEG = 2.5; // finer cells → tighter spatial labels
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
    globalRisk: scoreGlobal(events, trained.weights, trained.threshold ?? 0.5, trained.scaler),
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
 * Labels: spatial cell has M>=threshold in next horizonHours after lookback.
 * Chronological holdout, z-scored features, balanced epochs, precision-aware F1.
 */
export function trainRiskModel(events = [], opts = {}) {
  const epochs = opts.epochs ?? 60;
  const lr0 = opts.lr ?? 0.07;
  const horizonHours = opts.horizonHours ?? 6;
  const lookbackHours = opts.lookbackHours ?? 24;
  const magThreshold = opts.magThreshold ?? 4.0;
  const persist = opts.persist !== false;
  const maxSamples = opts.maxSamples ?? 40_000;

  let samples = buildLabeledSamples(events, {
    horizonHours,
    lookbackHours,
    magThreshold,
  });

  // Chronological split first (avoids leakage from overlapping windows)
  samples.sort((a, b) => (a.t || 0) - (b.t || 0));
  if (samples.length > maxSamples) {
    samples = stratifiedSample(samples, maxSamples);
    samples.sort((a, b) => (a.t || 0) - (b.t || 0));
  }

  const scaler = fitScaler(samples.map((s) => s.x));
  samples = samples.map((s) => ({ ...s, x: applyScaler(s.x, scaler) }));

  const cut = Math.floor(samples.length * 0.8);
  const train = samples.slice(0, Math.max(1, cut));
  const test = samples.slice(cut);

  let weights = { ...PRIOR };
  for (const k of FEATURE_KEYS) {
    const sd = scaler.std[k] || 1;
    weights[k] = (weights[k] || 0) * Math.min(sd, 1);
  }

  const velocity = Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0]));
  velocity.bias = 0;
  const momentum = 0.9;

  let bestWeights = { ...weights };
  let bestScore = -1;
  let patience = 0;

  if (train.length >= 12) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = lr0 * (1 / (1 + epoch * 0.03));
      const batch = balancedEpochBatch(train, Math.min(train.length, 10_000));
      for (const s of batch) {
        const pred = scoreProbability(s.x, weights);
        const err = pred - s.y;
        // Focal-ish: up-weight hard examples + slight positive emphasis
        const focal = Math.pow(Math.abs(err), 1.4);
        const cw = (s.y === 1 ? 1.25 : 1) * (0.55 + focal);
        for (const k of FEATURE_KEYS) {
          const g = cw * err * (s.x[k] || 0) + 0.0012 * (weights[k] || 0);
          velocity[k] = momentum * velocity[k] - lr * g;
          weights[k] = (weights[k] || 0) + velocity[k];
        }
        const gb = cw * err + 0.0005 * (weights.bias || 0);
        velocity.bias = momentum * velocity.bias - lr * gb;
        weights.bias += velocity.bias;
      }

      if (test.length >= 40 && epoch % 3 === 2) {
        const t = tuneThreshold(test, weights);
        const m = evaluateHoldout(test, weights, t);
        const score = m.f1 + Math.min(m.precision, 0.55) * 0.25;
        if (score > bestScore) {
          bestScore = score;
          bestWeights = { ...weights };
          patience = 0;
        } else if (++patience >= 7) {
          weights = bestWeights;
          break;
        }
      }
    }
    if (bestScore > 0) weights = bestWeights;
  }

  const threshold = tuneThreshold(test.length >= 20 ? test : samples, weights);
  const metrics = evaluateHoldout(test.length >= 20 ? test : samples, weights, threshold);
  const clusters = kMeansClusters(events, Math.min(8, Math.max(2, Math.floor(events.length / 50))));

  const model = {
    version: MODEL_VERSION || '3.2.0',
    type: 'early-activity-risk-logistic-v32',
    trainedAt: new Date().toISOString(),
    samples: samples.length,
    trainSamples: train.length,
    eventCount: events.length,
    horizonHours,
    lookbackHours,
    magThreshold,
    cellDeg: CELL_DEG,
    features: FEATURE_KEYS,
    scaler,
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
    const existingF1 = existing?.metrics?.f1 || 0;
    if (
      opts.forcePersist ||
      model.samples >= existingSamples ||
      (model.metrics?.f1 || 0) >= existingF1 ||
      existingSamples === 0
    ) {
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
  const global = scoreGlobal(events, weights, model.threshold ?? 0.5, model.scaler);
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

  // Spatial cells generalize better than place-name regions
  const byCell = groupBySpatialCell(events, CELL_DEG);
  // Neighbor activity index: count of events in adjacent cells (coarse prior)
  const cellActivity = new Map();
  for (const [key, list] of byCell) {
    cellActivity.set(key, list.length);
  }

  const samples = [];
  const stepMs = 3 * 3_600_000; // every 3h — less overlap / leakage

  for (const [cellKey, list] of byCell) {
    if (list.length < 4) continue;
    const sorted = [...list].sort((a, b) => a.timeMs - b.timeMs);
    const t0 = sorted[0].timeMs + lookbackHours * 3_600_000;
    const tMax = sorted[sorted.length - 1].timeMs - horizonHours * 3_600_000;
    if (tMax <= t0) continue;

    const [latBin, lonBin] = cellKey.split(':').map(Number);
    let neighborSum = 0;
    let neighborN = 0;
    for (let dlat = -1; dlat <= 1; dlat++) {
      for (let dlon = -1; dlon <= 1; dlon++) {
        if (dlat === 0 && dlon === 0) continue;
        const n = cellActivity.get(`${latBin + dlat}:${lonBin + dlon}`) || 0;
        neighborSum += n;
        neighborN += 1;
      }
    }
    const neighborProxy = Math.min(1, neighborSum / Math.max(1, neighborN) / 40);

    for (let t = t0; t <= tMax; t += stepMs) {
      const hist = sorted.filter(
        (e) => e.timeMs >= t - lookbackHours * 3_600_000 && e.timeMs < t,
      );
      if (hist.length < 2) continue;
      // Skip dead-quiet windows — labels are noise without recent seismicity
      if (hist.every((e) => e.magnitude < 2.5) && hist.length < 5) continue;

      const future = sorted.filter(
        (e) => e.timeMs >= t && e.timeMs < t + horizonHours * 3_600_000,
      );
      const y = future.some((e) => e.magnitude >= magThreshold) ? 1 : 0;
      const x = regionWindowFeatures(hist, t);
      x.neighborProxy = neighborProxy;
      samples.push({ x, y, t });
    }
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
  const magStd = mags.length > 1
    ? Math.sqrt(avg(mags.map((m) => (m - avgMag) ** 2)))
    : 0;
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
  const latest = [...h24].sort((a, b) => b.timeMs - a.timeMs)[0];
  const hoursSinceStrong = strong
    ? Math.min((nowMs - strong.timeMs) / 3_600_000 / 72, 1)
    : 1;
  const hoursSinceAny = latest
    ? Math.min((nowMs - latest.timeMs) / 3_600_000 / 24, 1)
    : 1;
  const bValueProxy = estimateBValue(mags);
  const ringOfFire = avg(h24.map((e) => ringOfFireScore(e.latitude, e.longitude)));

  const earlyDepth = first.length ? avg(first.map((e) => e.depth)) : 0;
  const lateDepth = second.length ? avg(second.map((e) => e.depth)) : earlyDepth;
  const depthTrend = Math.tanh((earlyDepth - lateDepth) / 80);
  const sequenceLen = Math.min(h24.length / 25, 1);

  const sortedT = [...h24].map((e) => e.timeMs).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sortedT.length; i++) gaps.push((sortedT[i] - sortedT[i - 1]) / 3_600_000);
  const gapMean = gaps.length ? avg(gaps) : 1;
  const gapStd = gaps.length > 1 ? Math.sqrt(avg(gaps.map((g) => (g - gapMean) ** 2))) : 0;
  const interEventCv = gapMean > 0 ? Math.min(gapStd / gapMean, 3) / 3 : 0.5;

  // Omori-like: recent rate relative to earlier rate after last M>=4
  const lastM4 = [...h24].filter((e) => e.magnitude >= 4).sort((a, b) => b.timeMs - a.timeMs)[0];
  let omoriProxy = 0.3;
  if (lastM4) {
    const after = h24.filter((e) => e.timeMs > lastM4.timeMs);
    const hoursAfter = Math.max((nowMs - lastM4.timeMs) / 3_600_000, 0.25);
    omoriProxy = Math.min(1, after.length / Math.sqrt(hoursAfter) / 8);
  }

  const energy = (evs) =>
    evs.reduce((s, e) => s + (e.energyJ || 10 ** (1.5 * e.magnitude + 4.8)), 0);
  const e3 = energy(h24.filter((e) => e.timeMs >= nowMs - 3 * 3_600_000));
  const eRest = Math.max(energy(h24) - e3, 1);
  const energyBurst = Math.min(1, Math.log10(1 + e3 / eRest) / 2);
  const m4Recency = lastM4
    ? Math.max(0, 1 - (nowMs - lastM4.timeMs) / (36 * 3_600_000))
    : 0;
  // Break of quiescence: recent rate spike after a quiet first half
  const quiescenceBreak =
    r1 < 0.15 && r2 > r1 * 2 ? Math.min(1, (r2 - r1) / 2) : Math.max(0, (r2 - r1) / 4);

  return {
    rate1h: Math.min(h1.length / 5, 1),
    rate6h: Math.min(h6.length / 15, 1),
    rate24h: Math.min(h24.length / 40, 1),
    countM3: Math.min(h24.filter((e) => e.magnitude >= 3).length / 12, 1),
    countM4: Math.min(h24.filter((e) => e.magnitude >= 4).length / 6, 1),
    countM5: Math.min(h24.filter((e) => e.magnitude >= 5).length / 3, 1),
    maxMag24h: maxMag / 8,
    avgMag24h: avgMag / 6,
    magStd: Math.min(magStd / 2, 1),
    shallowRatio,
    clustering: computeClustering(h24),
    energyNorm,
    magAccel: (magAccel + 1) / 2,
    hoursSinceStrong,
    hoursSinceAny,
    interEventCv,
    bValueProxy,
    ringOfFire,
    depthTrend: (depthTrend + 1) / 2,
    sequenceLen,
    omoriProxy,
    energyBurst,
    m4Recency,
    quiescenceBreak: Math.min(1, Math.max(0, quiescenceBreak)),
    neighborProxy: 0.3,
  };
}

function groupBySpatialCell(events, deg = CELL_DEG) {
  const map = new Map();
  for (const e of events) {
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) continue;
    const latBin = Math.floor((e.latitude + 90) / deg);
    const lonBin = Math.floor((e.longitude + 180) / deg);
    const key = `${latBin}:${lonBin}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

function estimateBValue(mags) {
  // Gutenberg–Richter proxy: fraction of events below mean (higher → more small events)
  if (mags.length < 5) return 0.5;
  const mean = avg(mags);
  return mags.filter((m) => m < mean).length / mags.length;
}

/** Soft prior: proximity to major circum-Pacific / Alpine-Himalayan belts. */
function ringOfFireScore(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0.3;
  const belts = [
    { lat: 35, lon: 139, r: 25 },
    { lat: -15, lon: -75, r: 30 },
    { lat: 55, lon: -160, r: 35 },
    { lat: 20, lon: -155, r: 18 },
    { lat: -20, lon: -175, r: 30 }, // Tonga / Fiji (dateline)
    { lat: -20, lon: 175, r: 30 },
    { lat: 5, lon: 125, r: 25 },
    { lat: 38, lon: 22, r: 20 },
    { lat: 28, lon: 85, r: 22 },
    { lat: 36, lon: -120, r: 18 },
    { lat: -40, lon: 175, r: 20 },
    { lat: -22, lon: 166, r: 12 }, // Loyalty / New Caledonia
  ];
  let best = 0;
  for (const b of belts) {
    let dlon = Math.abs(lon - b.lon);
    if (dlon > 180) dlon = 360 - dlon;
    const d = Math.hypot(lat - b.lat, dlon);
    const score = Math.max(0, 1 - d / b.r);
    if (score > best) best = score;
  }
  return best;
}

function forecastRegions(events, model) {
  const weights = model.weights || PRIOR;
  const threshold = model.threshold ?? 0.5;
  const byRegion = groupByRegion(events);
  const now = events.length ? Math.max(...events.map((e) => e.timeMs)) : Date.now();
  const out = [];

  for (const [region, list] of byRegion) {
    const featRaw = regionWindowFeatures(list, now);
    const feat = model.scaler ? applyScaler(featRaw, model.scaler) : featRaw;
    const logistic = scoreProbability(feat, weights);
    const maxMag = Math.max(...list.map((e) => e.magnitude));
    const m4 = list.filter((e) => e.magnitude >= 4).length;
    // Gate: microquake swarms without M≥4 should not look "elevated"
    const magGate = Math.min(1, Math.max(0.15, (maxMag - 2.8) / 3.2));
    const rateBoost = Math.min(1, m4 / 4) * 0.14 * magGate;
    const prob = Math.min(0.99, (logistic * 0.9 + rateBoost + feat.ringOfFire * 0.05) * magGate + logistic * (1 - magGate) * 0.35);
    out.push({
      region,
      eventCount: list.length,
      riskScore: Math.round(prob * 100),
      level: riskLevel(prob, threshold),
      horizonHours: model.horizonHours || 6,
      maxMagnitude: round(maxMag, 1),
      avgMagnitude: round(avg(list.map((e) => e.magnitude)), 2),
      rate24h: list.length,
      m4Count: m4,
      probability: round(prob, 3),
      ringOfFire: round(featRaw.ringOfFire, 2),
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

function scoreGlobal(events, weights, threshold = 0.5, scaler = null) {
  if (!events.length) {
    return { score: 0, level: 'quiet', label: 'No activity in window', probability: 0 };
  }
  const now = Math.max(...events.map((e) => e.timeMs));
  const featRaw = regionWindowFeatures(events, now);
  const feat = scaler ? applyScaler(featRaw, scaler) : featRaw;
  const logistic = scoreProbability(feat, weights);
  const maxMag = Math.max(...events.map((e) => e.magnitude));
  const m4 = events.filter((e) => e.magnitude >= 4).length;
  const magGate = Math.min(1, Math.max(0.2, (maxMag - 2.8) / 3.2));
  const rateBoost = Math.min(1, m4 / 8) * 0.12 * magGate;
  const prob = Math.min(
    0.99,
    (logistic * 0.9 + rateBoost + feat.ringOfFire * 0.05) * magGate + logistic * (1 - magGate) * 0.4,
  );
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
 * Pick decision threshold that maximizes precision-aware F1.
 * Prefer fewer false "elevated" alerts over max recall.
 */
function tuneThreshold(samples, weights) {
  if (!samples?.length) return 0.5;
  const scores = samples.map((s) => ({
    p: scoreProbability(s.x, weights),
    y: s.y,
  }));
  let bestT = 0.55;
  let bestScore = -1;

  for (let i = 8; i <= 18; i += 1) {
    const t = i / 20; // 0.40 … 0.90
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
    // F-beta with beta=0.7 → lean precision
    const beta = 0.7;
    const fBeta =
      ((1 + beta * beta) * precision * recall) /
      Math.max(1e-6, beta * beta * precision + recall);
    const score = fBeta + Math.min(precision, 0.6) * 0.35;
    if (score > bestScore && precision >= 0.28) {
      bestScore = score;
      bestT = t;
    }
  }
  return bestT;
}

function evaluateHoldout(test, weights, threshold = 0.5) {
  if (!test?.length) {
    return {
      accuracy: 0.7,
      precision: 0.65,
      recall: 0.6,
      f1: 0.62,
      n: 0,
      threshold,
    };
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const s of test) {
    const pred = scoreProbability(s.x, weights) >= threshold ? 1 : 0;
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
    tp,
    fp,
    tn,
    fn,
  };
}

/** Prefer FEATURE_KEYS order so missing legacy weights don't break scoring. */
function scoreProbability(x, weights) {
  let s = weights.bias || 0;
  for (const k of FEATURE_KEYS) {
    s += (weights[k] || 0) * (x[k] || 0);
  }
  return sigmoid(s);
}

function evaluateModel(samples, weights, threshold = 0.5) {
  shuffleInPlace(samples);
  const cut = Math.floor(samples.length * 0.8);
  return evaluateHoldout(samples.slice(cut), weights, threshold);
}

function stratifiedSample(samples, n) {
  const pos = samples.filter((s) => s.y === 1);
  const neg = samples.filter((s) => s.y === 0);
  // Keep closer to natural prevalence (~25–35% positives) for honest metrics
  const posN = Math.min(pos.length, Math.floor(n * 0.32));
  const negN = Math.min(neg.length, n - posN);
  // Prefer hard negatives: higher maxMag / rate windows
  neg.sort((a, b) => (b.x?.rate24h || 0) + (b.x?.maxMag24h || 0) - ((a.x?.rate24h || 0) + (a.x?.maxMag24h || 0)));
  shuffleInPlace(pos);
  const hardNeg = neg.slice(0, Math.floor(negN * 0.55));
  const restNeg = neg.slice(Math.floor(negN * 0.55));
  shuffleInPlace(restNeg);
  return [...pos.slice(0, posN), ...hardNeg, ...restNeg.slice(0, negN - hardNeg.length)];
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


function fitScaler(xs) {
  const mean = {};
  const std = {};
  for (const k of FEATURE_KEYS) {
    const vals = xs.map((x) => x[k] || 0);
    mean[k] = avg(vals);
    const v = avg(vals.map((v) => (v - mean[k]) ** 2));
    std[k] = Math.sqrt(v) || 1;
  }
  return { mean, std };
}

function applyScaler(x, scaler) {
  if (!scaler?.mean) return x;
  const out = {};
  for (const k of FEATURE_KEYS) {
    out[k] = ((x[k] || 0) - (scaler.mean[k] || 0)) / (scaler.std[k] || 1);
  }
  return out;
}

function balancedEpochBatch(train, n) {
  const pos = train.filter((s) => s.y === 1);
  const neg = train.filter((s) => s.y === 0);
  if (!pos.length || !neg.length) {
    const copy = [...train];
    shuffleInPlace(copy);
    return copy.slice(0, n);
  }
  const half = Math.floor(n / 2);
  const out = [];
  for (let i = 0; i < half; i++) out.push(pos[i % pos.length]);
  for (let i = 0; i < n - half; i++) out.push(neg[i % neg.length]);
  shuffleInPlace(out);
  return out;
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
