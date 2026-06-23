"""Shared Plotly theme — glass dashboard aesthetic."""

from __future__ import annotations

import plotly.graph_objects as go

from quakepulse.config import get_colors


def enterprise_layout(title: str, colors: dict[str, str], height: int | None = 420) -> dict:
    """Return a consistent Plotly layout dict."""
    layout: dict = {
        "title": {
            "text": title,
            "font": {
                "size": 15,
                "color": colors["text"],
                "family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            },
            "x": 0,
            "xanchor": "left",
        },
        "paper_bgcolor": "rgba(255,255,255,0)",
        "plot_bgcolor": colors["plot_bg"],
        "font": {
            "family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            "color": colors["text"],
            "size": 12,
        },
        "margin": {"l": 44, "r": 20, "t": 52, "b": 44},
        "legend": {
            "orientation": "h",
            "yanchor": "bottom",
            "y": 1.02,
            "xanchor": "right",
            "x": 1,
            "font": {"size": 11, "color": colors["text_muted"]},
            "bgcolor": "rgba(255,255,255,0)",
        },
        "xaxis": {
            "gridcolor": colors["grid"],
            "linecolor": colors["border_soft"],
            "zerolinecolor": colors["grid"],
            "tickfont": {"color": colors["text_muted"], "size": 11},
        },
        "yaxis": {
            "gridcolor": colors["grid"],
            "linecolor": colors["border_soft"],
            "zerolinecolor": colors["grid"],
            "tickfont": {"color": colors["text_muted"], "size": 11},
        },
        "hoverlabel": {
            "bgcolor": colors["navy"],
            "bordercolor": "rgba(255,255,255,0.1)",
            "font": {"color": "#FFFFFF", "size": 12, "family": "Inter, sans-serif"},
        },
    }
    if height is not None:
        layout["height"] = height
    return layout


def apply_enterprise_theme(
    fig: go.Figure,
    title: str,
    colors: dict[str, str] | None = None,
    height: int | None = 420,
) -> go.Figure:
    """Apply glass dashboard styling to any Plotly figure."""
    palette = colors or get_colors("light")
    fig.update_layout(**enterprise_layout(title, palette, height))
    return fig
