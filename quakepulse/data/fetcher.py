"""USGS earthquake feed fetcher."""

from __future__ import annotations

from typing import Any

import requests

from quakepulse.config import REQUEST_TIMEOUT_SECONDS


class FetchError(Exception):
    """Raised when the USGS feed cannot be retrieved or parsed."""


def fetch_earthquake_data(url: str) -> list[dict[str, Any]]:
    """Fetch GeoJSON features from a USGS earthquake feed URL."""
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise FetchError(f"Failed to fetch earthquake data: {exc}") from exc
    except ValueError as exc:
        raise FetchError("Invalid JSON response from USGS API") from exc

    features = payload.get("features")
    if not isinstance(features, list):
        raise FetchError("USGS response missing 'features' array")

    return features
