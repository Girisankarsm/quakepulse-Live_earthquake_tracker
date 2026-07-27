import { useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { BottomNav, SideNav } from './components/Nav';
import { FilterPanel, FilterDrawer } from './components/Filters';
import {
  StatusBar,
  KpiGrid,
  SkeletonDashboard,
  EmptyState,
  Toast,
} from './components/Status';
import { BrandMark } from './components/icons';
import {
  OverviewPage,
  MapPage,
  AnalyticsPage,
  AlertsPage,
  NewsPage,
  DataPage,
} from './pages/Pages';
import { useQuakeData } from './hooks/useQuakeData';

const TITLES = {
  overview: 'Seismic overview',
  map: 'Event map',
  analytics: 'Depth & patterns',
  alerts: 'Alert monitor',
  news: 'Earthquake news',
  data: 'Event registry',
};

export default function App() {
  const [page, setPage] = useState('overview');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const data = useQuakeData();

  useEffect(() => {
    if (!data.error) return;
    pushToast(data.error, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.error]);

  function pushToast(message, type = 'success') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  async function handleRefresh() {
    try {
      await data.reload();
      pushToast('Feed synced', 'success');
    } catch {
      /* error toast via effect */
    }
  }

  if (data.boot && !data.summary) {
    return (
      <div className="boot-loader">
        <div>
          <BrandMark />
          <h1>QuakePulse</h1>
          <p>Connecting to USGS seismic feeds…</p>
          <div className="progress-bar">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Topbar
        refreshing={data.refreshing}
        onRefresh={handleRefresh}
        onOpenFilters={() => setFiltersOpen(true)}
        filtersOpen={filtersOpen}
      />

      <aside className="sidebar" aria-label="Controls">
        <SideNav page={page} onChange={setPage} />
        <FilterPanel filters={data.filters} updateFilter={data.updateFilter} />
      </aside>

      <main className="main">
        <div className="page-head">
          <p className="eyebrow">QuakePulse</p>
          <h1 className="page-title">{TITLES[page]}</h1>
        </div>

        <StatusBar
          summary={data.summary}
          refreshing={data.refreshing}
          error={data.error}
        />

        {data.loading && !data.summary ? (
          <SkeletonDashboard />
        ) : (
          <>
            {data.error && !data.summary && (
              <div className="panel" style={{ textAlign: 'center' }}>
                <EmptyState title="Unable to load feed" body={data.error} />
                <button type="button" className="btn btn-primary" onClick={handleRefresh}>
                  Retry
                </button>
              </div>
            )}

            {data.summary && (
              <>
                <KpiGrid kpis={data.summary.kpis} />
                {page === 'overview' && (
                  <p className="summary">{data.summary.executiveSummary}</p>
                )}

                {page === 'overview' && (
                  <OverviewPage summary={data.summary} analytics={data.analytics} />
                )}
                {page === 'map' && (
                  <MapPage events={data.events} analytics={data.analytics} />
                )}
                {page === 'analytics' && <AnalyticsPage analytics={data.analytics} />}
                {page === 'alerts' && <AlertsPage alerts={data.alerts} />}
                {page === 'news' && (
                  <NewsPage news={data.news} place={data.filters.place} />
                )}
                {page === 'data' && <DataPage events={data.events} />}
              </>
            )}
          </>
        )}

        <p className="footer-note">
          QuakePulse v3 · For informational and analytical purposes only. Not for operational
          emergency response. Data © USGS.
        </p>
      </main>

      <BottomNav page={page} onChange={setPage} />
      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={data.filters}
        updateFilter={data.updateFilter}
      />
      <Toast toasts={toasts} />
    </div>
  );
}
