"""Enterprise dashboard CSS — PwC-inspired professional styling."""

from __future__ import annotations

import streamlit as st

from quakepulse.config import COLORS


def inject_custom_css() -> None:
    """Inject global styles for a polished enterprise look."""
    st.markdown(
        f"""
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap');

            html, body, [class*="css"] {{
                font-family: 'Source Sans 3', 'Segoe UI', Arial, sans-serif;
            }}

            .stApp {{
                background-color: {COLORS['bg']};
            }}

            [data-testid="stSidebar"] {{
                background-color: {COLORS['navy']};
            }}
            [data-testid="stSidebar"] * {{
                color: #E8EDF3 !important;
            }}
            [data-testid="stSidebar"] .stSelectbox label,
            [data-testid="stSidebar"] .stSlider label,
            [data-testid="stSidebar"] .stTextInput label,
            [data-testid="stSidebar"] .stCheckbox label {{
                color: #E8EDF3 !important;
                font-weight: 500;
            }}

            .qp-header {{
                background: linear-gradient(135deg, {COLORS['navy']} 0%, {COLORS['navy_light']} 100%);
                border-radius: 12px;
                padding: 1.75rem 2rem;
                margin-bottom: 1.25rem;
                box-shadow: 0 4px 20px rgba(27, 42, 74, 0.18);
            }}
            .qp-header h1 {{
                color: #FFFFFF;
                font-size: 1.85rem;
                font-weight: 700;
                margin: 0 0 0.25rem 0;
                letter-spacing: -0.02em;
            }}
            .qp-header p {{
                color: rgba(255,255,255,0.82);
                margin: 0;
                font-size: 1rem;
                font-weight: 400;
            }}
            .qp-accent {{
                color: {COLORS['orange']};
            }}

            .qp-kpi-card {{
                background: {COLORS['card']};
                border: 1px solid {COLORS['border']};
                border-radius: 10px;
                padding: 1.1rem 1.25rem;
                box-shadow: 0 2px 8px rgba(26, 35, 50, 0.06);
                height: 100%;
            }}
            .qp-kpi-label {{
                color: {COLORS['text_muted']};
                font-size: 0.78rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                margin-bottom: 0.35rem;
            }}
            .qp-kpi-value {{
                color: {COLORS['text']};
                font-size: 1.65rem;
                font-weight: 700;
                line-height: 1.2;
            }}
            .qp-kpi-sub {{
                color: {COLORS['slate']};
                font-size: 0.82rem;
                margin-top: 0.3rem;
            }}

            .qp-status-live {{
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                background: rgba(46, 125, 50, 0.12);
                color: {COLORS['success']};
                padding: 0.35rem 0.75rem;
                border-radius: 999px;
                font-size: 0.8rem;
                font-weight: 600;
            }}
            .qp-status-dot {{
                width: 8px;
                height: 8px;
                background: {COLORS['success']};
                border-radius: 50%;
                animation: qp-pulse 2s infinite;
            }}
            @keyframes qp-pulse {{
                0%, 100% {{ opacity: 1; }}
                50% {{ opacity: 0.4; }}
            }}

            .qp-summary {{
                background: {COLORS['card']};
                border-left: 4px solid {COLORS['orange']};
                border-radius: 0 10px 10px 0;
                padding: 1rem 1.25rem;
                margin-bottom: 1rem;
                border-top: 1px solid {COLORS['border']};
                border-right: 1px solid {COLORS['border']};
                border-bottom: 1px solid {COLORS['border']};
                color: {COLORS['text']};
                font-size: 0.95rem;
                line-height: 1.55;
            }}

            .qp-alert-critical {{
                background: linear-gradient(90deg, rgba(198,40,40,0.08), rgba(198,40,40,0.02));
                border: 1px solid rgba(198,40,40,0.35);
                border-radius: 8px;
                padding: 0.85rem 1rem;
                margin-bottom: 0.5rem;
                color: {COLORS['text']};
            }}

            .qp-footer {{
                color: {COLORS['text_muted']};
                font-size: 0.78rem;
                text-align: center;
                padding: 1.5rem 0 0.5rem;
                border-top: 1px solid {COLORS['border']};
                margin-top: 2rem;
            }}

            div[data-testid="stMetric"] {{
                background: {COLORS['card']};
                border: 1px solid {COLORS['border']};
                border-radius: 10px;
                padding: 0.75rem 1rem;
            }}

            .stTabs [data-baseweb="tab-list"] {{
                gap: 0.5rem;
                background: transparent;
            }}
            .stTabs [data-baseweb="tab"] {{
                background: {COLORS['card']};
                border: 1px solid {COLORS['border']};
                border-radius: 8px 8px 0 0;
                padding: 0.6rem 1.2rem;
                font-weight: 600;
                color: {COLORS['slate']};
            }}
            .stTabs [aria-selected="true"] {{
                background: {COLORS['navy']} !important;
                color: #FFFFFF !important;
                border-color: {COLORS['navy']} !important;
            }}

            #MainMenu {{visibility: hidden;}}
            footer {{visibility: hidden;}}
            header {{visibility: hidden;}}
        </style>
        """,
        unsafe_allow_html=True,
    )
