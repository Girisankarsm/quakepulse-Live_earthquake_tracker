"""Reusable Streamlit UI components."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from quakepulse import __version__
from quakepulse.config import (
    APP_SUBTITLE,
    APP_TITLE,
    AUTO_REFRESH_SECONDS,
    DATA_SOURCE,
    DEFAULT_ALERT_THRESHOLD,
    USGS_FEEDS,
    get_colors,
)
from quakepulse.data.analytics import EarthquakeKPIs, format_energy


def render_header() -> None:
    st.markdown(
        f"""
        <div class="qp-header">
            <div class="qp-brand">
                <div class="qp-logo">🌐</div>
                <div>
                    <h1>{APP_TITLE}<span class="qp-version">v{__version__}</span></h1>
                    <p>{APP_SUBTITLE} · Live seismic monitoring & analytics</p>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_bar(
    last_updated: datetime | None,
    event_count: int,
    timeframe: str,
    *,
    feed_ok: bool = True,
) -> None:
    updated_str = last_updated.strftime("%Y-%m-%d %H:%M UTC") if last_updated else "—"
    feed_chip = "Feed healthy" if feed_ok else "Feed degraded"
    st.markdown(
        f"""
        <div class="qp-status-row">
            <span class="qp-chip qp-chip-live">
                <span class="qp-status-dot"></span> Live
            </span>
            <span class="qp-chip">{feed_chip}</span>
            <span class="qp-chip">Refreshed {updated_str}</span>
            <span class="qp-chip">{timeframe}</span>
            <span class="qp-chip">{event_count:,} events</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpi_row(kpis: EarthquakeKPIs) -> None:
    cols = st.columns(5, gap="medium")
    metrics = [
        ("Total Events", f"{kpis.total_events:,}", "In selected window"),
        ("Avg Magnitude", f"{kpis.average_magnitude:.2f}", "Mean across events"),
        ("Largest Event", f"M {kpis.largest_magnitude:.1f}", kpis.largest_place[:42]),
        ("Significant", f"{kpis.significant_events:,}", "Events ≥ M4.5"),
        ("Energy", format_energy(kpis.total_energy_joules), f"{kpis.shallow_events_pct:.0f}% shallow"),
    ]
    for col, (label, value, sub) in zip(cols, metrics):
        with col:
            st.markdown(
                f"""
                <div class="qp-kpi-card">
                    <div class="qp-kpi-label">{label}</div>
                    <div class="qp-kpi-value">{value}</div>
                    <div class="qp-kpi-sub">{sub}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def render_executive_summary(
    kpis: EarthquakeKPIs,
    timeframe: str,
    alert_count: int,
    colors: dict[str, str],
) -> None:
    if kpis.total_events == 0:
        st.markdown(
            '<div class="qp-summary">No seismic events match your filters. '
            "Try widening the time window or lowering the magnitude threshold.</div>",
            unsafe_allow_html=True,
        )
        return

    alert_text = (
        f"<strong style='color:{colors['danger']}'>{alert_count} alert(s)</strong> above threshold."
        if alert_count
        else "No active high-magnitude alerts."
    )
    st.markdown(
        f"""
        <div class="qp-summary">
            <strong>Insight</strong> · In the <em>{timeframe.lower()}</em> window,
            <strong>{kpis.total_events:,}</strong> earthquakes were recorded (median depth
            <strong>{kpis.median_depth_km:.1f} km</strong>). Peak magnitude
            <strong>M {kpis.largest_magnitude:.1f}</strong> near {kpis.largest_place}.
            Estimated energy <strong>{format_energy(kpis.total_energy_joules)}</strong>. {alert_text}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_section_title(title: str, subtitle: str = "", colors: dict[str, str] | None = None) -> None:
    c = colors or get_colors("light")
    sub = (
        f'<span style="color:{c["text_muted"]};font-weight:400;font-size:0.88rem"> · {subtitle}</span>'
        if subtitle
        else ""
    )
    st.markdown(f'<p class="qp-section-title">{title}{sub}</p>', unsafe_allow_html=True)


def render_sample_notice(was_sampled: bool, total: int, shown: int) -> None:
    if was_sampled:
        st.caption(f"Showing {shown:,} of {total:,} events for performance. All M≥4.0 events are included.")


def render_sidebar_controls() -> dict:
    """Render sidebar and return user control values."""
    st.sidebar.markdown("### Appearance")
    theme = st.sidebar.radio("Theme", ["Light", "Dark"], horizontal=True, label_visibility="collapsed")
    theme_key = theme.lower()

    st.sidebar.divider()
    st.sidebar.markdown("### Controls")
    st.sidebar.caption("Filters apply instantly across all tabs.")

    timeframe = st.sidebar.selectbox("Time window", list(USGS_FEEDS.keys()), index=1)
    mag_threshold = st.sidebar.slider("Alert threshold (M)", 0.0, 10.0, DEFAULT_ALERT_THRESHOLD, 0.1)
    min_magnitude = st.sidebar.slider("Min magnitude", 0.0, 8.0, 0.0, 0.1)
    max_depth = st.sidebar.slider("Max depth (km)", 0, 700, 700, 10)
    place_query = st.sidebar.text_input("Search location", placeholder="Japan, California…")
    auto_refresh = st.sidebar.toggle("Auto-refresh", value=True)

    st.sidebar.divider()
    with st.sidebar.expander("Methodology", expanded=False):
        st.caption(
            "**Data:** USGS GeoJSON summary feeds  \n"
            "**Energy:** Gutenberg–Richter relation  \n"
            "**Sampling:** Maps cap at 2,000 points; M≥4.0 always shown  \n"
            "**Refresh:** 60s cache + optional live auto-refresh"
        )

    st.sidebar.caption(f"Source: **{DATA_SOURCE}** · every **{AUTO_REFRESH_SECONDS}s**")

    return {
        "theme": theme_key,
        "timeframe": timeframe,
        "feed_url": USGS_FEEDS[timeframe],
        "mag_threshold": mag_threshold,
        "min_magnitude": min_magnitude,
        "max_depth": float(max_depth),
        "place_query": place_query,
        "auto_refresh": auto_refresh,
    }


def render_alert_banner(alerts: pd.DataFrame, colors: dict[str, str]) -> None:
    if alerts.empty:
        st.success("All clear — nothing above your alert threshold.")
        return

    st.error(f"**{len(alerts)} active alert(s)** detected")
    for row in alerts.head(8).itertuples(index=False):
        st.markdown(
            f"""
            <div class="qp-alert-critical">
                <strong>M {row.Magnitude:.1f}</strong> · {row.Place}<br>
                <small style="color:{colors['text_muted']}">
                    {row.Depth:.1f} km deep · {row.Time.strftime('%Y-%m-%d %H:%M UTC')}
                </small>
            </div>
            """,
            unsafe_allow_html=True,
        )
    if len(alerts) > 8:
        st.caption(f"+ {len(alerts) - 8} more in Data tab")


def render_data_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No records to show.")
        return

    display = df[
        ["Time", "Magnitude", "Depth", "Place", "Latitude", "Longitude", "Status"]
    ].sort_values("Time", ascending=False)
    display["Time"] = display["Time"].dt.strftime("%Y-%m-%d %H:%M UTC")

    st.dataframe(
        display,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Magnitude": st.column_config.NumberColumn(format="%.1f"),
            "Depth": st.column_config.NumberColumn("Depth (km)", format="%.1f"),
            "Latitude": st.column_config.NumberColumn(format="%.4f"),
            "Longitude": st.column_config.NumberColumn(format="%.4f"),
        },
    )

    csv = display.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="↓ Export CSV",
        data=csv,
        file_name=f"quakepulse_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        type="primary",
    )


def render_footer() -> None:
    st.markdown(
        f"""
        <div class="qp-footer">
            {APP_TITLE} v{__version__} · {DATA_SOURCE} · Informational use only — not for emergency response
        </div>
        """,
        unsafe_allow_html=True,
    )
