"""Tests for earthquake GeoJSON parsing."""

from datetime import timezone

from quakepulse.data.parser import earthquakes_to_df

from tests.conftest import SAMPLE_FEATURE


def test_earthquakes_to_df_parses_feature():
    df = earthquakes_to_df([SAMPLE_FEATURE])
    assert len(df) == 1
    row = df.iloc[0]
    assert row["Magnitude"] == 4.5
    assert row["Depth"] == 12.3
    assert row["Place"] == "10 km NE of Test City"
    assert row["Latitude"] == 35.2
    assert row["Longitude"] == -120.5
    assert row["Time"].tzinfo == timezone.utc


def test_earthquakes_to_df_handles_null_magnitude():
    feature = {
        **SAMPLE_FEATURE,
        "properties": {**SAMPLE_FEATURE["properties"], "mag": None},
    }
    df = earthquakes_to_df([feature])
    assert df.iloc[0]["Magnitude"] == 0.0


def test_earthquakes_to_df_skips_missing_time():
    feature = {
        **SAMPLE_FEATURE,
        "properties": {**SAMPLE_FEATURE["properties"], "time": None},
    }
    df = earthquakes_to_df([feature])
    assert df.empty


def test_earthquakes_to_df_empty_input():
    df = earthquakes_to_df([])
    assert list(df.columns)
    assert len(df) == 0
