import path from 'path';
import { fileURLToPath } from 'url';

const __configDir = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 3001;

export const USGS_FEEDS = {
  hour: {
    label: 'Last Hour',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  },
  day: {
    label: 'Last Day',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  },
  week: {
    label: 'Last 7 Days',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  },
  month: {
    label: 'Last 30 Days',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
  },
};

/** USGS feed cache — keep ≤ client refresh so soft polls can see fresh data. */
export const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 30;
export const NEWS_CACHE_TTL_SECONDS = Number(process.env.NEWS_CACHE_TTL_SECONDS) || 120;
export const REQUEST_TIMEOUT_MS = 15000;
export const DEFAULT_ALERT_THRESHOLD = 5.0;
export const SIGNIFICANT_THRESHOLD = 4.5;
export const MAP_DISPLAY_LIMIT = 2000;

/** Client auto-refresh defaults (seconds). */
export const AUTO_REFRESH_SECONDS = Number(process.env.AUTO_REFRESH_SECONDS) || 15;
export const AUTO_REFRESH_OPTIONS = [15, 30, 60, 120];

/** Free global catalog endpoints for ML training / enrichment. */
export const DATA_SOURCES = {
  usgsFdsn: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  usgsFeedMonth:
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
  usgsM25Month:
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson',
  usgsM45Month:
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson',
  usgsSignificantFeed:
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
  emscFdsn: 'https://www.seismicportal.eu/fdsnws/event/1/query',
  usgsSignificantHtml: 'https://earthquake.usgs.gov/earthquakes/browse/significant.php',
};

export const DATASET_DIR = path.resolve(__configDir, '../data');
export const MODEL_DIR = path.resolve(__configDir, '../models');
export const MODEL_VERSION = '3.1.0';

/** Auto collect→train loop (network catalogs → retrain). Default ON; set AUTO_TRAIN=0 to disable. */
export const AUTO_TRAIN_ENABLED =
  process.env.AUTO_TRAIN !== '0' && process.env.AUTO_TRAIN !== 'false';

export const AUTO_TRAIN_INTERVAL_MS = Math.max(
  15 * 60_000,
  Number(process.env.AUTO_TRAIN_INTERVAL_MS) || 60 * 60_000, // default 1 hour
);
export const AUTO_TRAIN_DAYS = Math.min(
  180,
  Math.max(7, Number(process.env.AUTO_TRAIN_DAYS) || 120),
);
export const AUTO_TRAIN_MIN_MAG = Number(process.env.AUTO_TRAIN_MIN_MAG) || 2.0;
export const AUTO_TRAIN_EPOCHS = Number(process.env.AUTO_TRAIN_EPOCHS) || 50;
export const AUTO_TRAIN_ON_BOOT =
  process.env.AUTO_TRAIN_ON_BOOT !== '0' && process.env.AUTO_TRAIN_ON_BOOT !== 'false';
export const AUTO_TRAIN_BOOT_DELAY_MS = Number(process.env.AUTO_TRAIN_BOOT_DELAY_MS) || 20_000;

export const APP = {
  name: 'QuakePulse',
  subtitle: 'Global Seismic Intelligence',
  version: '3.0.0',
  source: 'USGS · EMSC (multi-catalog)',
};
