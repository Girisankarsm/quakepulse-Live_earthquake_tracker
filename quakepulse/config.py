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

THEMES: dict[str, dict[str, str]] = {
    "light": {
        "accent": "#2563EB",
        "accent_soft": "#60A5FA",
        "accent_glow": "rgba(37, 99, 235, 0.18)",
        "violet": "#7C3AED",
        "navy": "#0F172A",
        "navy_light": "#1E293B",
        "slate": "#475569",
        "bg_start": "#EEF2FF",
        "bg_mid": "#F0F9FF",
        "bg_end": "#F5F3FF",
        "glass": "rgba(255, 255, 255, 0.58)",
        "glass_strong": "rgba(255, 255, 255, 0.78)",
        "glass_sidebar": "rgba(15, 23, 42, 0.72)",
        "border": "rgba(255, 255, 255, 0.65)",
        "border_soft": "rgba(148, 163, 184, 0.28)",
        "text": "#0F172A",
        "text_muted": "#64748B",
        "text_on_dark": "#F1F5F9",
        "plot_bg": "rgba(248, 250, 252, 0.45)",
        "grid": "rgba(148, 163, 184, 0.2)",
        "success": "#10B981",
        "warning": "#F59E0B",
        "danger": "#EF4444",
        "low_mag": "#22C55E",
        "med_mag": "#F59E0B",
        "high_mag": "#EF4444",
        "shadow": "0 8px 32px rgba(15, 23, 42, 0.08)",
        "shadow_lg": "0 20px 50px rgba(15, 23, 42, 0.12)",
    },
    "dark": {
        "accent": "#60A5FA",
        "accent_soft": "#93C5FD",
        "accent_glow": "rgba(96, 165, 250, 0.22)",
        "violet": "#A78BFA",
        "navy": "#0B1120",
        "navy_light": "#1E293B",
        "slate": "#94A3B8",
        "bg_start": "#0B1120",
        "bg_mid": "#111827",
        "bg_end": "#1E1B4B",
        "glass": "rgba(255, 255, 255, 0.06)",
        "glass_strong": "rgba(255, 255, 255, 0.10)",
        "glass_sidebar": "rgba(8, 12, 24, 0.88)",
        "border": "rgba(255, 255, 255, 0.12)",
        "border_soft": "rgba(148, 163, 184, 0.18)",
        "text": "#F1F5F9",
        "text_muted": "#94A3B8",
        "text_on_dark": "#F1F5F9",
        "plot_bg": "rgba(15, 23, 42, 0.55)",
        "grid": "rgba(148, 163, 184, 0.12)",
        "success": "#34D399",
        "warning": "#FBBF24",
        "danger": "#F87171",
        "low_mag": "#4ADE80",
        "med_mag": "#FBBF24",
        "high_mag": "#F87171",
        "shadow": "0 8px 32px rgba(0, 0, 0, 0.35)",
        "shadow_lg": "0 20px 50px rgba(0, 0, 0, 0.45)",
    },
}

# Default palette (dark-only product theme)
COLORS = THEMES["dark"]
DEFAULT_THEME = "dark"


def get_colors(theme: str = DEFAULT_THEME) -> dict[str, str]:
    """Return the active color palette (dark theme)."""
    return THEMES["dark"]


MAG_BINS = [0, 2.5, 5, 10]
MAG_LABELS = ["Low", "Medium", "High"]

MAG_CATEGORY_BINS = [0, 3, 6, 9, 12]
MAG_CATEGORY_LABELS = ["Minor", "Moderate", "Strong", "Severe"]

APP_TITLE = "QuakePulse"
APP_SUBTITLE = "Global Seismic Intelligence"
DATA_SOURCE = "USGS Earthquake Hazards Program"
