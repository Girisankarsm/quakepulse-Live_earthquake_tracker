"""PwC-inspired responsive executive UI."""

from __future__ import annotations

import streamlit as st

from quakepulse.config import get_colors


def inject_custom_css(theme: str = "dark") -> None:
    """Inject PwC-style responsive glass UI."""
    c = get_colors(theme)
    st.markdown(
        f"""
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            html, body, [class*="css"] {{
                font-family: 'Inter', Arial, Helvetica, sans-serif;
                -webkit-font-smoothing: antialiased;
            }}

            .stApp {{
                background: linear-gradient(180deg, {c['bg_start']} 0%, {c['bg_mid']} 50%, {c['bg_end']} 100%);
                background-attachment: fixed;
            }}

            .block-container {{
                padding: 1rem 1.25rem 2rem;
                max-width: 1440px;
            }}

            /* ── Sidebar: structured PwC control rail ── */
            [data-testid="stSidebar"] {{
                background: {c['glass_sidebar']} !important;
                border-right: 1px solid {c['border']};
            }}
            [data-testid="stSidebar"] * {{ color: {c['text_on_dark']} !important; }}
            [data-testid="stSidebar"] .qp-side-label {{
                font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em;
                text-transform: uppercase; color: {c['accent']} !important;
                margin: 1rem 0 0.5rem 0;
            }}

            /* ── Top bar ── */
            .qp-topbar {{
                display: flex; flex-wrap: wrap; align-items: center;
                justify-content: space-between; gap: 0.75rem;
                margin-bottom: 1rem; padding-bottom: 0.75rem;
                border-bottom: 1px solid {c['border_soft']};
            }}
            .qp-breadcrumb {{
                font-size: 0.78rem; color: {c['text_muted']}; font-weight: 500;
            }}
            .qp-breadcrumb strong {{ color: {c['text']}; }}

            /* ── Header panel ── */
            .qp-header {{
                background: {c['glass_strong']};
                border: 1px solid {c['border']};
                border-left: 4px solid {c['brand']};
                border-radius: 4px 12px 12px 4px;
                padding: 1.5rem 1.75rem;
                margin-bottom: 1.25rem;
                box-shadow: {c['shadow']};
            }}
            .qp-brand {{ display: flex; align-items: flex-start; gap: 1rem; }}
            .qp-logo {{
                width: 48px; height: 48px; border-radius: 8px; flex-shrink: 0;
                background: {c['brand']};
                display: flex; align-items: center; justify-content: center;
                font-size: 1.35rem;
            }}
            .qp-header h1 {{
                color: {c['text']}; font-size: 1.5rem; font-weight: 700;
                margin: 0; letter-spacing: -0.02em; line-height: 1.25;
            }}
            .qp-header p {{
                color: {c['text_muted']}; margin: 0.3rem 0 0;
                font-size: 0.9rem; line-height: 1.45;
            }}
            .qp-version {{
                display: inline-block; margin-left: 0.4rem;
                font-size: 0.65rem; font-weight: 600; padding: 0.12rem 0.45rem;
                border-radius: 4px; background: {c['brand_soft']}; color: {c['brand']};
                vertical-align: middle;
            }}

            /* ── Status chips ── */
            .qp-status-row {{
                display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;
            }}
            .qp-chip {{
                display: inline-flex; align-items: center; gap: 0.4rem;
                background: {c['glass_strong']}; border: 1px solid {c['border']};
                border-radius: 4px; padding: 0.4rem 0.75rem;
                font-size: 0.78rem; font-weight: 500; color: {c['text']};
            }}
            .qp-chip-live {{ color: {c['success']}; border-color: rgba(52, 211, 153, 0.3); }}
            .qp-chip-hide-mobile {{ }}
            .qp-status-dot {{
                width: 6px; height: 6px; background: {c['success']};
                border-radius: 50%; animation: qp-pulse 2.4s ease-in-out infinite;
            }}
            @keyframes qp-pulse {{
                0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.45; }}
            }}

            /* ── KPI cards (per-column on desktop, stack on mobile) ── */
            .qp-kpi-card {{
                background: {c['glass_strong']};
                border: 1px solid {c['border']};
                border-top: 3px solid {c['brand']};
                border-radius: 8px;
                padding: 1rem 1.1rem;
                min-height: 100px;
                margin-bottom: 0.75rem;
            }}
            .qp-kpi-label {{
                color: {c['text_muted']}; font-size: 0.68rem; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem;
            }}
            .qp-kpi-value {{
                color: {c['text']}; font-size: 1.35rem; font-weight: 700;
                line-height: 1.2; word-break: break-word;
            }}
            .qp-kpi-sub {{
                color: {c['slate']}; font-size: 0.75rem; margin-top: 0.35rem; line-height: 1.35;
            }}

            /* ── Content panels ── */
            .qp-panel {{
                background: {c['glass_strong']};
                border: 1px solid {c['border']};
                border-radius: 8px;
                padding: 1rem 1.15rem;
                margin-bottom: 1rem;
                box-shadow: {c['shadow']};
            }}
            .qp-panel-head {{
                display: flex; flex-wrap: wrap; align-items: baseline;
                justify-content: space-between; gap: 0.35rem;
                margin-bottom: 0.85rem; padding-bottom: 0.65rem;
                border-bottom: 1px solid {c['border_soft']};
            }}
            .qp-panel-title {{
                color: {c['text']}; font-size: 0.95rem; font-weight: 700;
                margin: 0; letter-spacing: -0.01em;
            }}
            .qp-panel-sub {{
                color: {c['text_muted']}; font-size: 0.78rem; font-weight: 400;
            }}
            .qp-summary {{
                background: {c['glass']}; border: 1px solid {c['border']};
                border-left: 3px solid {c['brand']}; border-radius: 0 8px 8px 0;
                padding: 1rem 1.15rem; margin-bottom: 1.25rem;
                color: {c['text']}; font-size: 0.9rem; line-height: 1.6;
            }}
            .qp-section-zone {{
                margin-bottom: 1.5rem;
            }}
            .qp-zone-label {{
                font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
                text-transform: uppercase; color: {c['brand']};
                margin: 0 0 0.65rem 0;
            }}

            .qp-alert-critical {{
                background: rgba(248, 113, 113, 0.08);
                border: 1px solid rgba(248, 113, 113, 0.22);
                border-radius: 6px; padding: 0.85rem 1rem;
                margin-bottom: 0.5rem; color: {c['text']};
            }}
            .qp-footer {{
                color: {c['text_muted']}; font-size: 0.75rem; text-align: center;
                padding: 1.5rem 0 0.5rem; margin-top: 1.5rem;
                border-top: 1px solid {c['border_soft']};
            }}

            /* ── Streamlit overrides ── */
            .stTabs [data-baseweb="tab-list"] {{
                gap: 0.35rem; flex-wrap: nowrap; overflow-x: auto;
                -webkit-overflow-scrolling: touch; scrollbar-width: none;
            }}
            .stTabs [data-baseweb="tab-list"]::-webkit-scrollbar {{ display: none; }}
            .stTabs [data-baseweb="tab"] {{
                background: {c['glass']}; border: 1px solid {c['border']};
                border-radius: 6px; padding: 0.5rem 1rem;
                font-weight: 600; font-size: 0.82rem; color: {c['text_muted']};
                white-space: nowrap; min-height: 44px;
            }}
            .stTabs [aria-selected="true"] {{
                background: {c['brand']} !important; color: #FFFFFF !important;
                border-color: {c['brand']} !important;
            }}
            .stTabs [data-baseweb="tab-panel"] {{ padding-top: 1rem; }}

            [data-testid="stPlotlyChart"] {{
                background: {c['glass_strong']}; border: 1px solid {c['border']};
                border-radius: 8px; padding: 0.35rem; margin-bottom: 0.5rem;
            }}
            [data-testid="stDataFrame"] {{
                border: 1px solid {c['border']}; border-radius: 8px; overflow-x: auto;
            }}
            .stDownloadButton button {{
                border-radius: 6px !important; font-weight: 600 !important;
                background: {c['brand']} !important; min-height: 44px !important;
                width: 100%;
            }}
            .stAlert {{ border-radius: 6px !important; }}

            /* ── Branded loader ── */
            .qp-loader {{
                text-align: center; padding: 2.5rem 1.5rem 2rem;
                margin: 1rem 0 1.5rem;
                background: {c['glass_strong']};
                border: 1px solid {c['border']};
                border-radius: 12px;
                position: relative;
                overflow: hidden;
            }}
            .qp-loader::before {{
                content: "";
                position: absolute; inset: 0;
                background: linear-gradient(90deg, transparent, {c['brand_soft']}, transparent);
                animation: qp-shimmer-sweep 2.2s ease-in-out infinite;
                opacity: 0.35;
            }}
            .qp-loader-ring {{
                width: 72px; height: 72px; margin: 0 auto 1rem;
                border: 3px solid {c['border']};
                border-top-color: {c['brand']};
                border-radius: 50%;
                animation: qp-spin 0.9s linear infinite;
            }}
            .qp-loader-core {{
                font-size: 1.5rem; margin-top: -3.4rem;
                margin-bottom: 2.2rem; position: relative; z-index: 1;
            }}
            .qp-loader-title {{
                color: {c['text']}; font-size: 1.1rem; font-weight: 700;
                margin: 0 0 0.35rem; position: relative; z-index: 1;
            }}
            .qp-loader-msg {{
                color: {c['text_muted']}; font-size: 0.88rem;
                margin: 0 0 1rem; position: relative; z-index: 1;
            }}
            .qp-loader-bar {{
                height: 4px; background: {c['border']};
                border-radius: 999px; overflow: hidden;
                max-width: 320px; margin: 0 auto 1.25rem;
                position: relative; z-index: 1;
            }}
            .qp-loader-fill {{
                height: 100%; background: linear-gradient(90deg, {c['brand']}, {c['accent_soft']});
                border-radius: 999px;
                transition: width 0.45s ease;
            }}
            .qp-load-steps {{
                display: flex; flex-wrap: wrap; justify-content: center;
                gap: 0.5rem 1rem; position: relative; z-index: 1;
            }}
            .qp-load-step {{
                font-size: 0.72rem; color: {c['text_muted']};
                display: flex; align-items: center; gap: 0.35rem;
                opacity: 0.45; transition: opacity 0.3s ease;
            }}
            .qp-load-step-active {{ color: {c['text']}; opacity: 1; font-weight: 600; }}
            .qp-load-step-dot {{
                width: 6px; height: 6px; border-radius: 50%;
                background: {c['border']};
            }}
            .qp-load-step-active .qp-load-step-dot {{
                background: {c['brand']};
                box-shadow: 0 0 8px {c['brand_soft']};
            }}

            /* ── Skeleton shimmer ── */
            .qp-skeleton {{
                background: {c['glass_strong']};
                border: 1px solid {c['border']};
                border-radius: 8px;
                position: relative; overflow: hidden;
            }}
            .qp-skeleton::after {{
                content: "";
                position: absolute; inset: 0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
                animation: qp-shimmer-sweep 1.6s ease-in-out infinite;
            }}
            .qp-skeleton-kpi {{
                min-height: 100px; padding: 1rem;
                margin-bottom: 0.75rem;
            }}
            .qp-skeleton-chart {{
                margin-bottom: 1rem; border-radius: 8px;
            }}
            .qp-skel-line {{
                height: 10px; border-radius: 4px;
                background: {c['border']}; margin-bottom: 0.55rem;
            }}
            .qp-skel-sm {{ width: 45%; height: 8px; }}
            .qp-skel-lg {{ width: 70%; height: 18px; margin: 0.5rem 0; }}
            .qp-skel-md {{ width: 55%; height: 8px; }}

            @keyframes qp-spin {{
                to {{ transform: rotate(360deg); }}
            }}
            @keyframes qp-shimmer-sweep {{
                0% {{ transform: translateX(-100%); }}
                100% {{ transform: translateX(100%); }}
            }}

            /* ── Content fade-in ── */
            .qp-loaded {{
                animation: qp-fade-up 0.55s ease-out both;
            }}
            @keyframes qp-fade-up {{
                from {{ opacity: 0; transform: translateY(10px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}

            /* ── Background refresh badge ── */
            .qp-refresh-badge {{
                display: inline-flex; align-items: center; gap: 0.4rem;
                font-size: 0.72rem; color: {c['text_muted']};
                padding: 0.25rem 0.6rem; border-radius: 4px;
                background: {c['glass']}; border: 1px solid {c['border']};
                margin-bottom: 0.5rem;
            }}
            .qp-refresh-spin {{
                width: 10px; height: 10px;
                border: 2px solid {c['border']};
                border-top-color: {c['brand']};
                border-radius: 50%;
                animation: qp-spin 0.8s linear infinite;
            }}

            /* ── Streamlit native spinner override ── */
            [data-testid="stSpinner"] {{
                border-color: {c['brand']} !important;
            }}
            [data-testid="stSpinner"] > div {{
                border-top-color: {c['brand']} !important;
            }}
            div[data-testid="stStatusWidget"] {{
                background: {c['glass_strong']} !important;
                border: 1px solid {c['border']} !important;
                border-radius: 8px !important;
            }}

            /* ── Mobile: stack columns, compact layout ── */
            @media (max-width: 1024px) {{
                .qp-kpi-value {{ font-size: 1.15rem; }}
            }}
            @media (max-width: 768px) {{
                .block-container {{ padding: 0.75rem 0.85rem 1.5rem; }}
                .qp-header {{ padding: 1.1rem 1.15rem; }}
                .qp-header h1 {{ font-size: 1.2rem; }}
                .qp-kpi-value {{ font-size: 1.15rem; }}
                .qp-chip-hide-mobile {{ display: none !important; }}
                div[data-testid="stHorizontalBlock"] {{ flex-wrap: wrap !important; gap: 0.5rem !important; }}
                div[data-testid="stHorizontalBlock"] > div[data-testid="column"] {{
                    width: 100% !important; flex: 1 1 100% !important; min-width: 100% !important;
                }}
                .stTabs [data-baseweb="tab"] {{ padding: 0.45rem 0.75rem; font-size: 0.78rem; }}
            }}
            @media (max-width: 480px) {{
                .qp-brand {{ flex-direction: row; align-items: center; }}
                .qp-logo {{ width: 40px; height: 40px; font-size: 1.1rem; }}
            }}

            #MainMenu {{visibility: hidden;}}
            footer {{visibility: hidden;}}
            header {{visibility: hidden;}}
        </style>
        """,
        unsafe_allow_html=True,
    )
