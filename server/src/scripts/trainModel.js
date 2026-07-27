/**
 * Offline / CLI training for QuakePulse early-risk model.
 *
 * Usage:
 *   node src/scripts/trainModel.js
 *   node src/scripts/trainModel.js --days 30 --min-mag 2.5
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
const days = Number(arg('--days', '30'));
const minMag = Number(arg('--min-mag', '2.5'));
const feed = arg('--feed', 'month');

console.log('QuakePulse early-risk trainer');
console.log('-----------------------------');

let events;
let datasetMeta;

if (feedOnly || process.argv.includes('--feed')) {
  console.log(`Fetching USGS live feed: ${feed}`);
  const raw = await fetchEarthquakes(feed === true || feed === 'true' ? 'month' : feed);
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
  console.log('Sources: USGS FDSN · USGS feed · EMSC · IRIS · USGS scrape');
  const dl = await downloadTrainingDataset({ days, minMagnitude: minMag, persist: true });
  events = dl.events;
  datasetMeta = dl.meta;
  for (const [id, info] of Object.entries(dl.meta.sources || {})) {
    console.log(`  ${id}: ${info.ok ? `${info.count} events` : `FAIL — ${info.error}`}`);
  }
}

console.log(`Training on ${events.length} merged events…`);
const model = trainRiskModel(events, {
  epochs: Number(arg('--epochs', '28')),
  horizonHours: Number(arg('--horizon', '6')),
  magThreshold: Number(arg('--threshold', '4.5')),
  persist: true,
});
const path = saveModel(model);

console.log(
  JSON.stringify(
    {
      dataset: {
        totalMerged: datasetMeta.totalMerged || events.length,
        sources: datasetMeta.sources || datasetMeta.mode,
        window: datasetMeta.window || null,
      },
      model: {
        trainedAt: model.trainedAt,
        samples: model.samples,
        metrics: model.metrics,
        clusters: model.clusters.length,
        path,
        disclaimer: model.disclaimer,
      },
    },
    null,
    2,
  ),
);
