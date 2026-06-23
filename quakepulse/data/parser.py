"""Parse USGS GeoJSON features into structured tabular data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd


def earthquakes_to_df(eq_list: list[dict[str, Any]]) -> pd.DataFrame:
    """Convert USGS GeoJSON feature list to a normalized DataFrame."""
    records: list[dict[str, Any]] = []

    for eq in eq_list:
        props = eq.get("properties") or {}
        geometry = eq.get("geometry") or {}
        coordinates = geometry.get("coordinates") or [None, None, None]

        mag = props.get("mag")
        magnitude = float(mag) if mag is not None else 0.0

        time_ms = props.get("time")
        if time_ms is None:
            continue

        records.append(
            {
                "ID": eq.get("id", ""),
                "Magnitude": magnitude,
                "Depth": float(coordinates[2]) if coordinates[2] is not None else 0.0,
                "Place": props.get("place") or "Unknown location",
                "Time": datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc),
                "Latitude": float(coordinates[1]) if coordinates[1] is not None else 0.0,
                "Longitude": float(coordinates[0]) if coordinates[0] is not None else 0.0,
                "Status": props.get("status") or "unknown",
                "Type": props.get("type") or "earthquake",
                "Url": props.get("url") or "",
            }
        )

    if not records:
        return pd.DataFrame(
            columns=[
                "ID",
                "Magnitude",
                "Depth",
                "Place",
                "Time",
                "Latitude",
                "Longitude",
                "Status",
                "Type",
                "Url",
            ]
        )

    return pd.DataFrame(records)
