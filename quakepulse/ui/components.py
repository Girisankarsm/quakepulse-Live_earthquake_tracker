"""Reusable Streamlit UI components."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from quakepulse.config import (
    APP_SUBTITLE,
    APP_TITLE,
    AUTO_REFRESH_SECONDS,
    COLORS,
    DATA_SOURCE,
    DEFAULT_ALERT_THRESHOLD,
    USGS_FEEDS,
)
from quakepulse.data.analytics import EarthquakeKPIs, format_energy


def render_header() -> None:
    st.markdown(
        f"""
        <div class="qp-header">
            <h1>{APP_TITLE} <span class="qp-accent">Intelligence</span></h1>
            <p>{APP_SUBTITLE} · Real-time global seismic monitoring & analytics</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_bar(last_updated: datetime | None, event_count: int, timeframe: str) -> None:
    updated_str = (
        last_updated.strftime("%Y-%m-%d %H:%M:%S UTC") if last_updated else "—"
    )
    col1, col2, col3 = st.columns([2, 2, 2])
    with col1:
        st.markdown(
            '<span class="qp-status-live"><span class="qp-status-dot"></span> LIVE</span>',
            unsafe_allow_html=True,
        )
    with col2:
        st.caption(f"**Last refresh:** {updated_str}")
    with col3:
        st.caption(f"**Window:** {timeframe} · **Events:** {event_count:,}")


def render_kpi_row(kpis: EarthquakeKPIs) -> None:
    cols = st.columns(5)
    metrics = [
        ("Total Events", f"{kpis.total_events:,}", "Recorded in selected window"),
        ("Avg Magnitude", f"{kpis.average_magnitude:.2f}", "Mean across all events"),
        ("Largest Event", f"M {kpis.largest_magnitude:.1f}", kpis.largest_place[:40]),
        ("Significant (≥4.5)", f"{kpis.significant_events:,}", "Potentially felt events"),
        (
            "Total Energy",
            format_energy(kpis.total_energy_joules),
            f"{kpis.shallow_events_pct:.0f}% shallow (<70 km)",
        ),
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


def render_executive_summary(kpis: EarthquakeKPIs, timeframe: str, alert_count: int) -> None:
    if kpis.total_events == 0:
        st.markdown(
            '<div class="qp-summary">No seismic events match the current filters. '
            "Adjust the timeframe or filter criteria to broaden the analysis window.</div>",
            unsafe_allow_html=True,
        )
        return

    alert_text = (
        f"<strong style='color:{COLORS['danger']}'>{alert_count} high-magnitude alert(s)</strong> require attention."
        if alert_count
        else "No high-magnitude alerts are active for the current threshold."
    )
    st.markdown(
        f"""
        <div class="qp-summary">
            <strong>Executive Summary</strong> — Over the <em>{timeframe.lower()}</em> window,
            <strong>{kpis.total_events:,}</strong> earthquakes were detected globally with a median depth of
            <strong>{kpis.median_depth_km:.1f} km</strong>. The strongest event reached
            <strong>M {kpis.largest_magnitude:.1f}</strong> near {kpis.largest_place}.
            Combined seismic energy is estimated at <strong>{format_energy(kpis.total_energy_joules)}</strong>.
            {alert_text}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_sidebar_controls() -> dict:
    """Render sidebar and return user control values."""
    st.sidebar.markdown("### Control Panel")
    st.sidebar.markdown("Configure data window, filters, and refresh behavior.")

    timeframe = st.sidebar.selectbox("Analysis window", list(USGS_FEEDS.keys()), index=1)
    mag_threshold = st.sidebar.slider(
        "Alert threshold (M)",
        0.0,
        10.0,
        DEFAULT_ALERT_THRESHOLD,
        0.1,
    )
    min_magnitude = st.sidebar.slider("Minimum magnitude filter", 0.0, 8.0, 0.0, 0.1)
    max_depth = st.sidebar.slider("Maximum depth (km)", 0, 700, 700, 10)
    place_query = st.sidebar.text_input("Location search", placeholder="e.g. Japan, California")
    auto_refresh = st.sidebar.toggle("Auto-refresh", value=True)

    st.sidebar.divider()
    st.sidebar.markdown("### Data governance")
    st.sidebar.caption(
        f"Source: **{DATA_SOURCE}**  \n"
        f"Refresh interval: **{AUTO_REFRESH_SECONDS}s**  \n"
        "Energy estimates use the Gutenberg–Richter relation."
    )

    return {
        "timeframe": timeframe,
        "feed_url": USGS_FEEDS[timeframe],
        "mag_threshold": mag_threshold,
        "min_magnitude": min_magnitude,
        "max_depth": float(max_depth),
        "place_query": place_query,
        "auto_refresh": auto_refresh,
    }


def render_alert_banner(alerts: pd.DataFrame) -> None:
    if alerts.empty:
        st.success("All clear — no earthquakes exceed the alert threshold.")
        return

    st.error(f"**{len(alerts)} active alert(s)** — magnitude at or above threshold")
    for row in alerts.head(8).itertuples(index=False):
        st.markdown(
            f"""
            <div class="qp-alert-critical">
                <strong>M {row.Magnitude:.1f}</strong> · {row.Place}<br>
                <small>Depth {row.Depth:.1f} km · {row.Time.strftime('%Y-%m-%d %H:%M UTC')}</small>
            </div>
            """,
            unsafe_allow_html=True,
        )
    if len(alerts) > 8:
        st.caption(f"+ {len(alerts) - 8} additional alert(s) in the data explorer.")


def render_data_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No records to display.")
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
        label="Export to CSV",
        data=csv,
        file_name=f"quakepulse_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        type="primary",
    )


def render_footer() -> None:
    st.markdown(
        f"""
        <div class="qp-footer">
            {APP_TITLE} v2.0 · Data: {DATA_SOURCE} ·
            For informational purposes only · Not for operational emergency response
        </div>
        """,
        unsafe_allow_html=True,
    )
