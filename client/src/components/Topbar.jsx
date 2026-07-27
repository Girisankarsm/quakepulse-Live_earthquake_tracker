import { BrandMark } from './icons';

export function Topbar({ refreshing, onRefresh, onOpenFilters, filtersOpen }) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <strong>QuakePulse</strong>
          <span>Global Seismic Intelligence</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh data"
          title="Refresh"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : undefined }}
          >
            <path d="M20 12a8 8 0 10-2.3 5.5" />
            <path d="M20 5v5h-5" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Open filters"
          aria-pressed={filtersOpen}
          title="Filters"
          onClick={onOpenFilters}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
