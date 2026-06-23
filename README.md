# QuakePulse — Global Seismic Intelligence Platform

[![CI](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Girisankarsm/quakepulse-Live_earthquake_tracker/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![Streamlit](https://img.shields.io/badge/streamlit-1.39%2B-red.svg)](https://streamlit.io)

Enterprise-grade live earthquake monitoring dashboard powered by USGS real-time feeds.

**[Live Demo](https://quakepulse-liveearthquaketracker.streamlit.app/)**

## Overview

QuakePulse transforms USGS earthquake data into a polished seismic intelligence platform — glass UI, executive KPIs, geospatial analytics, and exportable event registries. Built with modular architecture, automated tests, and CI.

## Features

| Capability | Description |
|------------|-------------|
| **Dark glass UI** | FAANG-inspired glassmorphism — dark theme only |
| **Live pipeline** | USGS GeoJSON feeds · 60s cache · true auto-refresh |
| **Executive KPIs** | Events, magnitude, energy, shallow-event ratio |
| **Tabbed workspace** | Overview · Map · Analytics · Alerts · Data |
| **Smart sampling** | Handles 30-day feeds smoothly; M≥4.0 always preserved |
| **Advanced filters** | Magnitude, depth, location search, alert threshold |
| **Geospatial** | Clustered map + density heatmap |
| **Analytics** | Histograms, 3D plots, trends, regional rankings |
| **Data export** | One-click CSV download |
| **CI/CD** | GitHub Actions on every push |
| **Resilient fetch** | 15s timeouts, typed errors, graceful degradation |

## Architecture

```
quakepulse/
├── app.py                 # Streamlit entry point
├── quakepulse/
│   ├── config.py          # Themes, feeds, limits
│   ├── data/              # fetcher · parser · analytics
│   ├── viz/               # maps · charts · theme
│   └── ui/                # glass CSS · components
├── tests/                 # Unit tests (pytest)
└── .github/workflows/     # CI pipeline
```

## Quick Start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Open **http://localhost:8501**

## Run Tests

```bash
pytest tests/ -v
```

## Tech Stack

- **Dashboard:** Streamlit, streamlit-autorefresh
- **Maps:** Folium, streamlit-folium
- **Charts:** Plotly
- **Data:** Pandas, Requests
- **CI:** GitHub Actions
- **Source:** [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/)

## Configuration

Key settings in `quakepulse/config.py`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `CACHE_TTL_SECONDS` | 60 | Data cache lifetime |
| `AUTO_REFRESH_SECONDS` | 60 | Auto-refresh interval |
| `MAP_DISPLAY_LIMIT` | 2000 | Max map markers |
| `ANIMATION_LIMIT` | 500 | Max animation frames |
| `REQUEST_TIMEOUT_SECONDS` | 15 | USGS API timeout |

## Disclaimer

For informational and analytical purposes only. Not intended for operational emergency response.

## License

MIT
