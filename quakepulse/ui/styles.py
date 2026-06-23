"""FAANG-inspired glassmorphism UI with light/dark themes."""

from __future__ import annotations

import streamlit as st

from quakepulse.config import get_colors


def inject_custom_css(theme: str = "light") -> None:
    """Inject global glass UI styles for the active theme."""
    c = get_colors(theme)
    st.markdown(
        f"""
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            html, body, [class*="css"] {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                -webkit-font-smoothing: antialiased;
            }}

            .stApp {{
                background:
                    radial-gradient(ellipse 80% 60% at 10% 0%, rgba(37, 99, 235, 0.14) 0%, transparent 55%),
                    radial-gradient(ellipse 70% 50% at 90% 10%, rgba(124, 58, 237, 0.12) 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 50% 100%, rgba(16, 185, 129, 0.08) 0%, transparent 45%),
                    linear-gradient(160deg, {c['bg_start']} 0%, {c['bg_mid']} 45%, {c['bg_end']} 100%);
                background-attachment: fixed;
            }}

            .block-container {{
                padding-top: 1.5rem;
                padding-bottom: 2rem;
                max-width: 1380px;
            }}

            [data-testid="stSidebar"] {{
                background: {c['glass_sidebar']} !important;
                backdrop-filter: blur(24px) saturate(160%);
                -webkit-backdrop-filter: blur(24px) saturate(160%);
                border-right: 1px solid rgba(255, 255, 255, 0.12);
            }}
            [data-testid="stSidebar"] > div:first-child {{ background: transparent !important; }}
            [data-testid="stSidebar"] * {{ color: {c['text_on_dark']} !important; }}
            [data-testid="stSidebar"] hr {{ border-color: rgba(255, 255, 255, 0.14) !important; }}

            .qp-header {{
                background: {c['glass_strong']};
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid {c['border']};
                border-radius: 20px;
                padding: 2rem 2.25rem;
                margin-bottom: 1.5rem;
                box-shadow: {c['shadow_lg']};
            }}
            .qp-brand {{ display: flex; align-items: center; gap: 0.85rem; }}
            .qp-logo {{
                width: 44px; height: 44px; border-radius: 14px;
                background: linear-gradient(135deg, {c['accent']} 0%, {c['violet']} 100%);
                display: flex; align-items: center; justify-content: center;
                font-size: 1.25rem; box-shadow: 0 8px 24px {c['accent_glow']};
            }}
            .qp-header h1 {{
                color: {c['text']}; font-size: 1.75rem; font-weight: 700;
                margin: 0; letter-spacing: -0.03em; line-height: 1.2;
            }}
            .qp-header p {{
                color: {c['text_muted']}; margin: 0.35rem 0 0 0;
                font-size: 0.95rem; font-weight: 400;
            }}
            .qp-version {{
                display: inline-block; margin-left: 0.5rem;
                font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem;
                border-radius: 6px; background: {c['accent_glow']}; color: {c['accent']};
                vertical-align: middle;
            }}

            .qp-status-row {{ display: flex; flex-wrap: wrap; gap: 0.65rem; margin-bottom: 1.25rem; }}
            .qp-chip {{
                display: inline-flex; align-items: center; gap: 0.45rem;
                background: {c['glass_strong']}; backdrop-filter: blur(16px);
                border: 1px solid {c['border']}; border-radius: 999px;
                padding: 0.45rem 0.95rem; font-size: 0.82rem; font-weight: 500;
                color: {c['text']}; box-shadow: {c['shadow']};
            }}
            .qp-chip-live {{
                color: {c['success']}; border-color: rgba(16, 185, 129, 0.35);
                background: rgba(16, 185, 129, 0.1);
            }}
            .qp-status-dot {{
                width: 7px; height: 7px; background: {c['success']};
                border-radius: 50%; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
                animation: qp-pulse 2.4s ease-in-out infinite;
            }}
            @keyframes qp-pulse {{
                0%, 100% {{ opacity: 1; transform: scale(1); }}
                50% {{ opacity: 0.55; transform: scale(0.92); }}
            }}

            .qp-kpi-card {{
                background: {c['glass_strong']}; backdrop-filter: blur(18px) saturate(160%);
                border: 1px solid {c['border']}; border-radius: 16px;
                padding: 1.25rem 1.35rem; box-shadow: {c['shadow']}; height: 100%;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }}
            .qp-kpi-card:hover {{ transform: translateY(-2px); box-shadow: {c['shadow_lg']}; }}
            .qp-kpi-label {{
                color: {c['text_muted']}; font-size: 0.72rem; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem;
            }}
            .qp-kpi-value {{
                color: {c['text']}; font-size: 1.55rem; font-weight: 700;
                line-height: 1.15; letter-spacing: -0.02em;
            }}
            .qp-kpi-sub {{ color: {c['slate']}; font-size: 0.8rem; margin-top: 0.45rem; line-height: 1.4; }}

            .qp-summary {{
                background: {c['glass']}; backdrop-filter: blur(16px);
                border: 1px solid {c['border']}; border-radius: 16px;
                padding: 1.15rem 1.4rem; margin-bottom: 1.25rem;
                color: {c['text']}; font-size: 0.94rem; line-height: 1.65; box-shadow: {c['shadow']};
            }}
            .qp-section-title {{
                color: {c['text']}; font-size: 1.05rem; font-weight: 600;
                letter-spacing: -0.01em; margin: 0 0 0.75rem 0;
            }}
            .qp-alert-critical {{
                background: rgba(239, 68, 68, 0.08); backdrop-filter: blur(12px);
                border: 1px solid rgba(239, 68, 68, 0.22); border-radius: 14px;
                padding: 0.9rem 1.1rem; margin-bottom: 0.55rem; color: {c['text']};
            }}
            .qp-footer {{
                color: {c['text_muted']}; font-size: 0.78rem; text-align: center;
                padding: 1.75rem 0 0.5rem; margin-top: 2rem;
                border-top: 1px solid {c['border_soft']};
            }}

            .stTabs [data-baseweb="tab-list"] {{ gap: 0.4rem; background: transparent; border-bottom: none; }}
            .stTabs [data-baseweb="tab"] {{
                background: {c['glass']}; backdrop-filter: blur(12px);
                border: 1px solid {c['border_soft']}; border-radius: 12px;
                padding: 0.55rem 1.15rem; font-weight: 600; font-size: 0.88rem;
                color: {c['text_muted']}; transition: all 0.2s ease;
            }}
            .stTabs [data-baseweb="tab"]:hover {{ background: {c['glass_strong']}; color: {c['text']}; }}
            .stTabs [aria-selected="true"] {{
                background: linear-gradient(135deg, {c['accent']} 0%, {c['violet']} 100%) !important;
                color: #FFFFFF !important; border-color: transparent !important;
                box-shadow: 0 6px 20px {c['accent_glow']};
            }}
            .stTabs [data-baseweb="tab-panel"] {{ padding-top: 1.1rem; }}

            [data-testid="stPlotlyChart"] {{
                background: {c['glass_strong']}; backdrop-filter: blur(14px);
                border: 1px solid {c['border']}; border-radius: 18px;
                padding: 0.5rem; box-shadow: {c['shadow']};
            }}
            [data-testid="stDataFrame"] {{
                border: 1px solid {c['border']}; border-radius: 16px;
                overflow: hidden; box-shadow: {c['shadow']};
            }}
            .stDownloadButton button {{
                border-radius: 12px !important; font-weight: 600 !important; border: none !important;
                background: linear-gradient(135deg, {c['accent']} 0%, {c['violet']} 100%) !important;
                box-shadow: 0 6px 18px {c['accent_glow']} !important;
            }}
            .stAlert {{
                border-radius: 14px !important;
                border: 1px solid {c['border_soft']} !important;
                backdrop-filter: blur(10px);
            }}

            #MainMenu {{visibility: hidden;}}
            footer {{visibility: hidden;}}
            header {{visibility: hidden;}}
        </style>
        """,
        unsafe_allow_html=True,
    )
