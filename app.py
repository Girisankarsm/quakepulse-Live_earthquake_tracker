"""
QuakePulse — Global Seismic Intelligence Platform
Enterprise-grade live earthquake monitoring dashboard.
"""

from __future__ import annotations

from datetime import datetime, timezone

import streamlit as st
from streamlit_autorefresh import st_autorefresh
from streamlit_folium import st_folium

from quakepulse.config import AUTO_REFRESH_SECONDS, CACHE_TTL_SECONDS
from quakepulse.data.analytics import apply_filters, compute_kpis, enrich_dataframe, get_alerts
from quakepulse.data.fetcher import FetchError, fetch_earthquake_data
from quakepulse.data.parser import earthquakes_to_df
from quakepulse.ui.components import (
    render_alert_banner,
    render_data_table,
    render_executive_summary,
    render_footer,
    render_header,
    render_kpi_row,
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
    inject_custom_css()
    controls = render_sidebar_controls()

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

    render_status_bar(last_updated, kpis.total_events, controls["timeframe"])
    render_kpi_row(kpis)
    render_executive_summary(kpis, controls["timeframe"], len(alerts))

    tab_overview, tab_map, tab_analytics, tab_alerts, tab_data = st.tabs(
        ["Overview", "Geospatial", "Analytics", "Alerts", "Data Explorer"]
    )

    with tab_overview:
        if df.empty:
            st.warning("No events match your current filters.")
        else:
            col_a, col_b = st.columns(2)
            with col_a:
                st.plotly_chart(magnitude_trend_chart(df), use_container_width=True)
            with col_b:
                st.plotly_chart(magnitude_histogram(df), use_container_width=True)
            st.plotly_chart(cumulative_energy_chart(df), use_container_width=True)

    with tab_map:
        if df.empty:
            st.warning("No geospatial data available for the selected filters.")
        else:
            map_col, side_col = st.columns([2, 1])
            with map_col:
                st.markdown("#### Event map — clustered markers")
                st_folium(create_cluster_map(df), width=None, height=520, returned_objects=[])
            with side_col:
                st.plotly_chart(depth_magnitude_scatter(df), use_container_width=True)
            st.markdown("#### Global density heatmap")
            st_folium(create_heatmap(df), width=None, height=480, returned_objects=[])

    with tab_analytics:
        if df.empty:
            st.warning("No analytics available for the selected filters.")
        else:
            r1c1, r1c2 = st.columns(2)
            with r1c1:
                st.plotly_chart(time_series_chart(df), use_container_width=True)
            with r1c2:
                st.plotly_chart(depth_box_chart(df), use_container_width=True)
            r2c1, r2c2 = st.columns(2)
            with r2c1:
                st.plotly_chart(top_regions_chart(df), use_container_width=True)
            with r2c2:
                st.plotly_chart(scatter_3d_chart(df), use_container_width=True)
            if len(df) <= 500:
                st.plotly_chart(animated_map_chart(df), use_container_width=True)
            else:
                st.caption(
                    "Animated map disabled for large datasets (>500 events) to preserve performance. "
                    "Narrow the analysis window or increase the magnitude filter."
                )

    with tab_alerts:
        st.markdown("#### Real-time magnitude alerts")
        render_alert_banner(alerts)

    with tab_data:
        st.markdown("#### Event registry")
        render_data_table(df)

    render_footer()


if __name__ == "__main__":
    main()
