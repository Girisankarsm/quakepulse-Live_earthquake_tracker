"""Plotly chart builders with enterprise styling."""

from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from quakepulse.config import COLORS
from quakepulse.viz.theme import apply_enterprise_theme


def magnitude_histogram(df: pd.DataFrame) -> go.Figure:
    fig = px.histogram(
        df,
        x="Magnitude",
        color="MagRange",
        nbins=25,
        color_discrete_map={
            "Low": COLORS["low_mag"],
            "Medium": COLORS["med_mag"],
            "High": COLORS["high_mag"],
        },
    )
    fig.update_layout(barmode="overlay")
    fig.update_traces(opacity=0.85)
    return apply_enterprise_theme(fig, "Magnitude Distribution")


def depth_magnitude_scatter(df: pd.DataFrame) -> go.Figure:
    fig = px.scatter(
        df,
        x="Depth",
        y="Magnitude",
        color="Magnitude",
        color_continuous_scale=[[0, COLORS["teal"]], [0.5, COLORS["orange"]], [1, COLORS["danger"]]],
        hover_data=["Place", "Time"],
    )
    fig.update_coloraxes(colorbar_title="Mag")
    return apply_enterprise_theme(fig, "Depth vs Magnitude")


def cumulative_energy_chart(df: pd.DataFrame) -> go.Figure:
    sorted_df = df.sort_values("Time")
    sorted_df = sorted_df.assign(Cumulative_Energy=sorted_df["Energy_J"].cumsum())
    fig = px.area(
        sorted_df,
        x="Time",
        y="Cumulative_Energy",
        labels={"Cumulative_Energy": "Energy (J)", "Time": "Time (UTC)"},
    )
    fig.update_traces(line_color=COLORS["teal"], fillcolor="rgba(0,163,161,0.25)")
    return apply_enterprise_theme(fig, "Cumulative Seismic Energy Released")


def time_series_chart(df: pd.DataFrame) -> go.Figure:
    fig = px.scatter(
        df,
        x="Time",
        y="Magnitude",
        color="Depth",
        size="SizeScaled",
        color_continuous_scale="Turbo",
        hover_data=["Place"],
    )
    return apply_enterprise_theme(fig, "Earthquake Timeline")


def scatter_3d_chart(df: pd.DataFrame) -> go.Figure:
    fig = px.scatter_3d(
        df,
        x="Time",
        y="Depth",
        z="Magnitude",
        color="Magnitude",
        color_continuous_scale=[[0, COLORS["navy"]], [0.5, COLORS["orange"]], [1, COLORS["danger"]]],
        hover_data=["Place"],
        height=520,
    )
    return apply_enterprise_theme(fig, "3D View — Time, Depth & Magnitude", height=520)


def animated_map_chart(df: pd.DataFrame) -> go.Figure:
    frame_df = df.copy()
    frame_df["Frame"] = frame_df["Time"].dt.strftime("%Y-%m-%d %H:%M")
    fig = px.scatter(
        frame_df,
        x="Longitude",
        y="Latitude",
        size="SizeScaled",
        color="Magnitude",
        animation_frame="Frame",
        range_x=[-180, 180],
        range_y=[-90, 90],
        color_continuous_scale=[[0, COLORS["teal"]], [1, COLORS["danger"]]],
        hover_data=["Place", "Depth"],
    )
    fig.update_layout(geo=dict(projection_type="natural earth"))
    return apply_enterprise_theme(fig, "Animated Global Activity", height=480)


def depth_box_chart(df: pd.DataFrame) -> go.Figure:
    fig = px.box(
        df,
        x="MagCategory",
        y="Depth",
        color="MagCategory",
        color_discrete_sequence=[COLORS["low_mag"], COLORS["med_mag"], COLORS["orange"], COLORS["danger"]],
    )
    fig.update_layout(showlegend=False)
    return apply_enterprise_theme(fig, "Depth Distribution by Magnitude Category")


def top_regions_chart(df: pd.DataFrame, n: int = 10) -> go.Figure:
    top_places = df["Place"].value_counts().nlargest(n).reset_index()
    top_places.columns = ["Place", "Count"]
    fig = px.bar(
        top_places,
        x="Count",
        y="Place",
        orientation="h",
        color="Count",
        color_continuous_scale=[[0, COLORS["navy_light"]], [1, COLORS["orange"]]],
    )
    fig.update_layout(yaxis={"categoryorder": "total ascending"})
    return apply_enterprise_theme(fig, f"Top {n} Regions by Event Frequency")


def magnitude_trend_chart(df: pd.DataFrame) -> go.Figure:
    """Hourly max magnitude trend for executive overview."""
    hourly = (
        df.set_index("Time")
        .resample("1h")["Magnitude"]
        .agg(["max", "count"])
        .reset_index()
        .rename(columns={"max": "Max Magnitude", "count": "Event Count"})
    )
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=hourly["Time"],
            y=hourly["Max Magnitude"],
            mode="lines+markers",
            name="Max Magnitude",
            line=dict(color=COLORS["orange"], width=2),
            marker=dict(size=5),
        )
    )
    fig.add_trace(
        go.Bar(
            x=hourly["Time"],
            y=hourly["Event Count"],
            name="Event Count",
            marker_color="rgba(27,42,74,0.35)",
            yaxis="y2",
        )
    )
    themed = apply_enterprise_theme(fig, "Hourly Seismic Activity Trend")
    themed.update_layout(
        yaxis2=dict(
            title="Events",
            overlaying="y",
            side="right",
            showgrid=False,
            gridcolor=COLORS["border"],
        )
    )
    return themed
