"""
QuakePulse — Global Seismic Intelligence Platform
PwC-style executive dashboard · desktop & mobile web app.
"""

from __future__ import annotations

from contextlib import nullcontext
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
    MAP_HEIGHT_MOBILE,
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
    render_topbar,
    render_zone_label,
)
from quakepulse.ui.loading import (
    render_branded_loader,
    render_loaded_wrapper_end,
    render_loaded_wrapper_start,
    render_skeleton_kpis,
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
        page_title="QuakePulse — Seismic Intelligence",
        page_icon="🌐",
        layout="wide",
        initial_sidebar_state="auto",
    )


@st.cache_data(ttl=CACHE_TTL_SECONDS, show_spinner=False)
def load_earthquake_data(url: str) -> tuple[list, str | None]:
    try:
        features = fetch_earthquake_data(url)
        return features, None
    except FetchError as exc:
        return [], str(exc)


def _show_loader(load_slot: st.empty, step: int, with_skeleton: bool = True) -> None:
    with load_slot.container():
        render_branded_loader(step=step)
        if with_skeleton:
            render_skeleton_kpis()


def main() -> None:
    configure_page()
    controls = render_sidebar_controls()
    colors = get_colors()
    inject_custom_css()

    if controls["auto_refresh"]:
        st_autorefresh(interval=AUTO_REFRESH_SECONDS * 1000, key="quakepulse_refresh")

    render_topbar()
    render_header()

    first_load = not st.session_state.get("qp_ready", False)
    load_slot = st.empty()

    if first_load:
        _show_loader(load_slot, 0)
    elif controls["auto_refresh"]:
        load_slot.markdown(
            '<div class="qp-refresh-badge"><span class="qp-refresh-spin"></span> Syncing feed</div>',
            unsafe_allow_html=True,
        )

    status_ctx = (
        st.status("Initializing seismic intelligence platform…", expanded=True)
        if first_load
        else nullcontext()
    )

    with status_ctx as status:
        if first_load and status is not None:
            status.write("Connecting to USGS seismic feed…")
        _show_loader(load_slot, 0, first_load)

        features, error = load_earthquake_data(controls["feed_url"])

        if first_load and status is not None:
            if error:
                status.update(label="Connection issue", state="error")
            else:
                status.write("Parsing earthquake events…")
        if first_load and not error:
            _show_loader(load_slot, 1)

        raw_df = earthquakes_to_df(features)
        df = enrich_dataframe(raw_df)
        df = apply_filters(
            df,
            min_magnitude=controls["min_magnitude"],
            max_depth=controls["max_depth"],
            place_query=controls["place_query"],
        )

        if first_load and status is not None and not error:
            status.write("Computing analytics & KPIs…")
        if first_load and not error:
            _show_loader(load_slot, 2)

        kpis = compute_kpis(df)
        alerts = get_alerts(df, controls["mag_threshold"])
        map_df, map_sampled = sample_for_display(df, MAP_DISPLAY_LIMIT)
        chart_df, chart_sampled = sample_for_display(df, CHART_SAMPLE_LIMIT)
        anim_df, _ = sample_for_display(df, ANIMATION_LIMIT)

        if first_load and status is not None and not error:
            status.write("Rendering dashboard…")
            _show_loader(load_slot, 3, with_skeleton=False)
            status.update(label="Dashboard ready", state="complete", expanded=False)

    load_slot.empty()
    st.session_state["qp_ready"] = True
    last_updated = datetime.now(timezone.utc)

    if error:
        st.error(f"Data error: {error}")
        st.info("Retrying on next refresh.")
        render_footer()
        return

    render_loaded_wrapper_start()
    render_status_bar(last_updated, kpis.total_events, controls["timeframe"])
    render_kpi_row(kpis)
    render_executive_summary(kpis, controls["timeframe"], len(alerts), colors)
    render_zone_label("Analysis workspace")

    tab_overview, tab_map, tab_analytics, tab_alerts, tab_data = st.tabs(
        ["Overview", "Map", "Analytics", "Alerts", "Data"]
    )

    with tab_overview:
        _render_overview_tab(df, chart_df, chart_sampled, colors)
    with tab_map:
        _render_map_tab(df, map_df, map_sampled, colors, MAP_HEIGHT_MOBILE)
    with tab_analytics:
        _render_analytics_tab(df, chart_df, chart_sampled, anim_df, colors)
    with tab_alerts:
        render_section_title("Alert monitor", f"M ≥ {controls['mag_threshold']:.1f}", colors)
        render_alert_banner(alerts, colors)
    with tab_data:
        render_section_title("Event registry", "Export · full record set", colors)
        render_data_table(df)

    render_loaded_wrapper_end()
    render_footer()


