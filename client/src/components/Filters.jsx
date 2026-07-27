import { useEffect } from 'react';
import { REFRESH_OPTIONS } from '../hooks/useQuakeData';

const PERIODS = [
  { id: 'hour', label: 'Last Hour' },
  { id: 'day', label: 'Last Day' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
];

export function FilterPanel({ filters, updateFilter, compact = false, onReset }) {
  const depthLabel = filters.maxDepth >= 700 ? 'Any' : `${filters.maxDepth} km`;

  return (
    <div>
      {!compact && <p className="section-label">Filters</p>}

      <div className="field">
        <label htmlFor="period">Time window</label>
        <select
          id="period"
          value={filters.period}
          onChange={(e) => updateFilter('period', e.target.value)}
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="minMag">
          Min magnitude <span className="field-value">M {filters.minMagnitude.toFixed(1)}</span>
        </label>
        <input
          id="minMag"
          type="range"
          min="0"
          max="8"
          step="0.1"
          value={filters.minMagnitude}
          onChange={(e) => updateFilter('minMagnitude', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor="maxDepth">
          Max depth <span className="field-value">{depthLabel}</span>
        </label>
        <input
          id="maxDepth"
          type="range"
          min="10"
          max="700"
          step="10"
          value={filters.maxDepth}
          onChange={(e) => updateFilter('maxDepth', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor="place">Location</label>
        <input
          id="place"
          type="search"
          placeholder="e.g. Japan, California"
          value={filters.place}
          onChange={(e) => updateFilter('place', e.target.value)}
          autoComplete="off"
        />
      </div>

      <p className="section-label">Alerts</p>
      <div className="field">
        <label htmlFor="threshold">
          Threshold <span className="field-value">M {filters.alertThreshold.toFixed(1)}</span>
        </label>
        <input
          id="threshold"
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={filters.alertThreshold}
          onChange={(e) => updateFilter('alertThreshold', Number(e.target.value))}
        />
      </div>

      <p className="section-label">System</p>
      <div className="toggle-row">
        <span>Auto-refresh</span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={filters.autoRefresh}
          aria-label="Toggle auto-refresh"
          onClick={() => updateFilter('autoRefresh', !filters.autoRefresh)}
        >
          <span />
        </button>
      </div>

      <div className="field">
        <label htmlFor="refreshSeconds">Update every</label>
        <select
          id="refreshSeconds"
          value={filters.refreshSeconds || 15}
          disabled={!filters.autoRefresh}
          onChange={(e) => updateFilter('refreshSeconds', Number(e.target.value))}
        >
          {REFRESH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {onReset ? (
        <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onReset}>
          Reset filters
        </button>
      ) : null}

      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: '0.5rem 0 0', lineHeight: 1.45 }}>
        Live polls pause when this tab is hidden, then sync on return.
      </p>
    </div>
  );
}

export function FilterDrawer({ open, onClose, filters, updateFilter, onReset }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
        <div className="drawer-handle" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Filters</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
        <FilterPanel
          filters={filters}
          updateFilter={updateFilter}
          onReset={onReset}
          compact
        />
      </div>
    </>
  );
}

export function ActiveFilterChips({ filters, updateFilter, onReset, onOpenFilters }) {
  const periodLabel =
    PERIODS.find((p) => p.id === filters.period)?.label || filters.period;
  const chips = [
    { key: 'period', label: periodLabel },
    filters.minMagnitude > 0
      ? { key: 'minMagnitude', label: `M≥${filters.minMagnitude.toFixed(1)}`, clear: () => updateFilter('minMagnitude', 0) }
      : null,
    filters.maxDepth < 700
      ? { key: 'maxDepth', label: `≤${filters.maxDepth} km`, clear: () => updateFilter('maxDepth', 700) }
      : null,
    filters.place
      ? { key: 'place', label: filters.place, clear: () => updateFilter('place', '') }
      : null,
  ].filter(Boolean);

  return (
    <div className="chip-row filter-chips">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="chip chip-action"
          onClick={c.clear || onOpenFilters}
        >
          {c.label}
          {c.clear ? ' ×' : ''}
        </button>
      ))}
      <button type="button" className="chip chip-action" onClick={onOpenFilters}>
        Filters
      </button>
      {onReset && (filters.minMagnitude > 0 || filters.maxDepth < 700 || filters.place) ? (
        <button type="button" className="chip chip-action" onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );
}
