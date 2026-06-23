"""Tests for theme configuration."""

from quakepulse.config import DEFAULT_THEME, THEMES, get_colors


def test_default_theme_is_dark():
    assert DEFAULT_THEME == "dark"


def test_get_colors_pwc_palette():
    colors = get_colors()
    assert colors["brand"] == "#D04A02"
    assert colors["accent"] == "#D04A02"


def test_get_colors_always_dark():
    assert get_colors("light") == THEMES["dark"]
