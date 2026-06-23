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

MAP_DISPLAY_LIMIT = 2000
ANIMATION_LIMIT = 500
CHART_SAMPLE_LIMIT = 3000

# PwC-inspired dark executive palette
THEMES: dict[str, dict[str, str]] = {
    "dark": {
        "brand": "#D04A02",
        "brand_soft": "rgba(208, 74, 2, 0.15)",
        "accent": "#D04A02",
        "accent_soft": "#E87722",
        "accent_glow": "rgba(208, 74, 2, 0.22)",
        "violet": "#B45309",
        "navy": "#1A1A1A",
        "navy_light": "#2D2D2D",
        "slate": "#A3A3A3",
        "bg_start": "#141414",
        "bg_mid": "#1A1A1A",
        "bg_end": "#1F1F1F",
        "glass": "rgba(255, 255, 255, 0.04)",
        "glass_strong": "rgba(255, 255, 255, 0.08)",
        "glass_sidebar": "rgba(20, 20, 20, 0.96)",
        "border": "rgba(255, 255, 255, 0.10)",
        "border_soft": "rgba(255, 255, 255, 0.06)",
        "text": "#F5F5F5",
        "text_muted": "#A3A3A3",
        "text_on_dark": "#F5F5F5",
        "plot_bg": "rgba(26, 26, 26, 0.6)",
        "grid": "rgba(163, 163, 163, 0.12)",
        "success": "#34D399",
        "warning": "#FBBF24",
        "danger": "#F87171",
        "low_mag": "#4ADE80",
        "med_mag": "#FBBF24",
        "high_mag": "#F87171",
        "shadow": "0 4px 24px rgba(0, 0, 0, 0.35)",
        "shadow_lg": "0 12px 40px rgba(0, 0, 0, 0.45)",
    },
}

COLORS = THEMES["dark"]
DEFAULT_THEME = "dark"

MAP_HEIGHT_DESKTOP = 520
MAP_HEIGHT_MOBILE = 340


def get_colors(theme: str = DEFAULT_THEME) -> dict[str, str]:
    """Return the active PwC executive dark palette."""
    return THEMES["dark"]


MAG_BINS = [0, 2.5, 5, 10]
MAG_LABELS = ["Low", "Medium", "High"]

MAG_CATEGORY_BINS = [0, 3, 6, 9, 12]
MAG_CATEGORY_LABELS = ["Minor", "Moderate", "Strong", "Severe"]

APP_TITLE = "QuakePulse"
APP_SUBTITLE = "Global Seismic Intelligence"
APP_TAGLINE = "Executive seismic monitoring & risk analytics"
DATA_SOURCE = "USGS Earthquake Hazards Program"

NAV_SECTIONS = [
    ("Overview", "Executive summary & trends"),
    ("Map", "Geospatial event intelligence"),
    ("Analytics", "Depth, magnitude & regional patterns"),
    ("Alerts", "Threshold-based notifications"),
    ("Data", "Event registry & export"),
]
