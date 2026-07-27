# QuakePulse — Global Seismic Intelligence Platform

[![CI](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-teal.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://react.dev/)

**QuakePulse v3** — mobile-first live earthquake intelligence built with **Node.js + React** (Streamlit retired).

## Features

| Capability | Description |
|------------|-------------|
| **Mobile-first UI** | Bottom nav · filter drawer · large tap targets · desktop sidebar |
| **Live USGS pipeline** | Hour / day / week / month feeds · 60s cache · auto-refresh |
| **Deep analytics** | Temporal patterns · depth profiles · regional rankings · energy curves |
| **ML pattern engine** | Logistic early-activity risk model · k-means cells · anomaly detection |
| **News tab** | Google News + USGS + GDACS stories matched to active regions |
| **Alerts & export** | Threshold monitor · CSV event registry |
| **Hardened API** | Rate limiting · timeouts · typed errors · graceful cache fallback |

## Quick start

```bash
npm install
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:3001  

Production:

```bash
npm run build
npm start
```

Train the risk model:

```bash
npm run train -w server -- --feed day
# or multi-catalog download:
npm run train -w server -- --days 30 --min-mag 2.5
```

## Architecture

```
├── server/                 Express API
│   └── src/
│       ├── services/       USGS · analytics · ML · news · datasets
│       ├── routes/         earthquakes · ml · news · meta
│       └── scripts/        model training CLI
├── client/                 React + Vite mobile UI
│   └── src/
│       ├── pages/          Overview · Map · Analytics · News · Alerts · Data
│       ├── components/     Map · charts · filters · nav
│       └── hooks/          Live data pipeline
└── .github/workflows/      CI (test + build)
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/meta` | App metadata & nav |
| `GET /api/earthquakes` | Filtered events |
| `GET /api/earthquakes/summary` | KPIs + overview series |
| `GET /api/earthquakes/analytics` | Deep analytics + ML patterns |
| `GET /api/earthquakes/alerts` | Threshold alerts |
| `GET /api/ml/patterns` | Clusters, risk, anomalies |
| `POST /api/ml/train` | Retrain early-risk model |
| `GET /api/news` | Regional / global seismic news |

Query params: `period` (`hour`\|`day`\|`week`\|`month`), `minMagnitude`, `maxDepth`, `place`, `alertThreshold`.

## App tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | KPIs, trends, energy, pattern insights |
| **Map** | Clustered Leaflet map + depth scatter |
| **Analytics** | Depth, regions, ML risk & anomalies |
| **Alerts** | Magnitude threshold monitor |
| **News** | Area-matched earthquake journalism |
| **Data** | Event registry + CSV export |

## Tech stack

- **Backend:** Node.js, Express, node-cache, rss-parser
- **Frontend:** React 19, Vite, Recharts, Leaflet + marker clustering
- **ML:** In-process logistic early-activity risk model + k-means + z-score anomalies
- **Data:** USGS feeds · optional USGS/EMSC/IRIS FDSN for training
- **News:** Google News RSS · USGS Newsroom · GDACS

## Tests

```bash
npm test
```

## Disclaimer

For informational and analytical purposes only. Not intended for operational emergency response. The ML module is a short-horizon activity nowcast — not a deterministic earthquake predictor.

## License

MIT
