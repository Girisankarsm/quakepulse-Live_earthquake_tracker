import { Router } from 'express';
import { fetchEarthquakes } from '../services/usgs.js';
import { applyFilters } from '../services/analytics.js';
import { fetchNews, matchNewsToEvents } from '../services/news.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const region = String(req.query.region || req.query.place || '').slice(0, 80);
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 50);
    const period = req.query.period || 'day';
    const minMagnitude =
      req.query.minMagnitude != null ? Number(req.query.minMagnitude) : 0;

    const data = await fetchNews({ region, limit });

    let events = [];
    try {
      const feed = await fetchEarthquakes(period);
      events = applyFilters(feed.events, {
        minMagnitude,
        placeQuery: region,
      }).slice(0, 200);
    } catch {
      // news still useful without event linking
    }

    const items = matchNewsToEvents(data.items || [], events).map((item) => {
      const relatedEvents = events
        .filter((e) => {
          if (!item.matchedRegion) return false;
          return (e.region || '').toLowerCase() === String(item.matchedRegion).toLowerCase();
        })
        .filter((e) => e.magnitude >= 4)
        .slice(0, 2)
        .map((e) => ({
          id: e.id,
          magnitude: e.magnitude,
          place: e.place,
          time: e.time,
        }));
      return { ...item, relatedEvents };
    });

    res.json({
      ...data,
      region: region || null,
      count: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
