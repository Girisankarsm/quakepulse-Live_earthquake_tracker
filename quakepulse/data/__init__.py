"""Data layer — fetch, parse, and analyze earthquake feeds."""

from quakepulse.data.analytics import (
    apply_filters,
    compute_kpis,
    enrich_dataframe,
    get_alerts,
)
from quakepulse.data.fetcher import fetch_earthquake_data
from quakepulse.data.parser import earthquakes_to_df

__all__ = [
    "apply_filters",
    "compute_kpis",
    "enrich_dataframe",
    "fetch_earthquake_data",
    "earthquakes_to_df",
    "get_alerts",
]
