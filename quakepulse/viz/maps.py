"""Folium map builders."""

from __future__ import annotations

import folium
import pandas as pd
from folium.plugins import HeatMap, MarkerCluster

from quakepulse.config import COLORS


def _magnitude_color(magnitude: float) -> str:
    if magnitude < 2.5:
        return COLORS["low_mag"]
    if magnitude < 5.0:
        return COLORS["med_mag"]
    return COLORS["high_mag"]


def create_cluster_map(df: pd.DataFrame) -> folium.Map:
    """Build an interactive clustered earthquake map."""
    m = folium.Map(location=[20, 0], zoom_start=2, tiles="CartoDB positron", control_scale=True)
    marker_cluster = MarkerCluster(name="Earthquake events").add_to(m)

    if df.empty:
        return m

    for row in df.itertuples(index=False):
        color = _magnitude_color(row.Magnitude)
        popup = folium.Popup(
            f"""
            <div style="font-family:Segoe UI,Arial,sans-serif;min-width:200px">
              <strong style="color:{COLORS['navy']}">{row.Place}</strong><br>
              <b>Magnitude:</b> {row.Magnitude:.1f}<br>
              <b>Depth:</b> {row.Depth:.1f} km<br>
              <b>Time (UTC):</b> {row.Time.strftime('%Y-%m-%d %H:%M')}
            </div>
            """,
            max_width=280,
        )
        folium.CircleMarker(
            location=[row.Latitude, row.Longitude],
            radius=max(4, row.SizeScaled / 3),
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.75,
            weight=1,
            popup=popup,
        ).add_to(marker_cluster)

    folium.LayerControl().add_to(m)
    return m


def create_heatmap(df: pd.DataFrame) -> folium.Map:
    """Build a global seismic density heatmap."""
    m = folium.Map(location=[20, 0], zoom_start=2, tiles="CartoDB dark_matter", control_scale=True)

    if not df.empty:
        heat_data = df[["Latitude", "Longitude", "Magnitude"]].values.tolist()
        HeatMap(
            heat_data,
            radius=12,
            blur=14,
            min_opacity=0.35,
            max_zoom=10,
            gradient={
                0.2: "#1B2A4A",
                0.4: "#00A3A1",
                0.6: "#FB8C00",
                1.0: "#E53935",
            },
        ).add_to(m)

    return m
