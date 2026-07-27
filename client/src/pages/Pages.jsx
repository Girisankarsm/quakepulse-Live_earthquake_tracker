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
import { formatTime, magClass, toCsv, downloadText } from '../lib/format';

export function OverviewPage({ summary, analytics }) {
  if (!summary?.kpis?.totalEvents) {
    return (
      <EmptyState
        title="No events match filters"
        body="Widen the time window or lower the magnitude threshold."
      />
    );
  }

  const overview = summary.overview || analytics?.overview;

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
      {analytics?.patterns?.globalRisk && (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Pattern intelligence</h2>
            <span className={`risk-badge risk-${analytics.patterns.globalRisk.level}`}>
              {analytics.patterns.globalRisk.level}
            </span>
          </div>
          <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {analytics.patterns.globalRisk.label} · model confidence{' '}
            {Math.round(
              (analytics.patterns.model?.accuracyEstimate ||
                analytics.patterns.model?.metrics?.accuracy ||
                0) * 100,
            )}
            %
          </p>
          <ul className="insight-list">
            {(analytics.patterns.insights || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function MapPage({ events, analytics }) {
  const list = events?.events || [];
  if (!list.length) {
    return <EmptyState title="No geospatial data" body="Adjust filters to plot events on the map." />;
  }
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Event map</h2>
          <span className="panel-sub">
            {events.sampled
              ? `Showing ${list.length.toLocaleString()} of ${events.total.toLocaleString()} · M≥4 always kept`
              : `${list.length.toLocaleString()} events`}
          </span>
        </div>
        <QuakeMap events={list} mode="cluster" />
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
    return <EmptyState title="No analytics data" body="No events available for depth and regional analysis." />;
  }
  const p = analytics.patterns;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Depth analysis</h2>
          <span className="panel-sub">{p?.depthPatterns?.note}</span>
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

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">ML activity risk</h2>
          <span className={`risk-badge risk-${p?.globalRisk?.level || 'quiet'}`}>
            score {p?.globalRisk?.score ?? 0}
          </span>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          Logistic activity-risk model trained on this window ({p?.model?.trainedOn || 0} events).
          Features: magnitude, rate, shallow ratio, clustering, energy.
        </p>
        {(p?.regions || []).slice(0, 6).map((r) => (
          <div key={r.region} className="data-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <strong>{r.region}</strong>
              <span className={`risk-badge risk-${r.level}`}>{r.riskScore}</span>
            </div>
            <div className="meta">
              {r.eventCount} events · max M{r.maxMagnitude} · {r.ratePerHour}/hr · shallow{' '}
              {Math.round(r.shallowRatio * 100)}%
            </div>
          </div>
        ))}
        {(p?.anomalies || []).length > 0 && (
          <>
            <h3 style={{ fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>Anomalies</h3>
            {p.anomalies.map((a) => (
              <div key={a.id} className="alert-item">
                <strong className={`mag ${magClass(a.magnitude)}`}>M {a.magnitude.toFixed(1)}</strong>{' '}
                · {a.place}
                <div className="meta">
                  z={a.zScore} · {a.reason}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export function AlertsPage({ alerts }) {
  const list = alerts?.alerts || [];
  if (!list.length) {
    return (
      <div className="panel">
        <EmptyState
          title="All clear"
          body={`No events at or above M ${alerts?.threshold?.toFixed?.(1) ?? '—'}.`}
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Alert monitor</h2>
        <span className="panel-sub">
          {list.length} alert{list.length === 1 ? '' : 's'} · M ≥ {alerts.threshold}
        </span>
      </div>
      {list.map((a) => (
        <article key={a.id} className="alert-item">
          <strong className={`mag ${magClass(a.magnitude)}`}>M {a.magnitude.toFixed(1)}</strong>
          {' · '}
          {a.place}
          <div className="meta">
            {a.depth.toFixed(1)} km · {formatTime(a.time)}
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
      ))}
    </div>
  );
}

export function NewsPage({ news, place }) {
  const list = news?.items || [];
  if (!list.length) {
    return (
      <EmptyState
        title="No news yet"
        body="Seismic news feeds are quiet or temporarily unavailable. Try again shortly."
      />
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Seismic news</h2>
        <span className="panel-sub">
          {place ? `Focused on ${place}` : 'Global coverage'} · {list.length} stories
        </span>
      </div>
      {list.map((item) => (
        <article key={item.id} className="news-item">
          <a href={item.link} target="_blank" rel="noreferrer">
            <strong>{item.title}</strong>
          </a>
          {item.summary ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {item.summary}
            </p>
          ) : null}
          <div className="meta">
            {item.source}
            {item.published ? ` · ${formatTime(item.published)}` : ''}
          </div>
        </article>
      ))}
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
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Mag</th>
              <th>Depth</th>
              <th>Place</th>
              <th>Lat</th>
              <th>Lon</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 500).map((e) => (
              <tr key={e.id}>
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
                <td>{e.latitude.toFixed(3)}</td>
                <td>{e.longitude.toFixed(3)}</td>
                <td>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 500 && (
        <p className="meta" style={{ marginTop: '0.65rem' }}>
          Showing 500 of {sorted.length.toLocaleString()} — export CSV for the full sample set.
        </p>
      )}
    </div>
  );
}
