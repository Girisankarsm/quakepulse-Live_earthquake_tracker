import { formatUtc } from '../lib/format';

export function StatusBar({
  summary,
  refreshing,
  error,
  autoRefresh = true,
  secondsToRefresh = null,
  refreshSeconds = 30,
  partialErrors = [],
}) {
  if (!summary && !error) return null;

  let nextLabel = null;
  if (autoRefresh && !error) {
    if (refreshing) nextLabel = 'Updating now';
    else if (secondsToRefresh == null) nextLabel = `Every ${refreshSeconds}s`;
    else if (secondsToRefresh <= 0) nextLabel = 'Updating…';
    else nextLabel = `Next ${secondsToRefresh}s`;
  } else if (!autoRefresh) {
    nextLabel = 'Auto-refresh off';
  }

  const degraded = Boolean(error) || partialErrors.length > 0;

  return (
    <div className="status-row" aria-live="polite">
      <span className={`chip ${degraded ? '' : 'chip-live'}`}>
        {!degraded && <span className="dot" />}
        {error ? 'Degraded' : partialErrors.length ? 'Partial' : refreshing ? 'Syncing' : 'Live'}
      </span>
      {nextLabel ? <span className="chip">{nextLabel}</span> : null}
      <span className="chip">{formatUtc(summary?.fetchedAt)}</span>
      <span className="chip">{summary?.label || '—'}</span>
      <span className="chip">
        {(summary?.kpis?.totalEvents ?? 0).toLocaleString()} events
      </span>
      {summary?.cached && <span className="chip">Cached</span>}
      {summary?.stale && <span className="chip">Stale fallback</span>}
    </div>
  );
}

export function KpiGrid({ kpis }) {
  if (!kpis) return null;
  const items = [
    { label: 'Total Events', value: kpis.totalEvents.toLocaleString(), sub: 'Selected window' },
    { label: 'Avg Magnitude', value: kpis.averageMagnitude.toFixed(2), sub: 'Mean value' },
    {
      label: 'Largest Event',
      value: `M ${kpis.largestMagnitude.toFixed(1)}`,
      sub: kpis.largestPlace,
    },
    { label: 'Significant', value: kpis.significantEvents.toLocaleString(), sub: 'Events ≥ M4.5' },
    {
      label: 'Energy',
      value: kpis.energyLabel,
      sub: `${kpis.shallowEventsPct}% shallow`,
    },
  ];

  return (
    <div className="kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="kpi">
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value">{item.value}</div>
          <div className="kpi-sub" title={item.sub}>
            {item.sub}
          </div>
        </article>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div aria-hidden>
      <div className="kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-kpi" />
        ))}
      </div>
      <div className="panel">
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line" style={{ width: '90%' }} />
        <div className="skeleton skeleton-line" style={{ width: '70%' }} />
        <div className="skeleton" style={{ height: 220, marginTop: '0.75rem' }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div className="empty">
      <div className="empty-illu" aria-hidden>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 13c3-1 5 2 8 1s4-4 8-3" />
        </svg>
      </div>
      <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.35rem' }}>
        {title}
      </strong>
      <p style={{ margin: 0 }}>{body}</p>
    </div>
  );
}

export function Toast({ toasts }) {
  if (!toasts?.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'success'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
