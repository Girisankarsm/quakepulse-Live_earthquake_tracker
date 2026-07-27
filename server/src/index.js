import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT, APP } from './config.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import earthquakesRouter from './routes/earthquakes.js';
import newsRouter from './routes/news.js';
import metaRouter from './routes/meta.js';
import mlRouter from './routes/ml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180 }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use('/api', metaRouter);
app.use('/api/earthquakes', earthquakesRouter);
app.use('/api/news', newsRouter);
app.use('/api/ml', mlRouter);

app.use(express.static(clientDist, { index: false, maxAge: '1h' }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(503).json({
        error: true,
        message: 'Client not built. Run npm run build in development, or use Vite proxy.',
        code: 'CLIENT_MISSING',
      });
    }
  });
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`${APP.name} v${APP.version} · API http://localhost:${PORT}`);
});

export default app;
