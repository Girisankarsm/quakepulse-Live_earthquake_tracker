"""Tests for theme configuration."""

from quakepulse.config import get_colors, THEMES


def test_get_colors_light():
    colors = get_colors("light")
    assert colors["accent"] == "#2563EB"
    assert "glass" in colors


def test_get_colors_dark():
    colors = get_colors("dark")
    assert colors["text"] == "#F1F5F9"
    assert colors["bg_start"] == "#0B1120"


def test_get_colors_fallback():
    colors = get_colors("unknown")
    assert colors == THEMES["light"]
