import { Router } from 'express';
import { fetchEarthquakes } from '../services/usgs.js';
import { applyFilters } from '../services/analytics.js';
import {
  analyzePatterns,
  loadModel,
  predictRisk,
  trainRiskModel,
} from '../services/ml.js';
import {
  downloadTrainingDataset,
  loadPersistedDataset,
} from '../services/datasets.js';

const router = Router();

function parsePeriod(query) {
  return query.period || query.feed || 'week';
}

router.get('/model', (_req, res) => {
  const model = loadModel();
  res.json({
    loaded: Boolean(model.trainedAt),
    version: model.version,
    trainedAt: model.trainedAt,
    samples: model.samples,
    eventCount: model.eventCount || null,
    metrics: model.metrics,
    horizonHours: model.horizonHours || 6,
    features: model.features || [],
    disclaimer: model.disclaimer,
  });
});

router.get('/patterns', async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const retrain = req.query.retrain === '1' || req.query.retrain === 'true';
    const feed = await fetchEarthquakes(period);
    const events = applyFilters(feed.events, {
      minMagnitude: req.query.minMagnitude != null ? Number(req.query.minMagnitude) : 0,
      maxDepth:
        req.query.maxDepth != null && req.query.maxDepth !== ''
          ? Number(req.query.maxDepth)
          : null,
      placeQuery: req.query.place || '',
    });

    let model = loadModel();
    if (retrain || !model.trainedAt) {
      model = trainRiskModel(events, { persist: Boolean(retrain), forcePersist: Boolean(retrain) });
    }

    const patterns = analyzePatterns(events, model);
    res.json({
      period: feed.period,
      fetchedAt: feed.fetchedAt,
      count: events.length,
      ...patterns,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/predict', async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const feed = await fetchEarthquakes(period);
    const events = applyFilters(feed.events, {
      minMagnitude: req.query.minMagnitude != null ? Number(req.query.minMagnitude) : 0,
      placeQuery: req.query.place || '',
    });
    let model = loadModel();
    if (!model.trainedAt) {
      model = trainRiskModel(events, { persist: false });
    }
    const prediction = predictRisk(events, model);
    res.json({
      period: feed.period,
      fetchedAt: feed.fetchedAt,
      count: events.length,
      ...prediction,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/train', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.body?.days) || 90, 7), 120);
    const minMagnitude = Number(req.body?.minMagnitude) || 2.5;
    const useCache = req.body?.useCache === true;
    const feedOnly = req.body?.feedOnly === true;

    let events;
    let datasetMeta = null;

    if (feedOnly) {
      const period = req.body?.feed || req.body?.period || 'month';
      const feed = await fetchEarthquakes(period);
      events = feed.events;
      datasetMeta = { mode: 'live-feed', period, count: events.length };
    } else if (useCache) {
      const cached = await loadPersistedDataset();
      if (cached?.events?.length) {
        events = cached.events;
        datasetMeta = { ...cached.meta, fromDisk: true };
      }
    }

    if (!events?.length) {
      const downloaded = await downloadTrainingDataset({
        days,
        minMagnitude,
        persist: true,
      });
      events = downloaded.events;
      datasetMeta = downloaded.meta;
    }

    const model = trainRiskModel(events, {
      epochs: Number(req.body?.epochs) || 24,
      horizonHours: Number(req.body?.horizonHours) || 6,
      magThreshold: Number(req.body?.magThreshold) || 4.0,
      persist: true,
      forcePersist: true,
    });

    res.json({
      ok: true,
      dataset: datasetMeta,
      model: {
        version: model.version,
        trainedAt: model.trainedAt,
        samples: model.samples,
        eventCount: model.eventCount,
        metrics: model.metrics,
        horizonHours: model.horizonHours,
        clusters: model.clusters?.length || 0,
        disclaimer: model.disclaimer,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/download', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.body?.days) || 30, 7), 90);
    const minMagnitude = Number(req.body?.minMagnitude) || 2.5;
    const result = await downloadTrainingDataset({ days, minMagnitude, persist: true });
    res.json({
      ok: true,
      meta: result.meta,
      count: result.events.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
