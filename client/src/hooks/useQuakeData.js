import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const DEFAULT_FILTERS = {
  period: 'day',
  minMagnitude: 0,
  maxDepth: 700,
  place: '',
  alertThreshold: 5,
  autoRefresh: true,
};

export function useQuakeData() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [boot, setBoot] = useState(true);
  const first = useRef(true);

  const params = {
    period: filters.period,
    minMagnitude: filters.minMagnitude,
    maxDepth:
      filters.maxDepth === '' || filters.maxDepth == null || filters.maxDepth >= 700
        ? undefined
        : filters.maxDepth,
    place: filters.place || undefined,
    alertThreshold: filters.alertThreshold,
  };

  const load = useCallback(
    async ({ soft = false } = {}) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [sum, eqs, an, al] = await Promise.all([
          api.summary(params),
          api.earthquakes({ ...params, limit: 2000 }),
          api.analytics(params),
          api.alerts(params),
        ]);
        const regionHint =
          filters.place || sum?.regions?.[0]?.region || an?.regions?.[0]?.region || '';
        const nw = await api.news({ region: regionHint, limit: 24 });
        setSummary(sum);
        setEvents(eqs);
        setAnalytics(an);
        setAlerts(al);
        setNews(nw);
        return true;
      } catch (err) {
        setError(err.message || 'Failed to load seismic data');
        throw err;
      } finally {
        setLoading(false);
        setRefreshing(false);
        if (first.current) {
          first.current = false;
          setBoot(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.period,
      filters.minMagnitude,
      filters.maxDepth,
      filters.place,
      filters.alertThreshold,
    ],
  );

  useEffect(() => {
    if (!filters.autoRefresh) return undefined;
    const id = setInterval(() => {
      load({ soft: true }).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [filters.autoRefresh, load]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const updateFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return {
    filters,
    updateFilter,
    setFilters,
    summary,
    events,
    analytics,
    alerts,
    news,
    loading,
    refreshing,
    error,
    boot,
    reload: () => load({ soft: true }),
  };
}
