"""Reusable Streamlit UI components — PwC executive layout."""

from __future__ import annotations

import html
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from quakepulse import __version__
from quakepulse.config import (
    APP_SUBTITLE,
    APP_TAGLINE,
    APP_TITLE,
    AUTO_REFRESH_SECONDS,
    DATA_SOURCE,
    DEFAULT_ALERT_THRESHOLD,
    USGS_FEEDS,
    get_colors,
)
from quakepulse.data.analytics import EarthquakeKPIs, format_energy


def render_topbar() -> None:
    st.markdown(
        """
        <div class="qp-topbar">
            <div class="qp-breadcrumb">
                Home / <strong>Seismic Intelligence</strong> / Live Dashboard
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_header() -> None:
    st.markdown(
        f"""
        <div class="qp-header">
            <div class="qp-brand">
                <div class="qp-logo">🌐</div>
                <div>
                    <h1>{APP_TITLE}<span class="qp-version">v{__version__}</span></h1>
                    <p>{APP_SUBTITLE}<br>{APP_TAGLINE}</p>
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
    updated_str = last_updated.strftime("%H:%M UTC") if last_updated else "—"
    feed_chip = "Feed OK" if feed_ok else "Degraded"
    st.markdown(
        f"""
        <div class="qp-status-row">
            <span class="qp-chip qp-chip-live">
                <span class="qp-status-dot"></span> Live
            </span>
            <span class="qp-chip">{feed_chip}</span>
            <span class="qp-chip">{updated_str}</span>
            <span class="qp-chip qp-chip-hide-mobile">{timeframe}</span>
            <span class="qp-chip">{event_count:,} events</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpi_row(kpis: EarthquakeKPIs) -> None:
    """KPI row — one card per column (avoids Streamlit HTML block escaping)."""
    metrics = [
        ("Total Events", f"{kpis.total_events:,}", "Selected window"),
        ("Avg Magnitude", f"{kpis.average_magnitude:.2f}", "Mean value"),
        ("Largest Event", f"M {kpis.largest_magnitude:.1f}", kpis.largest_place[:48]),
        ("Significant", f"{kpis.significant_events:,}", "Events >= M4.5"),
        ("Energy", format_energy(kpis.total_energy_joules), f"{kpis.shallow_events_pct:.0f}% shallow"),
    ]
    cols = st.columns(5, gap="small")
    for col, (label, value, sub) in zip(cols, metrics):
        with col:
            st.markdown(
                f"""
                <div class="qp-kpi-card">
                    <div class="qp-kpi-label">{html.escape(label)}</div>
                    <div class="qp-kpi-value">{html.escape(value)}</div>
                    <div class="qp-kpi-sub">{html.escape(sub)}</div>
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
    st.markdown('<p class="qp-zone-label">Executive summary</p>', unsafe_allow_html=True)
    if kpis.total_events == 0:
        st.markdown(
            '<div class="qp-summary">No events match your filters. '
            "Widen the time window or lower the magnitude threshold.</div>",
            unsafe_allow_html=True,
        )
        return

    alert_text = (
        f"<strong style='color:{colors['danger']}'>{alert_count} alert(s)</strong> require review."
        if alert_count
        else "No active high-magnitude alerts."
    )
    st.markdown(
        f"""
        <div class="qp-summary">
            <strong>{timeframe}</strong> — <strong>{kpis.total_events:,}</strong> earthquakes recorded.
            Median depth <strong>{kpis.median_depth_km:.1f} km</strong>.
            Peak <strong>M {kpis.largest_magnitude:.1f}</strong> ({html.escape(kpis.largest_place)}).
            Energy <strong>{format_energy(kpis.total_energy_joules)}</strong>. {alert_text}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_section_title(title: str, subtitle: str = "", colors: dict[str, str] | None = None) -> None:
    c = colors or get_colors()
    sub_html = f'<span class="qp-panel-sub">{html.escape(subtitle)}</span>' if subtitle else ""
    st.markdown(
        f"""
        <div class="qp-panel-head">
            <span class="qp-panel-title">{html.escape(title)}</span>
            {sub_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_zone_label(label: str) -> None:
    st.markdown(f'<p class="qp-zone-label">{html.escape(label)}</p>', unsafe_allow_html=True)


def render_sample_notice(was_sampled: bool, total: int, shown: int) -> None:
    if was_sampled:
        st.caption(f"Displaying {shown:,} of {total:,} events · M≥4.0 always included")


def render_sidebar_controls() -> dict:
    """Structured PwC-style control rail."""
    st.sidebar.markdown('<p class="qp-side-label">Filters</p>', unsafe_allow_html=True)
    timeframe = st.sidebar.selectbox("Time window", list(USGS_FEEDS.keys()), index=1, label_visibility="collapsed")
    st.sidebar.caption("Analysis period")

    min_magnitude = st.sidebar.slider("Min magnitude", 0.0, 8.0, 0.0, 0.1)
    max_depth = st.sidebar.slider("Max depth (km)", 0, 700, 700, 10)
    place_query = st.sidebar.text_input("Location", placeholder="e.g. Japan", label_visibility="collapsed")
    st.sidebar.caption("Search by place name")

    st.sidebar.markdown('<p class="qp-side-label">Alerts</p>', unsafe_allow_html=True)
    mag_threshold = st.sidebar.slider("Threshold (M)", 0.0, 10.0, DEFAULT_ALERT_THRESHOLD, 0.1)

    st.sidebar.markdown('<p class="qp-side-label">System</p>', unsafe_allow_html=True)
    auto_refresh = st.sidebar.toggle("Auto-refresh (60s)", value=True)

    st.sidebar.divider()
    with st.sidebar.expander("Methodology"):
        st.caption(
            "**Source:** USGS GeoJSON  \n"
            "**Energy:** Gutenberg–Richter  \n"
            "**Maps:** 2,000 pt cap  \n"
            "**Refresh:** 60s"
        )

    st.sidebar.caption(f"{DATA_SOURCE}")

    return {
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
        st.success("All clear — no events above threshold.")
        return

    st.error(f"**{len(alerts)} alert(s)** — review required")
    for row in alerts.head(8).itertuples(index=False):
        st.markdown(
            f"""
            <div class="qp-alert-critical">
                <strong>M {row.Magnitude:.1f}</strong> · {html.escape(str(row.Place))}<br>
                <small style="color:{colors['text_muted']}">
                    {row.Depth:.1f} km · {row.Time.strftime('%Y-%m-%d %H:%M UTC')}
                </small>
            </div>
            """,
            unsafe_allow_html=True,
        )
    if len(alerts) > 8:
        st.caption(f"+ {len(alerts) - 8} more in Data tab")


def render_data_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No records.")
        return

    display = df[
        ["Time", "Magnitude", "Depth", "Place", "Latitude", "Longitude", "Status"]
    ].sort_values("Time", ascending=False)
    display["Time"] = display["Time"].dt.strftime("%Y-%m-%d %H:%M")

    st.dataframe(
        display,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Magnitude": st.column_config.NumberColumn("Mag", format="%.1f"),
            "Depth": st.column_config.NumberColumn("Depth km", format="%.1f"),
            "Place": st.column_config.TextColumn("Place", width="medium"),
            "Latitude": st.column_config.NumberColumn("Lat", format="%.3f"),
            "Longitude": st.column_config.NumberColumn("Lon", format="%.3f"),
        },
    )

    csv = display.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Export CSV",
        data=csv,
        file_name=f"quakepulse_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        type="primary",
        use_container_width=True,
    )


def render_footer() -> None:
    st.markdown(
        f"""
        <div class="qp-footer">
            {APP_TITLE} v{__version__} · {DATA_SOURCE}<br>
            Informational only — not for emergency response
        </div>
        """,
        unsafe_allow_html=True,
    )
