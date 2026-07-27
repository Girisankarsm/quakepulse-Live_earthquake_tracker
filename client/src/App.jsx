import { useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { BottomNav, SideNav } from './components/Nav';
import { FilterPanel, FilterDrawer, ActiveFilterChips } from './components/Filters';
import {
  StatusBar,
  KpiGrid,
  SkeletonDashboard,
  EmptyState,
  Toast,
} from './components/Status';
import { BootLoader } from './components/BootLoader';
import {
  OverviewPage,
  MapPage,
  AnalyticsPage,
  PredictPage,
  AlertsPage,
  NewsPage,
  DataPage,
} from './pages/Pages';
import { useQuakeData } from './hooks/useQuakeData';

const TITLES = {
  overview: 'Seismic overview',
  map: 'Event map',
  analytics: 'Depth & regions',
  predict: 'Pattern predict',
  alerts: 'Alert monitor',
  news: 'Earthquake news',
  data: 'Event registry',
};

const SHOW_KPIS = new Set(['overview', 'analytics', 'predict']);

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
    setToasts((t) => [...t.slice(-4), { id, message, type }]);
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

  async function handleTrain() {
    try {
      await data.trainModel();
      pushToast('Model retrained', 'success');
    } catch (err) {
      pushToast(err.message || 'Training failed', 'error');
    }
  }

  if (data.boot && !data.summary) {
    return <BootLoader />;
  }

  return (
    <div className={`app-shell${data.refreshing ? ' is-refreshing' : ''}`}>
      <Topbar
        refreshing={data.refreshing}
        onRefresh={handleRefresh}
        onOpenFilters={() => setFiltersOpen(true)}
        filtersOpen={filtersOpen}
      />

      <aside className="sidebar" aria-label="Controls">
        <SideNav page={page} onChange={setPage} />
        <FilterPanel
          filters={data.filters}
          updateFilter={data.updateFilter}
          onReset={data.resetFilters}
        />
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
          autoRefresh={data.filters.autoRefresh}
          secondsToRefresh={data.secondsToRefresh}
          refreshSeconds={data.filters.refreshSeconds}
          partialErrors={data.partialErrors}
        />

        <ActiveFilterChips
          filters={data.filters}
          updateFilter={data.updateFilter}
          onReset={data.resetFilters}
          onOpenFilters={() => setFiltersOpen(true)}
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
              <div className={data.refreshing ? 'content-dim' : undefined}>
                {SHOW_KPIS.has(page) && <KpiGrid kpis={data.summary.kpis} />}
                {page === 'overview' && data.summary.executiveSummary ? (
                  <p className="summary">{data.summary.executiveSummary}</p>
                ) : null}

                {page === 'overview' && (
                  <OverviewPage
                    summary={data.summary}
                    analytics={data.analytics}
                    onOpenPredict={() => setPage('predict')}
                  />
                )}
                {page === 'map' && (
                  <MapPage events={data.events} analytics={data.analytics} />
                )}
                {page === 'analytics' && <AnalyticsPage analytics={data.analytics} />}
                {page === 'predict' && (
                  <PredictPage
                    analytics={data.analytics}
                    prediction={data.prediction}
                    modelInfo={data.modelInfo}
                    training={data.training}
                    onTrain={handleTrain}
                  />
                )}
                {page === 'alerts' && (
                  <AlertsPage
                    alerts={data.alerts}
                    filters={data.filters}
                    updateFilter={data.updateFilter}
                  />
                )}
                {page === 'news' && (
                  <NewsPage
                    news={data.news}
                    place={data.filters.place}
                    onRetry={handleRefresh}
                  />
                )}
                {page === 'data' && <DataPage events={data.events} />}
              </div>
            )}
          </>
        )}

        <p className="footer-note">
          QuakePulse v3 · Informational analytics only — not for emergency response. Data © USGS.
        </p>
      </main>

      <BottomNav page={page} onChange={setPage} />
      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={data.filters}
        updateFilter={data.updateFilter}
        onReset={data.resetFilters}
      />
      <Toast toasts={toasts} />
    </div>
  );
}
