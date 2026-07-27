import { Router } from 'express';
import { fetchNews } from '../services/news.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const region = String(req.query.region || req.query.place || '').slice(0, 80);
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 50);
    const data = await fetchNews({ region, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
