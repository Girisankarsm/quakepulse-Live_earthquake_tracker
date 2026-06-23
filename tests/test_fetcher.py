"""Tests for USGS data fetcher."""

from unittest.mock import MagicMock, patch

import requests
import pytest

from quakepulse.data.fetcher import FetchError, fetch_earthquake_data


@patch("quakepulse.data.fetcher.requests.get")
def test_fetch_earthquake_data_success(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = {"features": [{"id": "test"}]}
    mock_get.return_value = mock_response

    result = fetch_earthquake_data("https://example.com/feed")
    assert len(result) == 1
    mock_get.assert_called_once()
    assert mock_get.call_args.kwargs["timeout"] == 15


@patch("quakepulse.data.fetcher.requests.get")
def test_fetch_earthquake_data_request_failure(mock_get):
    mock_get.side_effect = requests.exceptions.ConnectionError("network down")
    with pytest.raises(FetchError, match="Failed to fetch"):
        fetch_earthquake_data("https://example.com/feed")


@patch("quakepulse.data.fetcher.requests.get")
def test_fetch_earthquake_data_invalid_payload(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = {"not_features": []}
    mock_get.return_value = mock_response

    with pytest.raises(FetchError, match="missing 'features'"):
        fetch_earthquake_data("https://example.com/feed")
