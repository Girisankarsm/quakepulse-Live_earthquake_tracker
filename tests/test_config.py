"""Tests for theme configuration."""

from quakepulse.config import DEFAULT_THEME, THEMES, get_colors


def test_default_theme_is_dark():
    assert DEFAULT_THEME == "dark"


def test_get_colors_returns_dark():
    colors = get_colors()
    assert colors["accent"] == "#60A5FA"
    assert colors["bg_start"] == "#0B1120"


def test_get_colors_ignores_light_request():
    """Product is dark-only; any theme key resolves to dark palette."""
    colors = get_colors("light")
    assert colors == THEMES["dark"]
