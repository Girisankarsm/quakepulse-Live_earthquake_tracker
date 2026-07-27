/**
 * Offline / CLI training for QuakePulse early-risk model.
 *
 * Usage:
 *   node src/scripts/trainModel.js
 *   node src/scripts/trainModel.js --days 90 --min-mag 2.5 --epochs 45
 *   node src/scripts/trainModel.js --cache
 *   node src/scripts/trainModel.js --feed week
 */

import { downloadTrainingDataset, loadPersistedDataset } from '../services/datasets.js';
import { trainRiskModel, saveModel } from '../services/ml.js';
import { fetchEarthquakes } from '../services/usgs.js';

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const feedOnly = process.argv.includes('--feed');
const useCache = process.argv.includes('--cache');
const days = Number(arg('--days', '120'));
const minMag = Number(arg('--min-mag', '2.0'));
const feed = arg('--feed', 'month');
const epochs = Number(arg('--epochs', '50'));
const horizon = Number(arg('--horizon', '6'));
const threshold = Number(arg('--threshold', '4.0'));

console.log('QuakePulse early-risk trainer v3');
console.log('--------------------------------');

let events;
let datasetMeta;

if (feedOnly || (process.argv.includes('--feed') && !useCache)) {
  const period = feed === true || feed === 'true' ? 'month' : feed;
  console.log(`Fetching USGS live feed: ${period}`);
  const raw = await fetchEarthquakes(period);
  events = raw.events;
  datasetMeta = { mode: 'feed', period: raw.period, count: events.length };
} else if (useCache) {
  const cached = await loadPersistedDataset();
  if (!cached?.events?.length) {
    console.log('No cached dataset — downloading…');
    const dl = await downloadTrainingDataset({ days, minMagnitude: minMag, persist: true });
    events = dl.events;
    datasetMeta = dl.meta;
  } else {
    events = cached.events;
    datasetMeta = { ...cached.meta, fromDisk: true };
    console.log(`Loaded cached dataset: ${events.length} events`);
  }
} else {
  console.log(`Downloading multi-catalog dataset (days=${days}, minM=${minMag})…`);
  console.log('Sources: USGS FDSN (chunked) · USGS feeds · USGS significant · EMSC (chunked)');
  const dl = await downloadTrainingDataset({ days, minMagnitude: minMag, persist: true });
  events = dl.events;
  datasetMeta = dl.meta;
  for (const [id, info] of Object.entries(dl.meta.sources || {})) {
    console.log(`  ${id}: ${info.ok ? `${info.count} events` : `FAIL — ${info.error}`}`);
  }
}

console.log(`Training on ${events.length} merged events · epochs=${epochs} · horizon=${horizon}h · M≥${threshold}`);
const started = Date.now();
const model = trainRiskModel(events, {
  epochs,
  horizonHours: horizon,
  magThreshold: threshold,
  persist: true,
  forcePersist: true,
  maxSamples: 30_000,
});
const path = saveModel(model);
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);

console.log(
  JSON.stringify(
    {
      dataset: {
        totalMerged: datasetMeta.totalMerged || events.length,
        sources: datasetMeta.sources || datasetMeta.mode,
        window: datasetMeta.window || null,
      },
      model: {
        version: model.version,
        trainedAt: model.trainedAt,
        samples: model.samples,
        trainSamples: model.trainSamples,
        metrics: model.metrics,
        threshold: model.threshold,
        features: model.features?.length,
        clusters: model.clusters.length,
        path,
        disclaimer: model.disclaimer,
      },
    },
    null,
    2,
  ),
);
