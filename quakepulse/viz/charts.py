"""Plotly chart builders with glass dashboard styling."""

from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from quakepulse.config import get_colors
from quakepulse.viz.theme import apply_enterprise_theme


def _c(colors: dict[str, str] | None) -> dict[str, str]:
    return colors or get_colors()


def magnitude_histogram(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    fig = px.histogram(
        df, x="Magnitude", color="MagRange", nbins=25,
        color_discrete_map={"Low": c["low_mag"], "Medium": c["med_mag"], "High": c["high_mag"]},
    )
    fig.update_layout(barmode="overlay")
    fig.update_traces(opacity=0.82)
    return apply_enterprise_theme(fig, "Magnitude distribution", c)


def depth_magnitude_scatter(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    fig = px.scatter(
        df, x="Depth", y="Magnitude", color="Magnitude",
        color_continuous_scale=[[0, c["accent"]], [0.5, c["violet"]], [1, c["danger"]]],
        hover_data=["Place", "Time"],
    )
    fig.update_coloraxes(colorbar_title="Mag")
    return apply_enterprise_theme(fig, "Depth vs magnitude", c)


def cumulative_energy_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    sorted_df = df.sort_values("Time")
    sorted_df = sorted_df.assign(Cumulative_Energy=sorted_df["Energy_J"].cumsum())
    fig = px.area(sorted_df, x="Time", y="Cumulative_Energy",
                  labels={"Cumulative_Energy": "Energy (J)", "Time": "Time (UTC)"})
    fig.update_traces(line_color=c["accent"], fillcolor=c["accent_glow"])
    return apply_enterprise_theme(fig, "Cumulative seismic energy", c)


def time_series_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    fig = px.scatter(df, x="Time", y="Magnitude", color="Depth", size="SizeScaled",
                     color_continuous_scale="Turbo", hover_data=["Place"])
    return apply_enterprise_theme(fig, "Event timeline", c)


def scatter_3d_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    fig = px.scatter_3d(
        df, x="Time", y="Depth", z="Magnitude", color="Magnitude",
        color_continuous_scale=[[0, c["accent"]], [0.5, c["violet"]], [1, c["danger"]]],
        hover_data=["Place"], height=520,
    )
    return apply_enterprise_theme(fig, "3D · time, depth & magnitude", c, height=520)


def animated_map_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    frame_df = df.copy()
    frame_df["Frame"] = frame_df["Time"].dt.strftime("%Y-%m-%d %H:%M")
    fig = px.scatter(
        frame_df, x="Longitude", y="Latitude", size="SizeScaled", color="Magnitude",
        animation_frame="Frame", range_x=[-180, 180], range_y=[-90, 90],
        color_continuous_scale=[[0, c["accent"]], [1, c["danger"]]],
        hover_data=["Place", "Depth"],
    )
    return apply_enterprise_theme(fig, "Animated global activity", c, height=480)


def depth_box_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    fig = px.box(
        df, x="MagCategory", y="Depth", color="MagCategory",
        color_discrete_sequence=[c["low_mag"], c["med_mag"], c["warning"], c["danger"]],
    )
    fig.update_layout(showlegend=False)
    return apply_enterprise_theme(fig, "Depth by magnitude category", c)


def top_regions_chart(df: pd.DataFrame, n: int = 10, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    top_places = df["Place"].value_counts().nlargest(n).reset_index()
    top_places.columns = ["Place", "Count"]
    fig = px.bar(top_places, x="Count", y="Place", orientation="h", color="Count",
                 color_continuous_scale=[[0, c["accent"]], [1, c["violet"]]])
    fig.update_layout(yaxis={"categoryorder": "total ascending"})
    return apply_enterprise_theme(fig, f"Top {n} regions", c)


def magnitude_trend_chart(df: pd.DataFrame, colors: dict[str, str] | None = None) -> go.Figure:
    c = _c(colors)
    hourly = (
        df.set_index("Time").resample("1h")["Magnitude"]
        .agg(["max", "count"]).reset_index()
        .rename(columns={"max": "Max Magnitude", "count": "Event Count"})
    )
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=hourly["Time"], y=hourly["Max Magnitude"], mode="lines+markers",
        name="Max magnitude", line=dict(color=c["accent"], width=2.5),
        marker=dict(size=5, color=c["accent"]),
    ))
    fig.add_trace(go.Bar(
        x=hourly["Time"], y=hourly["Event Count"], name="Event count",
        marker_color=c["accent_glow"], yaxis="y2",
    ))
    themed = apply_enterprise_theme(fig, "Hourly activity trend", c)
    themed.update_layout(yaxis2=dict(
        title="Events", overlaying="y", side="right", showgrid=False,
        tickfont=dict(color=c["text_muted"]),
    ))
    return themed
