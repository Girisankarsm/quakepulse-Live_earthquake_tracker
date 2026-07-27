import { Router } from 'express';
import {
  APP,
  AUTO_REFRESH_OPTIONS,
  AUTO_REFRESH_SECONDS,
  CACHE_TTL_SECONDS,
  NEWS_CACHE_TTL_SECONDS,
  USGS_FEEDS,
} from '../config.js';

const router = Router();
const startedAt = Date.now();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: APP.name,
    version: APP.version,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    feeds: Object.keys(USGS_FEEDS),
  });
});

router.get('/meta', (_req, res) => {
  res.json({
    ...APP,
    feeds: Object.entries(USGS_FEEDS).map(([id, f]) => ({ id, label: f.label })),
    refresh: {
      defaultSeconds: AUTO_REFRESH_SECONDS,
      optionsSeconds: AUTO_REFRESH_OPTIONS,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      newsCacheTtlSeconds: NEWS_CACHE_TTL_SECONDS,
    },
    nav: [
      { id: 'overview', label: 'Overview', description: 'KPIs & trends' },
      { id: 'map', label: 'Map', description: 'Geospatial intelligence' },
      { id: 'analytics', label: 'Analytics', description: 'Depth & patterns' },
      { id: 'predict', label: 'Predict', description: 'Early activity risk' },
      { id: 'alerts', label: 'Alerts', description: 'Threshold monitor' },
      { id: 'news', label: 'News', description: 'Regional coverage' },
      { id: 'data', label: 'Data', description: 'Registry & export' },
    ],
    ml: {
      version: '3.0.0',
      endpoints: [
        '/api/ml/model',
        '/api/ml/predict',
        '/api/ml/patterns',
        '/api/ml/train',
        '/api/ml/auto-train',
      ],
      autoTrain: true,
      disclaimer:
        'Short-horizon elevated activity nowcast from multi-catalog seismicity — not deterministic earthquake prediction.',
    },
  });
});

export default router;
