"""
QuakePulse — Global Seismic Intelligence Platform
Enterprise-grade live earthquake monitoring dashboard.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import streamlit as st
from streamlit_autorefresh import st_autorefresh
from streamlit_folium import st_folium

from quakepulse.config import (
    ANIMATION_LIMIT,
    AUTO_REFRESH_SECONDS,
    CACHE_TTL_SECONDS,
    CHART_SAMPLE_LIMIT,
    MAP_DISPLAY_LIMIT,
    get_colors,
)
from quakepulse.data.analytics import (
    apply_filters,
    compute_kpis,
    enrich_dataframe,
    get_alerts,
    sample_for_display,
)
from quakepulse.data.fetcher import FetchError, fetch_earthquake_data
from quakepulse.data.parser import earthquakes_to_df
from quakepulse.ui.components import (
    render_alert_banner,
    render_data_table,
    render_executive_summary,
    render_footer,
    render_header,
    render_kpi_row,
    render_sample_notice,
    render_section_title,
    render_sidebar_controls,
    render_status_bar,
)
from quakepulse.ui.styles import inject_custom_css
from quakepulse.viz.charts import (
    animated_map_chart,
    cumulative_energy_chart,
    depth_box_chart,
    depth_magnitude_scatter,
    magnitude_histogram,
    magnitude_trend_chart,
    scatter_3d_chart,
    time_series_chart,
    top_regions_chart,
)
from quakepulse.viz.maps import create_cluster_map, create_heatmap


def configure_page() -> None:
    st.set_page_config(
        page_title="QuakePulse — Global Seismic Intelligence",
        page_icon="🌐",
        layout="wide",
        initial_sidebar_state="expanded",
    )


@st.cache_data(ttl=CACHE_TTL_SECONDS, show_spinner=False)
def load_earthquake_data(url: str) -> tuple[list, str | None]:
    """Cached fetch returning features and optional error message."""
    try:
        features = fetch_earthquake_data(url)
        return features, None
    except FetchError as exc:
        return [], str(exc)


def main() -> None:
    configure_page()
    controls = render_sidebar_controls()
    colors = get_colors(controls["theme"])
    inject_custom_css(controls["theme"])

    if controls["auto_refresh"]:
        st_autorefresh(interval=AUTO_REFRESH_SECONDS * 1000, key="quakepulse_refresh")

    render_header()

    with st.spinner("Synchronizing with USGS seismic feeds…"):
        features, error = load_earthquake_data(controls["feed_url"])

    last_updated = datetime.now(timezone.utc)

    if error:
        st.error(f"Data pipeline error: {error}")
        st.info("The dashboard will retry automatically on the next refresh cycle.")
        render_footer()
        return

    raw_df = earthquakes_to_df(features)
    df = enrich_dataframe(raw_df)
    df = apply_filters(
        df,
        min_magnitude=controls["min_magnitude"],
        max_depth=controls["max_depth"],
        place_query=controls["place_query"],
    )

    kpis = compute_kpis(df)
    alerts = get_alerts(df, controls["mag_threshold"])

    map_df, map_sampled = sample_for_display(df, MAP_DISPLAY_LIMIT)
    chart_df, chart_sampled = sample_for_display(df, CHART_SAMPLE_LIMIT)
    anim_df, _ = sample_for_display(df, ANIMATION_LIMIT)

    render_status_bar(last_updated, kpis.total_events, controls["timeframe"], feed_ok=True)
    render_kpi_row(kpis)
    render_executive_summary(kpis, controls["timeframe"], len(alerts), colors)

    tab_overview, tab_map, tab_analytics, tab_alerts, tab_data = st.tabs(
        ["Overview", "Map", "Analytics", "Alerts", "Data"]
    )

    with tab_overview:
        _render_overview_tab(df, chart_df, chart_sampled, colors)

    with tab_map:
        _render_map_tab(df, map_df, map_sampled, colors)

    with tab_analytics:
        _render_analytics_tab(df, chart_df, chart_sampled, anim_df, colors)

    with tab_alerts:
        render_section_title("Live alerts", f"Threshold M{controls['mag_threshold']:.1f}+", colors)
        render_alert_banner(alerts, colors)

    with tab_data:
        render_section_title("Event registry", "Full dataset · searchable · exportable", colors)
        render_data_table(df)

    render_footer()


@st.fragment
def _render_overview_tab(
    df: pd.DataFrame,
    chart_df: pd.DataFrame,
    chart_sampled: bool,
    colors: dict[str, str],
) -> None:
    if df.empty:
        st.warning("No events match your current filters.")
        return
    render_section_title("Activity overview", "Trends and distributions", colors)
    render_sample_notice(chart_sampled, len(df), len(chart_df))
    col_a, col_b = st.columns(2, gap="medium")
    with col_a:
        st.plotly_chart(magnitude_trend_chart(chart_df, colors), use_container_width=True)
    with col_b:
        st.plotly_chart(magnitude_histogram(chart_df, colors), use_container_width=True)
    st.plotly_chart(cumulative_energy_chart(chart_df, colors), use_container_width=True)


@st.fragment
def _render_map_tab(
    df: pd.DataFrame,
    map_df: pd.DataFrame,
    map_sampled: bool,
    colors: dict[str, str],
) -> None:
    if df.empty:
        st.warning("No geospatial data for the selected filters.")
        return
    render_section_title("Event map", "Clustered markers by magnitude", colors)
    render_sample_notice(map_sampled, len(df), len(map_df))
    map_col, side_col = st.columns([2, 1], gap="medium")
    with map_col:
        st_folium(create_cluster_map(map_df, colors), width=None, height=520, returned_objects=[])
    with side_col:
        st.plotly_chart(depth_magnitude_scatter(map_df, colors), use_container_width=True)
    render_section_title("Density heatmap", "Regional intensity", colors)
    st_folium(create_heatmap(map_df, colors), width=None, height=480, returned_objects=[])


@st.fragment
def _render_analytics_tab(
    df: pd.DataFrame,
    chart_df: pd.DataFrame,
    chart_sampled: bool,
    anim_df: pd.DataFrame,
    colors: dict[str, str],
) -> None:
    if df.empty:
        st.warning("No analytics for the selected filters.")
        return
    render_section_title("Deep analytics", "Patterns across time and depth", colors)
    render_sample_notice(chart_sampled, len(df), len(chart_df))
    r1c1, r1c2 = st.columns(2, gap="medium")
    with r1c1:
        st.plotly_chart(time_series_chart(chart_df, colors), use_container_width=True)
    with r1c2:
        st.plotly_chart(depth_box_chart(chart_df, colors), use_container_width=True)
    r2c1, r2c2 = st.columns(2, gap="medium")
    with r2c1:
        st.plotly_chart(top_regions_chart(chart_df, colors=colors), use_container_width=True)
    with r2c2:
        st.plotly_chart(scatter_3d_chart(chart_df, colors), use_container_width=True)
    if len(anim_df) < len(df):
        st.caption(f"Animation uses {len(anim_df):,} of {len(df):,} events for smooth playback.")
    if len(anim_df) > 1:
        st.plotly_chart(animated_map_chart(anim_df, colors), use_container_width=True)


if __name__ == "__main__":
    main()
