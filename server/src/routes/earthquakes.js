import { Router } from 'express';
import { fetchEarthquakes } from '../services/usgs.js';
import {
  applyFilters,
  computeKpis,
  getAlerts,
  formatEnergy,
  sampleForDisplay,
  buildOverviewSeries,
  buildDepthAnalysis,
  buildRegionalRanking,
  buildTimeline,
} from '../services/analytics.js';
import { analyzePatterns } from '../services/ml.js';
import { DEFAULT_ALERT_THRESHOLD, MAP_DISPLAY_LIMIT } from '../config.js';

const router = Router();

function parseQuery(query) {
  const period = query.period || query.feed || 'day';
  const minMagnitude = query.minMagnitude != null ? Number(query.minMagnitude) : 0;
  const maxDepth =
    query.maxDepth != null && query.maxDepth !== '' ? Number(query.maxDepth) : null;
  const placeQuery = query.place || query.q || '';
  const alertThreshold =
    query.alertThreshold != null
      ? Number(query.alertThreshold)
      : DEFAULT_ALERT_THRESHOLD;

  if (Number.isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
    const err = new Error('minMagnitude must be between 0 and 10');
    err.status = 400;
    throw err;
  }
  if (maxDepth != null && (Number.isNaN(maxDepth) || maxDepth < 0 || maxDepth > 1000)) {
    const err = new Error('maxDepth must be between 0 and 1000');
    err.status = 400;
    throw err;
  }
  if (!['hour', 'day', 'week', 'month'].includes(period)) {
    const err = new Error('period must be one of hour|day|week|month');
    err.status = 400;
    throw err;
  }
  if (Number.isNaN(alertThreshold) || alertThreshold < 0 || alertThreshold > 10) {
    const err = new Error('alertThreshold must be between 0 and 10');
    err.status = 400;
    throw err;
  }

  return { period, minMagnitude, maxDepth, placeQuery, alertThreshold };
}

async function loadFiltered(query) {
  const params = parseQuery(query);
  const feed = await fetchEarthquakes(params.period);
  const events = applyFilters(feed.events, params);
  return { feed, events, params };
}

router.get('/', async (req, res, next) => {
  try {
    const { feed, events, params } = await loadFiltered(req.query);
    const limit = Math.min(
      Number(req.query.limit) || MAP_DISPLAY_LIMIT,
      MAP_DISPLAY_LIMIT,
    );
    const { events: display, sampled } = sampleForDisplay(events, limit);

    res.json({
      period: feed.period,
      label: feed.label,
      generated: feed.generated,
      fetchedAt: feed.fetchedAt,
      cached: feed.cached,
      total: events.length,
      returned: display.length,
      sampled,
      filters: params,
      events: display,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const { feed, events, params } = await loadFiltered(req.query);
    const kpis = computeKpis(events);
    const alerts = getAlerts(events, params.alertThreshold);
    const overview = buildOverviewSeries(events);
    const regions = buildRegionalRanking(events);
    const depth = buildDepthAnalysis(events);

    res.json({
      period: feed.period,
      label: feed.label,
      generated: feed.generated,
      fetchedAt: feed.fetchedAt,
      cached: feed.cached,
      filters: params,
      kpis: {
        ...kpis,
        energyLabel: formatEnergy(kpis.totalEnergyJoules),
      },
      alertCount: alerts.length,
      topAlerts: alerts.slice(0, 5),
      overview,
      regions,
      depth: {
        profiles: depth.profiles,
        depthBins: depth.depthBins,
      },
      executiveSummary: buildExecutiveSummary(kpis, feed.label, alerts.length),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const { feed, events, params } = await loadFiltered(req.query);
    const alerts = getAlerts(events, params.alertThreshold);
    res.json({
      period: feed.period,
      label: feed.label,
      threshold: params.alertThreshold,
      count: alerts.length,
      alerts,
      fetchedAt: feed.fetchedAt,
      cached: feed.cached,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const { feed, events, params } = await loadFiltered(req.query);
    const depth = buildDepthAnalysis(events);
    const regions = buildRegionalRanking(events, 15);
    const timeline = buildTimeline(sampleForDisplay(events, 500).events);
    const overview = buildOverviewSeries(events);
    const ml = analyzePatterns(events);

    res.json({
      period: feed.period,
      label: feed.label,
      fetchedAt: feed.fetchedAt,
      cached: feed.cached,
      filters: params,
      kpis: computeKpis(events),
      overview,
      depth,
      regions,
      timeline,
      patterns: ml,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/patterns', async (req, res, next) => {
  try {
    const { feed, events, params } = await loadFiltered(req.query);
    const patterns = analyzePatterns(events);
    res.json({
      period: feed.period,
      label: feed.label,
      fetchedAt: feed.fetchedAt,
      cached: feed.cached,
      filters: params,
      ...patterns,
    });
  } catch (err) {
    next(err);
  }
});

function buildExecutiveSummary(kpis, timeframe, alertCount) {
  if (!kpis.totalEvents) {
    return 'No events match your filters. Widen the time window or lower the magnitude threshold.';
  }
  const alertText = alertCount
    ? `${alertCount} alert(s) require review.`
    : 'No active high-magnitude alerts.';
  return `${timeframe} — ${kpis.totalEvents.toLocaleString()} earthquakes recorded. Median depth ${kpis.medianDepthKm} km. Peak M ${kpis.largestMagnitude} (${kpis.largestPlace}). Energy ${formatEnergy(kpis.totalEnergyJoules)}. ${alertText}`;
}

export default router;
