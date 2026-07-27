# QuakePulse — Global Seismic Intelligence Platform

[![CI](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

Enterprise-grade live earthquake monitoring — mobile-first React UI, Express intelligence API, depth analytics, ML activity-risk nowcasting, and seismic news.

## Overview

QuakePulse transforms USGS (and multi-catalog) earthquake data into a polished seismic intelligence workspace: executive KPIs, clustered maps, depth profiles, threshold alerts, regional news, and a lightweight early-activity risk model.

## Features

| Capability | Description |
|------------|-------------|
| **Mobile-first UI** | Bottom nav · filter sheet · responsive desktop rail |
| **Live pipeline** | USGS GeoJSON · 60s server cache · auto-refresh |
| **Executive KPIs** | Events, magnitude, energy, shallow ratio |
| **Workspace** | Overview · Map · Analytics · Alerts · News · Data |
| **Depth analysis** | Bin profiles, scatter, crustal vs deep insights |
| **ML patterns** | Logistic early-activity risk · regional forecasts · anomalies · k-means clusters |
| **News** | USGS / GDACS / Google News seismic coverage |
| **Export** | One-click CSV |
| **Resilient API** | Timeouts, rate limits, typed errors |

## Architecture

```
quakepulse/
├── client/                 # React + Vite + Leaflet + Recharts
├── server/                 # Express API
│   └── src/
│       ├── routes/         # earthquakes · news · ml · meta
│       ├── services/       # usgs · analytics · ml · news · datasets
│       └── middleware/     # rate limit · errors
└── .github/workflows/      # CI
```

## Quick Start

```bash
npm install
npm run dev
```

- Client: http://localhost:5173  
- API: http://localhost:3001  

Production:

```bash
npm run build
npm start
```

## Train pattern model

```bash
# From live USGS feed
npm run train -- --feed week

# Multi-catalog download (USGS · EMSC · IRIS)
npm run train -- --days 30 --min-mag 2.5
```

## Tests

```bash
npm test
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/earthquakes/summary` | KPIs + overview series |
| `GET /api/earthquakes` | Filtered event list |
| `GET /api/earthquakes/analytics` | Depth, regions, ML patterns |
| `GET /api/earthquakes/alerts` | Threshold alerts |
| `GET /api/news` | Seismic news (`?region=`) |
| `GET /api/ml/model` | Persisted model metadata |
| `GET /api/ml/patterns` | Pattern + risk analysis |
| `GET /api/ml/predict` | Near-term regional risk forecast |

Query params (earthquakes): `period`, `minMagnitude`, `maxDepth`, `place`, `alertThreshold`.

## Tech Stack

- **Frontend:** React 19, Vite, Leaflet, Recharts
- **Backend:** Node.js, Express, node-cache, rss-parser
- **ML:** Pure-JS logistic early-activity risk + k-means (no paid APIs)
- **Sources:** [USGS](https://earthquake.usgs.gov/fdsnws/event/1/), EMSC, IRIS

## Disclaimer

For informational and analytical purposes only. Not intended for operational emergency response. The ML module nowcasts elevated short-horizon activity risk — it does **not** predict exact earthquake timing or location.

## License

MIT
