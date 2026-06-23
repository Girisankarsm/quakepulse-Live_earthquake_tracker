"""Shared Plotly theme for enterprise dashboards."""

from __future__ import annotations

import plotly.graph_objects as go

from quakepulse.config import COLORS


def enterprise_layout(title: str, height: int | None = 420) -> dict:
    """Return a consistent Plotly layout dict."""
    layout: dict = {
        "title": {
            "text": title,
            "font": {"size": 16, "color": COLORS["text"], "family": "Segoe UI, Arial, sans-serif"},
            "x": 0,
            "xanchor": "left",
        },
        "paper_bgcolor": COLORS["card"],
        "plot_bgcolor": COLORS["card"],
        "font": {"family": "Segoe UI, Arial, sans-serif", "color": COLORS["text"], "size": 12},
        "margin": {"l": 48, "r": 24, "t": 56, "b": 48},
        "legend": {
            "orientation": "h",
            "yanchor": "bottom",
            "y": 1.02,
            "xanchor": "right",
            "x": 1,
            "font": {"size": 11},
        },
        "xaxis": {
            "gridcolor": COLORS["border"],
            "linecolor": COLORS["border"],
            "zerolinecolor": COLORS["border"],
        },
        "yaxis": {
            "gridcolor": COLORS["border"],
            "linecolor": COLORS["border"],
            "zerolinecolor": COLORS["border"],
        },
        "hoverlabel": {
            "bgcolor": COLORS["navy"],
            "font": {"color": "#FFFFFF", "size": 12},
        },
    }
    if height is not None:
        layout["height"] = height
    return layout


def apply_enterprise_theme(fig: go.Figure, title: str, height: int | None = 420) -> go.Figure:
    """Apply enterprise styling to any Plotly figure."""
    fig.update_layout(**enterprise_layout(title, height))
    return fig
