"""Tests for analytics and filtering."""

import pandas as pd

from quakepulse.data.analytics import (
    apply_filters,
    compute_kpis,
    enrich_dataframe,
    format_energy,
    get_alerts,
    sample_for_display,
)
from quakepulse.data.parser import earthquakes_to_df
from tests.conftest import SAMPLE_FEATURE


def _sample_df():
    features = [
        SAMPLE_FEATURE,
        {
            **SAMPLE_FEATURE,
            "id": "us7000test2",
            "properties": {
                **SAMPLE_FEATURE["properties"],
                "mag": 6.2,
                "place": "Off coast of Japan",
            },
            "geometry": {"coordinates": [142.0, 38.0, 45.0]},
        },
    ]
    return enrich_dataframe(earthquakes_to_df(features))


def test_enrich_dataframe_adds_derived_columns():
    df = _sample_df()
    assert "Energy_J" in df.columns
    assert "MagRange" in df.columns
    assert "SizeScaled" in df.columns


def test_apply_filters_by_magnitude():
    df = _sample_df()
    filtered = apply_filters(df, min_magnitude=5.0, max_depth=None, place_query="")
    assert len(filtered) == 1
    assert filtered.iloc[0]["Magnitude"] == 6.2


def test_apply_filters_by_place():
    df = _sample_df()
    filtered = apply_filters(df, min_magnitude=0.0, max_depth=None, place_query="japan")
    assert len(filtered) == 1
    assert "Japan" in filtered.iloc[0]["Place"]


def test_compute_kpis():
    df = _sample_df()
    kpis = compute_kpis(df)
    assert kpis.total_events == 2
    assert kpis.largest_magnitude == 6.2
    assert kpis.significant_events >= 1


def test_get_alerts():
    df = _sample_df()
    alerts = get_alerts(df, threshold=5.0)
    assert len(alerts) == 1


def test_format_energy_scales():
    assert "J" in format_energy(500)
    assert "GJ" in format_energy(5e9)


def test_sample_for_display_keeps_strong_events():
    df = _sample_df()
    extra = df.copy()
    for i in range(20):
        row = extra.iloc[0].copy()
        row["Magnitude"] = 1.5
        row["ID"] = f"weak_{i}"
        extra = pd.concat([extra, row.to_frame().T], ignore_index=True)
    sampled, was_sampled = sample_for_display(extra, limit=5)
    assert was_sampled
    assert (sampled["Magnitude"] >= 4.0).any()
    assert len(sampled) <= 5


def test_sample_for_display_noop_on_small():
    df = _sample_df()
    sampled, was_sampled = sample_for_display(df, limit=100)
    assert not was_sampled
    assert len(sampled) == len(df)
