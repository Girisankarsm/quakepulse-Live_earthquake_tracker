import { useEffect, useMemo, useState } from 'react';
import {
  MagnitudeTrendChart,
  MagHistogram,
  EnergyChart,
  DepthScatter,
  DepthBinsChart,
  RegionsChart,
  TimelineChart,
} from '../components/Charts';
import { QuakeMap } from '../components/QuakeMap';
import { EmptyState } from '../components/Status';
import {
  formatTime,
  formatRelative,
  magClass,
  toCsv,
  downloadText,
} from '../lib/format';

export function OverviewPage({ summary, analytics, onOpenPredict }) {
  if (!summary?.kpis?.totalEvents) {
    return (
      <EmptyState
        title="No events match filters"
        body="Widen the time window or lower the magnitude threshold."
      />
    );
  }

  const overview = summary.overview || analytics?.overview;
  const risk = analytics?.patterns?.globalRisk;
  const insights = analytics?.patterns?.insights || [];

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Activity trends</h2>
          <span className="panel-sub">Hourly patterns & magnitude spread</span>
        </div>
        <div className="chart-grid">
          <MagnitudeTrendChart data={overview?.hourly} />
          <MagHistogram data={overview?.magnitudeHistogram} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Cumulative energy</h2>
          <span className="panel-sub">Gutenberg–Richter release</span>
        </div>
        <EnergyChart data={overview?.cumulativeEnergy} />
      </div>

      {risk && (
        <div className="panel risk-hero">
          <div className="panel-head">
            <h2 className="panel-title">Activity nowcast</h2>
            <span className={`risk-badge risk-${risk.level}`}>{risk.level}</span>
          </div>
          <div className="risk-score-row">
            <div className="risk-ring" style={{ '--pct': Math.min(100, Number(risk.score) || 0) }}>
              <strong>{Math.round(Number(risk.score) || 0)}</strong>
              <span>score</span>
            </div>
            <div>
              <p className="risk-label">{risk.label}</p>
              <p className="meta" style={{ margin: '0.35rem 0 0.75rem' }}>
                Short-horizon elevated activity signal — not a deterministic quake prediction.
              </p>
              {onOpenPredict ? (
                <button type="button" className="btn btn-primary" onClick={onOpenPredict}>
                  Open Predict
                </button>
              ) : null}
            </div>
          </div>
          {insights.length > 0 && (
            <ul className="insight-list">
              {insights.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export function MapPage({ events, analytics }) {
  const [mode, setMode] = useState('cluster');
  const list = events?.events || [];

  if (!list.length) {
    return (
      <EmptyState title="No geospatial data" body="Adjust filters to plot events on the map." />
    );
  }

  return (
    <>
      <div className="panel panel-map">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Event map</h2>
            <span className="panel-sub">
              {events.sampled
                ? `Showing ${list.length.toLocaleString()} of ${events.total.toLocaleString()} · M≥4 kept`
                : `${list.length.toLocaleString()} events`}
            </span>
          </div>
          <div className="segmented" role="group" aria-label="Map mode">
            <button
              type="button"
              className={mode === 'cluster' ? 'active' : ''}
              onClick={() => setMode('cluster')}
            >
              Clusters
            </button>
            <button
              type="button"
              className={mode === 'points' ? 'active' : ''}
              onClick={() => setMode('points')}
            >
              Points
            </button>
          </div>
        </div>
        <QuakeMap events={list} mode={mode} tall />
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Depth vs magnitude</h2>
          <span className="panel-sub">Cross-section view</span>
        </div>
        <DepthScatter data={analytics?.depth?.scatter || list} />
      </div>
    </>
  );
}

export function AnalyticsPage({ analytics }) {
  if (!analytics?.kpis?.totalEvents) {
    return (
      <EmptyState
        title="No analytics data"
        body="No events available for depth and regional analysis."
      />
    );
  }
  const p = analytics.patterns;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Depth analysis</h2>
          <span className="panel-sub">{p?.depthPatterns?.note || 'Focal depth distribution'}</span>
        </div>
        <div className="chart-grid">
          <DepthBinsChart data={analytics.depth?.depthBins} />
          <div>
            {(analytics.depth?.profiles || []).map((row) => (
              <div key={row.category} className="data-row" style={{ marginBottom: '0.55rem' }}>
                <strong>{row.category}</strong>
                <div className="meta">
                  {row.count} events · avg M{row.avgMagnitude} · avg {row.avgDepth} km · energy{' '}
                  {row.energySharePct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Regional hotspots</h2>
          <span className="panel-sub">Event concentration by region</span>
        </div>
        <div className="chart-grid">
          <RegionsChart data={analytics.regions} />
          <TimelineChart data={analytics.timeline} />
        </div>
      </div>
    </>
  );
}

export function PredictPage({
  analytics,
  prediction,
  modelInfo,
  dataset,
  training,
  onTrain,
}) {
  const p = analytics?.patterns;
  const global = prediction?.global || p?.globalRisk;
  const forecasts = prediction?.forecasts || p?.forecasts || [];
  const anomalies = p?.anomalies || [];
  const clusters = p?.clusters || [];
  const metrics = modelInfo?.metrics || p?.model?.metrics;
  const accuracy = metrics?.accuracy ?? p?.model?.accuracyEstimate;
  const depthBins = dataset?.depth?.bins || {};
  const magBins = dataset?.magnitude?.bins || {};

  return (
    <>
      <div className="panel risk-hero">
        <div className="panel-head">
          <h2 className="panel-title">Early activity risk</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onTrain}
            disabled={training}
          >
            {training ? 'Training…' : 'Retrain model'}
          </button>
        </div>
        <div className="risk-score-row">
          <div
            className="risk-ring"
            style={{ '--pct': Math.min(100, Number(global?.score) || 0) }}
          >
            <strong>{Math.round(Number(global?.score) || 0)}</strong>
            <span>global</span>
          </div>
          <div>
            <p className="risk-label">
              <span className={`risk-badge risk-${global?.level || 'quiet'}`}>
                {global?.level || 'quiet'}
              </span>{' '}
              {global?.label || 'Baseline activity'}
            </p>
            <div className="chip-row" style={{ marginTop: 10 }}>
              <span className="chip">
                Horizon {prediction?.model?.horizonHours || modelInfo?.horizonHours || 6}h
              </span>
              <span className="chip">
                Acc {accuracy == null ? '—' : `${Math.round(Number(accuracy) * 100)}%`}
                {metrics?.f1 != null ? ` · F1 ${Math.round(metrics.f1 * 100)}%` : ''}
              </span>
              <span className="chip">
                {modelInfo?.trainedAt
                  ? `Trained ${formatRelative(modelInfo.trainedAt)}`
                  : 'Using live window'}
              </span>
              {modelInfo?.autoTrain?.enabled ? (
                <span className="chip">
                  Auto-train{' '}
                  {modelInfo.autoTrain.running
                    ? 'running…'
                    : modelInfo.autoTrain.nextRunAt
                      ? `next ${formatRelative(modelInfo.autoTrain.nextRunAt)}`
                      : 'on'}
                </span>
              ) : null}
            </div>
            <p className="disclaimer">
              {prediction?.model?.disclaimer ||
                p?.model?.disclaimer ||
                'Nowcast of elevated short-horizon seismic activity — not emergency alerting and not deterministic prediction.'}
            </p>
          </div>
        </div>
      </div>

      {dataset?.loaded ? (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Collected catalog</h2>
            <span className="panel-sub">
              {dataset.format} · {dataset.bytesLabel || '—'} · schema v
              {dataset.schemaVersion ?? '—'}
            </span>
          </div>
          <div className="chip-row" style={{ marginBottom: '0.85rem' }}>
            <span className="chip">{Number(dataset.count || 0).toLocaleString()} events</span>
            <span className="chip">
              M4+ {dataset.magnitude?.m4Plus ?? 0} · M5+ {dataset.magnitude?.m5Plus ?? 0} · M6+{' '}
              {dataset.magnitude?.m6Plus ?? 0}
            </span>
            <span className="chip">
              Depth avg {dataset.depth?.avgKm ?? '—'} km · shallow {dataset.depth?.shallowPct ?? '—'}%
            </span>
            {dataset.window?.days ? (
              <span className="chip">{dataset.window.days}d window</span>
            ) : null}
          </div>
          <div className="chart-grid">
            <div>
              <h3 style={{ fontSize: '0.8rem', margin: '0 0 0.45rem' }}>Depth bins</h3>
              {Object.entries(depthBins).map(([k, v]) => (
                <div key={k} className="data-row" style={{ marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{k} km</span>
                    <strong>{v}</strong>
                  </div>
                  <div className="risk-bar" aria-hidden>
                    <span
                      style={{
                        width: `${Math.min(100, (v / Math.max(1, dataset.count)) * 100 * 3)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ fontSize: '0.8rem', margin: '0 0 0.45rem' }}>Magnitude bins</h3>
              {Object.entries(magBins).map(([k, v]) => (
                <div key={k} className="data-row" style={{ marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>M {k}</span>
                    <strong>{v}</strong>
                  </div>
                  <div className="risk-bar" aria-hidden>
                    <span
                      style={{
                        width: `${Math.min(100, (v / Math.max(1, dataset.count)) * 100 * 3)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {(dataset.sample || []).length > 0 && (
            <>
              <h3 style={{ fontSize: '0.8rem', margin: '1rem 0 0.45rem' }}>Latest collected</h3>
              {dataset.sample.slice(0, 6).map((e) => (
                <div key={e.id} className="data-row">
                  <strong className={`mag ${magClass(e.magnitude)}`}>
                    M {Number(e.magnitude).toFixed(1)}
                  </strong>{' '}
                  · {e.place}
                  <div className="meta">
                    {e.depth} km · {formatTime(e.time)}
                    {e.source ? ` · ${e.source}` : ''}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Regional forecasts</h2>
          <span className="panel-sub">Highest short-horizon risk cells</span>
        </div>
        {(forecasts.length ? forecasts : p?.regions || []).slice(0, 10).map((r) => (
          <div key={r.region || r.id} className="data-row forecast-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <strong>{r.region}</strong>
              <span className={`risk-badge risk-${r.level || 'quiet'}`}>
                {r.riskScore ?? Math.round((r.avgRisk || 0) * 100)}
              </span>
            </div>
            <div className="meta">
              {(r.eventCount ?? r.count) != null ? `${r.eventCount ?? r.count} events · ` : ''}
              max M{(r.maxMagnitude ?? r.maxMag ?? 0).toFixed?.(1) ?? r.maxMagnitude}
              {r.ratePerHour != null ? ` · ${r.ratePerHour}/hr` : ''}
            </div>
            <div className="risk-bar" aria-hidden>
              <span style={{ width: `${Math.min(100, Number(r.riskScore) || 0)}%` }} />
            </div>
          </div>
        ))}
        {!forecasts.length && !(p?.regions || []).length ? (
          <EmptyState title="No forecasts yet" body="Retrain on a wider window for more signal." />
        ) : null}
      </div>

      <div className="chart-grid">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Anomalies</h2>
            <span className="panel-sub">Outliers & local swarms</span>
          </div>
          {anomalies.slice(0, 8).map((a) => (
            <div key={a.id} className="alert-item">
              <strong className={`mag ${magClass(a.magnitude)}`}>
                M {Number(a.magnitude).toFixed(1)}
              </strong>{' '}
              · {a.place}
              <div className="meta">
                z={Number(a.zScore).toFixed?.(2) ?? a.zScore} · {a.reason}
              </div>
            </div>
          ))}
          {!anomalies.length ? (
            <EmptyState title="No anomalies" body="Current window looks statistically calm." />
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Seismic cells</h2>
            <span className="panel-sub">K-means geographic clusters</span>
          </div>
          {clusters.slice(0, 6).map((c) => (
            <div key={c.id} className="data-row">
              <strong>
                Cell {Number(c.id) + 1}
                {c.region ? ` · ${c.region}` : ''}
              </strong>
              <div className="meta">
                {c.count} events · avg M{Number(c.avgMagnitude).toFixed(2)} · max M
                {Number(c.maxMagnitude).toFixed(1)}
              </div>
            </div>
          ))}
          {!clusters.length ? (
            <EmptyState title="Not enough events" body="Need more points to form clusters." />
          ) : null}
        </div>
      </div>
    </>
  );
}

export function AlertsPage({ alerts, filters, updateFilter }) {
  const list = alerts?.alerts || [];
  const threshold = filters?.alertThreshold ?? alerts?.threshold ?? 5;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Alert monitor</h2>
        <span className="panel-sub">
          {list.length} alert{list.length === 1 ? '' : 's'} · M ≥ {Number(threshold).toFixed(1)}
        </span>
      </div>

      {updateFilter ? (
        <div className="field" style={{ marginBottom: '1rem', maxWidth: 320 }}>
          <label htmlFor="alertThresholdInline">
            Threshold <span className="field-value">M {Number(threshold).toFixed(1)}</span>
          </label>
          <input
            id="alertThresholdInline"
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={threshold}
            onChange={(e) => updateFilter('alertThreshold', Number(e.target.value))}
          />
        </div>
      ) : null}

      {!list.length ? (
        <EmptyState
          title="All clear"
          body={`No events at or above M ${Number(threshold).toFixed(1)}. Lower the threshold to see more.`}
        />
      ) : (
        list.map((a) => (
          <article key={a.id} className="alert-item">
            <strong className={`mag ${magClass(a.magnitude)}`}>M {a.magnitude.toFixed(1)}</strong>
            {' · '}
            {a.place}
            <div className="meta">
              {a.depth.toFixed(1)} km · {formatTime(a.time)}
              {a.tsunami ? ' · tsunami flag' : ''}
              {a.url ? (
                <>
                  {' · '}
                  <a href={a.url} target="_blank" rel="noreferrer">
                    USGS
                  </a>
                </>
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export function NewsPage({ news, place, onRetry }) {
  const list = news?.items || [];
  const errors = news?.errors || [];
  const [openBranches, setOpenBranches] = useState(() => new Set(['today', 'yesterday', 'week', 'older']));

  if (!list.length) {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <EmptyState
          title="No news yet"
          body={
            errors.length
              ? 'Feeds are temporarily unavailable. Retry in a moment.'
              : 'Seismic news is quiet for this region. Try a broader location or window.'
          }
        />
        {onRetry ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Retry news
          </button>
        ) : null}
      </div>
    );
  }

  const featured = list[0];
  const rest = list.slice(1);
  const tree = groupNewsByTime(rest.length ? rest : list);
  const sources = [...new Set(list.map((i) => i.source).filter(Boolean))];

  function toggleBranch(id) {
    setOpenBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="news-layout">
      <header className="news-hero panel">
        <div className="panel-head">
          <div>
            <p className="section-label" style={{ marginBottom: '0.35rem' }}>
              Coverage tree
            </p>
            <h2 className="panel-title">Earthquake news</h2>
          </div>
          <span className="panel-sub">
            {place || news?.region || 'Global'} · {list.length} stories · {sources.length} sources
          </span>
        </div>

        <a
          className="news-feature"
          href={featured.link}
          target="_blank"
          rel="noreferrer"
          style={{ '--i': 0 }}
        >
          <div className="news-feature-rail" aria-hidden />
          <div className="news-feature-body">
            <div className="chip-row" style={{ margin: 0 }}>
              <span className="chip chip-live">Lead</span>
              <span className="chip">{featured.source}</span>
              {featured.published || featured.publishedAt ? (
                <span className="chip">
                  {formatRelative(featured.published || featured.publishedAt)}
                </span>
              ) : null}
            </div>
            <h3>{featured.title}</h3>
            {featured.summary ? <p>{featured.summary}</p> : null}
            <span className="news-read">Open story →</span>
          </div>
        </a>
      </header>

      <div className="news-tree panel">
        <div className="tree-root">
          <span className="tree-node-mark" aria-hidden />
          <div>
            <strong>Timeline</strong>
            <div className="meta">Stories grouped by recency</div>
          </div>
        </div>

        {tree.map((branch, bi) => (
          <section key={branch.id} className="tree-branch" style={{ '--i': bi + 1 }}>
            <button
              type="button"
              className="tree-branch-head"
              onClick={() => toggleBranch(branch.id)}
              aria-expanded={openBranches.has(branch.id)}
            >
              <span className="tree-connector" aria-hidden />
              <span className={`tree-caret${openBranches.has(branch.id) ? ' is-open' : ''}`} aria-hidden>
                ▸
              </span>
              <span className="tree-branch-label">{branch.label}</span>
              <span className="tree-count">{branch.items.length}</span>
            </button>

            {openBranches.has(branch.id) ? (
              <ul className="tree-leaves">
                {branch.items.map((item, ii) => (
                  <li key={item.id} style={{ '--i': ii }}>
                    <a className="news-leaf" href={item.link} target="_blank" rel="noreferrer">
                      <span className="tree-leaf-dot" aria-hidden />
                      <div className="news-leaf-body">
                        <div className="news-leaf-meta">
                          <span>{item.source}</span>
                          {(item.published || item.publishedAt) && (
                            <span>{formatRelative(item.published || item.publishedAt)}</span>
                          )}
                          {(item.matchedRegion || item.matchedRegions?.[0]) && (
                            <span className="news-region">
                              {item.matchedRegion || item.matchedRegions[0]}
                            </span>
                          )}
                        </div>
                        <strong>{item.title}</strong>
                        {item.summary ? <p>{item.summary}</p> : null}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {sources.length > 1 ? (
        <aside className="news-sources panel">
          <div className="panel-head">
            <h2 className="panel-title">Sources</h2>
            <span className="panel-sub">Feed branches</span>
          </div>
          <div className="source-tree">
            {sources.map((src, i) => {
              const count = list.filter((x) => x.source === src).length;
              return (
                <div key={src} className="source-branch" style={{ '--i': i }}>
                  <span className="source-dot" aria-hidden />
                  <span className="source-name">{src}</span>
                  <span className="tree-count">{count}</span>
                </div>
              );
            })}
          </div>
        </aside>
      ) : null}

      {errors.length ? (
        <p className="meta" style={{ marginTop: '0.25rem' }}>
          Some feeds unavailable: {errors.map((e) => e.error || e).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

function groupNewsByTime(items) {
  const now = Date.now();
  const day = 86_400_000;
  const buckets = {
    today: { id: 'today', label: 'Today', items: [] },
    yesterday: { id: 'yesterday', label: 'Yesterday', items: [] },
    week: { id: 'week', label: 'This week', items: [] },
    older: { id: 'older', label: 'Earlier', items: [] },
  };

  for (const item of items) {
    const t = Date.parse(item.published || item.publishedAt || '') || 0;
    const age = t ? now - t : day * 10;
    if (age < day) buckets.today.items.push(item);
    else if (age < day * 2) buckets.yesterday.items.push(item);
    else if (age < day * 7) buckets.week.items.push(item);
    else buckets.older.items.push(item);
  }

  return Object.values(buckets).filter((b) => b.items.length);
}

export function DataPage({ events }) {
  const list = events?.events || [];
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('time');
  const [openRegions, setOpenRegions] = useState(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [view, setView] = useState('tree');

  const filtered = useMemo(() => {
    if (!list.length) return [];
    return list.filter((e) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        e.place.toLowerCase().includes(q) ||
        (e.region || '').toLowerCase().includes(q) ||
        String(e.magnitude).includes(q)
      );
    });
  }, [list, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'mag') return b.magnitude - a.magnitude;
      if (sort === 'depth') return a.depth - b.depth;
      return b.timeMs - a.timeMs;
    });
  }, [filtered, sort]);

  const byRegion = useMemo(() => groupEventsByRegion(sorted), [sorted]);

  useEffect(() => {
    if (seeded || !byRegion.length) return;
    setOpenRegions(new Set(byRegion.slice(0, 3).map((r) => r.region)));
    setSeeded(true);
  }, [byRegion, seeded]);

  if (!list.length) {
    return <EmptyState title="No records" body="Nothing to export for the current filters." />;
  }

  const maxMag = Math.max(...sorted.map((e) => e.magnitude), 0);
  const avgMag = sorted.length
    ? sorted.reduce((s, e) => s + e.magnitude, 0) / sorted.length
    : 0;

  function toggleRegion(region) {
    setOpenRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  function exportCsv() {
    downloadText(
      `quakepulse_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`,
      toCsv(sorted),
    );
  }

  return (
    <div className="data-layout">
      <header className="data-toolbar panel">
        <div className="panel-head">
          <div>
            <p className="section-label" style={{ marginBottom: '0.35rem' }}>
              Event registry
            </p>
            <h2 className="panel-title">Structured catalog</h2>
          </div>
          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>

        <div className="data-stats">
          <div className="data-stat">
            <span>Events</span>
            <strong>{sorted.length.toLocaleString()}</strong>
          </div>
          <div className="data-stat">
            <span>Regions</span>
            <strong>{byRegion.length}</strong>
          </div>
          <div className="data-stat">
            <span>Peak</span>
            <strong className={`mag ${magClass(maxMag)}`}>M {maxMag.toFixed(1)}</strong>
          </div>
          <div className="data-stat">
            <span>Avg</span>
            <strong>M {avgMag.toFixed(2)}</strong>
          </div>
        </div>

        <div className="data-controls">
          <input
            type="search"
            className="data-search"
            placeholder="Search place or region…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search events"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort events"
          >
            <option value="time">Newest first</option>
            <option value="mag">Largest first</option>
            <option value="depth">Shallowest first</option>
          </select>
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={view === 'tree' ? 'is-active' : ''}
              onClick={() => setView('tree')}
            >
              Tree
            </button>
            <button
              type="button"
              className={view === 'table' ? 'is-active' : ''}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>
      </header>

      {view === 'tree' ? (
        <div className="data-tree panel">
          <div className="tree-root">
            <span className="tree-node-mark" aria-hidden />
            <div>
              <strong>By region</strong>
              <div className="meta">Expand a branch to inspect events</div>
            </div>
          </div>

          {byRegion.map((branch, bi) => {
            const open = openRegions.has(branch.region);
            return (
              <section key={branch.region} className="tree-branch" style={{ '--i': bi }}>
                <button
                  type="button"
                  className="tree-branch-head"
                  onClick={() => toggleRegion(branch.region)}
                  aria-expanded={open}
                >
                  <span className="tree-connector" aria-hidden />
                  <span className={`tree-caret${open ? ' is-open' : ''}`} aria-hidden>
                    ▸
                  </span>
                  <span className="tree-branch-label">{branch.region}</span>
                  <span className={`mag ${magClass(branch.maxMag)}`}>
                    M {branch.maxMag.toFixed(1)}
                  </span>
                  <span className="tree-count">{branch.events.length}</span>
                </button>

                {open ? (
                  <ul className="tree-leaves data-leaves">
                    {branch.events.slice(0, 40).map((e, ii) => (
                      <li key={e.id} style={{ '--i': ii }}>
                        <article className="data-leaf">
                          <span className={`mag-pill ${magClass(e.magnitude)}`}>
                            {e.magnitude.toFixed(1)}
                          </span>
                          <div className="data-leaf-body">
                            <strong>{e.place}</strong>
                            <div className="meta">
                              {formatTime(e.time)} · {e.depth.toFixed(1)} km · {e.status}
                              {e.tsunami ? ' · tsunami' : ''}
                            </div>
                          </div>
                          {e.url ? (
                            <a className="btn btn-ghost" href={e.url} target="_blank" rel="noreferrer">
                              USGS
                            </a>
                          ) : null}
                        </article>
                      </li>
                    ))}
                    {branch.events.length > 40 ? (
                      <li className="meta" style={{ paddingLeft: '1.75rem' }}>
                        +{branch.events.length - 40} more in this region — export CSV for full set
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </section>
            );
          })}

          {!byRegion.length ? (
            <EmptyState title="No matches" body="Try a different search term." />
          ) : null}
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Mag</th>
                  <th>Depth</th>
                  <th>Place</th>
                  <th>Region</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 400).map((e, i) => (
                  <tr key={e.id} style={{ '--i': Math.min(i, 24) }} className="data-row-anim">
                    <td>{formatTime(e.time)}</td>
                    <td className={`mag ${magClass(e.magnitude)}`}>{e.magnitude.toFixed(1)}</td>
                    <td>{e.depth.toFixed(1)}</td>
                    <td>
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.place}
                        </a>
                      ) : (
                        e.place
                      )}
                    </td>
                    <td>{e.region}</td>
                    <td>{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 400 ? (
            <p className="meta" style={{ marginTop: '0.65rem' }}>
              Showing 400 of {sorted.length.toLocaleString()} — export CSV for the full set.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function groupEventsByRegion(events) {
  const map = new Map();
  for (const e of events) {
    const key = e.region || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.entries()]
    .map(([region, evs]) => ({
      region,
      events: evs,
      maxMag: Math.max(...evs.map((e) => e.magnitude)),
    }))
    .sort((a, b) => b.events.length - a.events.length || b.maxMag - a.maxMag);
}
