"""Folium map builders."""

from __future__ import annotations

import folium
import pandas as pd
from folium.plugins import HeatMap, MarkerCluster

from quakepulse.config import get_colors


def _magnitude_color(magnitude: float, colors: dict[str, str]) -> str:
    if magnitude < 2.5:
        return colors["low_mag"]
    if magnitude < 5.0:
        return colors["med_mag"]
    return colors["high_mag"]


def create_cluster_map(df: pd.DataFrame, colors: dict[str, str] | None = None) -> folium.Map:
    """Build an interactive clustered earthquake map."""
    c = colors or get_colors()
    m = folium.Map(location=[20, 0], zoom_start=2, tiles="CartoDB positron", control_scale=True)
    marker_cluster = MarkerCluster(name="Events").add_to(m)

    if df.empty:
        return m

    for row in df.itertuples(index=False):
        color = _magnitude_color(row.Magnitude, c)
        popup = folium.Popup(
            f"""
            <div style="font-family:Inter,system-ui,sans-serif;min-width:200px;line-height:1.5">
              <strong style="color:{c['text']}">{row.Place}</strong><br>
              <span style="color:{c['text_muted']}">
                M {row.Magnitude:.1f} · {row.Depth:.1f} km<br>
                {row.Time.strftime('%Y-%m-%d %H:%M UTC')}
              </span>
            </div>
            """,
            max_width=280,
        )
        folium.CircleMarker(
            location=[row.Latitude, row.Longitude],
            radius=max(4, row.SizeScaled / 3),
            color=color, fill=True, fill_color=color,
            fill_opacity=0.8, weight=1, popup=popup,
        ).add_to(marker_cluster)

    folium.LayerControl().add_to(m)
    return m


def create_heatmap(df: pd.DataFrame, colors: dict[str, str] | None = None) -> folium.Map:
    """Build a global seismic density heatmap."""
    c = colors or get_colors()
    m = folium.Map(location=[20, 0], zoom_start=2, tiles="CartoDB positron", control_scale=True)

    if not df.empty:
        HeatMap(
            df[["Latitude", "Longitude", "Magnitude"]].values.tolist(),
            radius=14, blur=16, min_opacity=0.3, max_zoom=10,
            gradient={0.2: c["accent"], 0.5: c["violet"], 0.75: c["warning"], 1.0: c["danger"]},
        ).add_to(m)

    return m
