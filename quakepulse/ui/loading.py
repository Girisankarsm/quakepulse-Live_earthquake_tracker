"""Branded loading states and skeleton UI."""

from __future__ import annotations

import streamlit as st

from quakepulse.config import get_colors


LOAD_STEPS = [
    "Connecting to USGS seismic feed",
    "Parsing earthquake events",
    "Computing analytics & KPIs",
    "Rendering dashboard",
]


def render_branded_loader(step: int = 0, message: str | None = None) -> None:
    """Full-width branded loader with animated progress."""
    c = get_colors()
    idx = min(step, len(LOAD_STEPS) - 1)
    label = message or LOAD_STEPS[idx]
    pct = int(((idx + 1) / len(LOAD_STEPS)) * 100)

    steps_html = "".join(
        f'<div class="qp-load-step{" qp-load-step-active" if i <= idx else ""}">'
        f'<span class="qp-load-step-dot"></span>{text}</div>'
        for i, text in enumerate(LOAD_STEPS)
    )

    st.markdown(
        f"""
        <div class="qp-loader">
            <div class="qp-loader-ring"></div>
            <div class="qp-loader-core">🌐</div>
            <p class="qp-loader-title">QuakePulse</p>
            <p class="qp-loader-msg">{label}…</p>
            <div class="qp-loader-bar"><div class="qp-loader-fill" style="width:{pct}%"></div></div>
            <div class="qp-load-steps">{steps_html}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_skeleton_kpis() -> None:
    """Shimmer placeholder KPI row."""
    cols = st.columns(5, gap="small")
    for col in cols:
        with col:
            st.markdown(
                """
                <div class="qp-skeleton qp-skeleton-kpi">
                    <div class="qp-skel-line qp-skel-sm"></div>
                    <div class="qp-skel-line qp-skel-lg"></div>
                    <div class="qp-skel-line qp-skel-md"></div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def render_skeleton_panel(height: int = 280) -> None:
    """Shimmer chart/map placeholder."""
    st.markdown(
        f'<div class="qp-skeleton qp-skeleton-chart" style="height:{height}px"></div>',
        unsafe_allow_html=True,
    )


def render_refresh_badge() -> None:
    """Subtle indicator for background auto-refresh (not first load)."""
    st.markdown(
        '<div class="qp-refresh-badge"><span class="qp-refresh-spin"></span> Syncing feed</div>',
        unsafe_allow_html=True,
    )


def render_loaded_wrapper_start() -> None:
    """Open fade-in content wrapper."""
    st.markdown('<div class="qp-loaded">', unsafe_allow_html=True)


def render_loaded_wrapper_end() -> None:
    """Close fade-in content wrapper."""
    st.markdown("</div>", unsafe_allow_html=True)