@st.fragment
def _render_overview_tab(
    df: pd.DataFrame,
    chart_df: pd.DataFrame,
    chart_sampled: bool,
    colors: dict[str, str],
) -> None:
    if df.empty:
        st.warning("No events for current filters.")
        return
    render_section_title("Activity trends", "Hourly patterns & magnitude spread", colors)
    render_sample_notice(chart_sampled, len(df), len(chart_df))
    c1, c2 = st.columns(2, gap="medium")
    with c1:
        st.plotly_chart(magnitude_trend_chart(chart_df, colors), use_container_width=True)
    with c2:
        st.plotly_chart(magnitude_histogram(chart_df, colors), use_container_width=True)
    st.plotly_chart(cumulative_energy_chart(chart_df, colors), use_container_width=True)


@st.fragment
def _render_map_tab(
    df: pd.DataFrame,
    map_df: pd.DataFrame,
    map_sampled: bool,
    colors: dict[str, str],
    map_height: int,
) -> None:
    if df.empty:
        st.warning("No geospatial data.")
        return
    render_section_title("Event map", "Clustered by magnitude", colors)
    render_sample_notice(map_sampled, len(df), len(map_df))
    st_folium(create_cluster_map(map_df, colors), width=None, height=map_height, returned_objects=[])
    render_section_title("Depth vs magnitude", "Cross-section view", colors)
    st.plotly_chart(depth_magnitude_scatter(map_df, colors), use_container_width=True)
    render_section_title("Density heatmap", "Regional concentration", colors)
    st_folium(create_heatmap(map_df, colors), width=None, height=int(map_height * 0.85), returned_objects=[])


@st.fragment
def _render_analytics_tab(
    df: pd.DataFrame,
    chart_df: pd.DataFrame,
    chart_sampled: bool,
    anim_df: pd.DataFrame,
    colors: dict[str, str],
) -> None:
    if df.empty:
        st.warning("No analytics data.")
        return
    render_section_title("Temporal analysis", "Timeline & depth distribution", colors)
    render_sample_notice(chart_sampled, len(df), len(chart_df))
    r1c1, r1c2 = st.columns(2, gap="medium")
    with r1c1:
        st.plotly_chart(time_series_chart(chart_df, colors), use_container_width=True)
    with r1c2:
        st.plotly_chart(depth_box_chart(chart_df, colors), use_container_width=True)
    render_section_title("Regional analysis", "Hotspots & 3D view", colors)
    r2c1, r2c2 = st.columns(2, gap="medium")
    with r2c1:
        st.plotly_chart(top_regions_chart(chart_df, colors=colors), use_container_width=True)
    with r2c2:
        st.plotly_chart(scatter_3d_chart(chart_df, colors), use_container_width=True)
    if len(anim_df) < len(df):
        st.caption(f"Animation: {len(anim_df):,} of {len(df):,} events")
    if len(anim_df) > 1:
        render_section_title("Playback", "Animated global view", colors)
        st.plotly_chart(animated_map_chart(anim_df, colors), use_container_width=True)


if __name__ == "__main__":
    main()
