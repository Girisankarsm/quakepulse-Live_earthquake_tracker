# QuakePulse — Global Seismic Intelligence Platform

Enterprise-grade live earthquake monitoring dashboard powered by USGS real-time feeds.

**[Live Demo](https://quakepulse-liveearthquaketracker.streamlit.app/)**

## Overview

QuakePulse is a professional seismic intelligence platform that transforms USGS earthquake data into actionable executive dashboards. Built with a modular architecture and PwC-inspired design language, it delivers real-time monitoring, geospatial analysis, and exportable event registries.

## Features

| Capability | Description |
|------------|-------------|
| **Live data pipeline** | USGS GeoJSON feeds with 60s cache and true auto-refresh |
| **Executive KPIs** | Total events, magnitude stats, energy release, shallow-event ratio |
| **Tabbed workspace** | Overview · Geospatial · Analytics · Alerts · Data Explorer |
| **Advanced filters** | Magnitude, depth, location search, configurable alert threshold |
| **Geospatial** | Clustered event map + density heatmap |
| **Analytics** | Histograms, 3D plots, trend charts, regional rankings |
| **Data export** | One-click CSV download from the event registry |
| **Resilient fetch** | Request timeouts, typed errors, graceful degradation |

## Architecture

```
quakepulse/
├── app.py                 # Streamlit entry point
├── quakepulse/
│   ├── config.py          # Constants, palette, feed URLs
│   ├── data/
│   │   ├── fetcher.py     # USGS API client
│   │   ├── parser.py      # GeoJSON → DataFrame
│   │   └── analytics.py   # KPIs, filters, alerts
│   ├── viz/
│   │   ├── maps.py        # Folium map builders
│   │   ├── charts.py      # Plotly visualizations
│   │   └── theme.py       # Enterprise chart styling
│   └── ui/
│       ├── styles.py      # Custom CSS
│       └── components.py  # Reusable UI blocks
└── tests/                 # Unit tests
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
- **Source:** [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/)

## Configuration

Key settings in `quakepulse/config.py`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `CACHE_TTL_SECONDS` | 60 | Data cache lifetime |
| `AUTO_REFRESH_SECONDS` | 60 | Dashboard auto-refresh interval |
| `REQUEST_TIMEOUT_SECONDS` | 15 | USGS API timeout |
| `DEFAULT_ALERT_THRESHOLD` | 5.0 | Default M alert level |

## Disclaimer

For informational and analytical purposes only. Not intended for operational emergency response. Always refer to official government seismic agencies for safety-critical decisions.

## License

MIT
