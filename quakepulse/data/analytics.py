"""Analytics, filtering, and KPI computation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from quakepulse.config import MAG_BINS, MAG_CATEGORY_BINS, MAG_CATEGORY_LABELS, MAG_LABELS


@dataclass(frozen=True)
class EarthquakeKPIs:
    """Summary metrics for the executive dashboard."""

    total_events: int
    average_magnitude: float
    median_depth_km: float
    largest_magnitude: float
    largest_place: str
    significant_events: int
    total_energy_joules: float
    shallow_events_pct: float


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived columns used across visualizations."""
    if df.empty:
        return df

    enriched = df.copy()
    enriched["Magnitude"] = enriched["Magnitude"].clip(lower=0)
    enriched["SizeScaled"] = (enriched["Magnitude"] + 0.3) * 5
    enriched["Energy_J"] = 10 ** (1.5 * enriched["Magnitude"] + 4.8)
    enriched["MagRange"] = pd.cut(
        enriched["Magnitude"],
        bins=MAG_BINS,
        labels=MAG_LABELS,
        include_lowest=True,
    )
    enriched["MagCategory"] = pd.cut(
        enriched["Magnitude"],
        bins=MAG_CATEGORY_BINS,
        labels=MAG_CATEGORY_LABELS,
        include_lowest=True,
    )
    enriched["DepthCategory"] = pd.cut(
        enriched["Depth"],
        bins=[-1, 70, 300, 10000],
        labels=["Shallow", "Intermediate", "Deep"],
    )
    return enriched


def apply_filters(
    df: pd.DataFrame,
    min_magnitude: float,
    max_depth: float | None,
    place_query: str,
) -> pd.DataFrame:
    """Apply user-selected filters to the earthquake dataset."""
    if df.empty:
        return df

    filtered = df[df["Magnitude"] >= min_magnitude].copy()

    if max_depth is not None:
        filtered = filtered[filtered["Depth"] <= max_depth]

    query = place_query.strip().lower()
    if query:
        filtered = filtered[filtered["Place"].str.lower().str.contains(query, na=False)]

    return filtered


def compute_kpis(df: pd.DataFrame, significant_threshold: float = 4.5) -> EarthquakeKPIs:
    """Compute executive summary KPIs."""
    if df.empty:
        return EarthquakeKPIs(0, 0.0, 0.0, 0.0, "—", 0, 0.0, 0.0)

    largest_idx = df["Magnitude"].idxmax()
    largest = df.loc[largest_idx]
    shallow_pct = (df["Depth"] < 70).mean() * 100

    return EarthquakeKPIs(
        total_events=len(df),
        average_magnitude=float(df["Magnitude"].mean()),
        median_depth_km=float(df["Depth"].median()),
        largest_magnitude=float(largest["Magnitude"]),
        largest_place=str(largest["Place"]),
        significant_events=int((df["Magnitude"] >= significant_threshold).sum()),
        total_energy_joules=float(df["Energy_J"].sum()),
        shallow_events_pct=float(shallow_pct),
    )


def get_alerts(df: pd.DataFrame, threshold: float) -> pd.DataFrame:
    """Return earthquakes at or above the alert magnitude threshold."""
    if df.empty:
        return df
    return (
        df[df["Magnitude"] >= threshold]
        .sort_values("Magnitude", ascending=False)
        .reset_index(drop=True)
    )


def format_energy(joules: float) -> str:
    """Human-readable seismic energy string."""
    if joules >= 1e18:
        return f"{joules / 1e18:.2f} EJ"
    if joules >= 1e15:
        return f"{joules / 1e15:.2f} PJ"
    if joules >= 1e12:
        return f"{joules / 1e12:.2f} TJ"
    if joules >= 1e9:
        return f"{joules / 1e9:.2f} GJ"
    return f"{joules:,.0f} J"


def sample_for_display(df: pd.DataFrame, limit: int = 1500) -> tuple[pd.DataFrame, bool]:
    """
    Downsample large datasets for map/chart rendering.
    Always retains events at or above M4.0.
    """
    if df.empty or len(df) <= limit:
        return df, False

    strong = df[df["Magnitude"] >= 4.0]
    remainder = df[df["Magnitude"] < 4.0]
    slots = max(0, limit - len(strong))

    if len(remainder) > slots:
        remainder = remainder.sample(n=slots, random_state=42)

    sampled = pd.concat([strong, remainder]).sort_values("Time").reset_index(drop=True)
    return sampled, True
