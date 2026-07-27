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
  overview: { title: 'Seismic overview', sub: 'Live activity, energy release, and a calm read of the window.' },
  map: { title: 'Event map', sub: 'Explore where motion clustered — tap markers for detail.' },
  analytics: { title: 'Depth & regions', sub: 'Structured depth profiles and regional hotspots.' },
  predict: { title: 'Pattern predict', sub: 'Short-horizon activity nowcast from the trained risk model.' },
  alerts: { title: 'Alert monitor', sub: 'Threshold-based review list for stronger events.' },
  news: { title: 'Earthquake news', sub: 'Coverage matched to regions currently in the feed.' },
  data: { title: 'Event registry', sub: 'Browse and export the filtered event set.' },
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
      await data.trainModel({ days: 90, minMagnitude: 2.5, epochs: 45 });
      pushToast('Model retrained on 90-day multi-catalog data', 'success');
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
        <header className="page-head">
          <p className="eyebrow">QuakePulse</p>
          <h1 className="page-title">{TITLES[page].title}</h1>
          <p className="page-sub">{TITLES[page].sub}</p>
        </header>

        <section className="control-strip" aria-label="Live status and filters">
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
        </section>

        {data.loading && !data.summary ? (
          <SkeletonDashboard />
        ) : (
          <>
            {data.error && !data.summary && (
              <div className="panel panel-center">
                <EmptyState title="Unable to load feed" body={data.error} />
                <button type="button" className="btn btn-primary" onClick={handleRefresh}>
                  Retry
                </button>
              </div>
            )}

            {data.summary && (
              <div
                key={page}
                className={`workspace stack${data.refreshing ? ' content-dim' : ''}`}
              >
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
