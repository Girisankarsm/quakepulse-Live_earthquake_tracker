import { useState } from 'react';
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
                Train acc{' '}
                {accuracy == null ? '—' : `${Math.round(Number(accuracy) * 100)}%`}
              </span>
              <span className="chip">
                {modelInfo?.trainedAt
                  ? `Trained ${formatRelative(modelInfo.trainedAt)}`
                  : p?.model?.trainedAt
                    ? `Trained ${formatRelative(p.model.trainedAt)}`
                    : 'Using live window'}
              </span>
            </div>
            <p className="disclaimer">
              {prediction?.model?.disclaimer ||
                p?.model?.disclaimer ||
                'Nowcast of elevated short-horizon seismic activity — not emergency alerting and not deterministic prediction.'}
            </p>
          </div>
        </div>
      </div>

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

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Earthquake news</h2>
        <span className="panel-sub">
          {place || news?.region || 'Global'} · {list.length} stories
        </span>
      </div>
      {list.map((item) => (
        <a
          key={item.id}
          className="news-card"
          href={item.link}
          target="_blank"
          rel="noreferrer"
        >
          <div className="chip-row">
            <span className="chip">{item.source}</span>
            {item.published || item.publishedAt ? (
              <span className="chip">
                {formatRelative(item.published || item.publishedAt)}
              </span>
            ) : null}
            {item.matchedRegion || item.matchedRegions?.[0] ? (
              <span className="chip chip-live">
                {item.matchedRegion || item.matchedRegions[0]}
              </span>
            ) : null}
          </div>
          <strong>{item.title}</strong>
          {item.summary ? <p>{item.summary}</p> : null}
          {item.relatedEvents?.length ? (
            <div className="meta">
              Related:{' '}
              {item.relatedEvents
                .map((e) => `M${Number(e.magnitude).toFixed(1)} ${e.place}`)
                .join(' · ')}
            </div>
          ) : null}
        </a>
      ))}
      {errors.length ? (
        <p className="meta" style={{ marginTop: '0.75rem' }}>
          Some feeds unavailable: {errors.map((e) => e.error || e).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

export function DataPage({ events }) {
  const list = events?.events || [];
  if (!list.length) {
    return <EmptyState title="No records" body="Nothing to export for the current filters." />;
  }

  const sorted = [...list].sort((a, b) => b.timeMs - a.timeMs);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Event registry</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            downloadText(
              `quakepulse_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`,
              toCsv(sorted),
            )
          }
        >
          Export CSV
        </button>
      </div>

      <div className="event-cards">
        {sorted.slice(0, 80).map((e) => (
          <article key={e.id} className="event-card">
            <div className={`mag-pill ${magClass(e.magnitude)}`}>
              {e.magnitude.toFixed(1)}
            </div>
            <div>
              <strong>{e.place}</strong>
              <div className="meta">
                {formatTime(e.time)} · {e.depth.toFixed(1)} km · {e.region}
              </div>
            </div>
            {e.url ? (
              <a className="btn btn-ghost" href={e.url} target="_blank" rel="noreferrer">
                USGS
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <div className="table-wrap desktop-only">
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
            {sorted.slice(0, 500).map((e) => (
              <tr key={`t-${e.id}`}>
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
      {sorted.length > 80 && (
        <p className="meta" style={{ marginTop: '0.65rem' }}>
          Showing top events on mobile · export CSV for the full set (
          {sorted.length.toLocaleString()}).
        </p>
      )}
    </div>
  );
}
