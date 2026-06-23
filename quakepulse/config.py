"""Application configuration and constants."""

from __future__ import annotations

USGS_FEEDS: dict[str, str] = {
    "Last Hour": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    "Last Day": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    "Last 7 Days": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
    "Last 30 Days": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
}

REQUEST_TIMEOUT_SECONDS = 15
CACHE_TTL_SECONDS = 60
AUTO_REFRESH_SECONDS = 60
DEFAULT_ALERT_THRESHOLD = 5.0

# Enterprise palette — navy foundation with signal accents
COLORS = {
    "navy": "#1B2A4A",
    "navy_light": "#243B5C",
    "orange": "#E87722",
    "orange_dark": "#C45F12",
    "teal": "#00A3A1",
    "slate": "#5C6B7A",
    "bg": "#F4F6F9",
    "card": "#FFFFFF",
    "border": "#DDE3EA",
    "text": "#1A2332",
    "text_muted": "#6B7C93",
    "success": "#2E7D32",
    "warning": "#ED6C02",
    "danger": "#C62828",
    "low_mag": "#43A047",
    "med_mag": "#FB8C00",
    "high_mag": "#E53935",
}

MAG_BINS = [0, 2.5, 5, 10]
MAG_LABELS = ["Low", "Medium", "High"]

MAG_CATEGORY_BINS = [0, 3, 6, 9, 12]
MAG_CATEGORY_LABELS = ["Minor", "Moderate", "Strong", "Severe"]

APP_TITLE = "QuakePulse"
APP_SUBTITLE = "Global Seismic Intelligence Platform"
DATA_SOURCE = "USGS Earthquake Hazards Program"
