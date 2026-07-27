import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/** Default poll cadence — aligned with server CACHE_TTL (30s), default UI 15s. */
export const REFRESH_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
];

const DEFAULT_FILTERS = {
  period: 'day',
  minMagnitude: 0,
  maxDepth: 700,
  place: '',
  alertThreshold: 5,
  autoRefresh: true,
  refreshSeconds: 15,
};

const NEWS_MIN_INTERVAL_MS = 90_000;
const PREDICT_MIN_INTERVAL_MS = 60_000;

export function useQuakeData() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedPlace, setDebouncedPlace] = useState('');
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [news, setNews] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [training, setTraining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [boot, setBoot] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(null);

  const first = useRef(true);
  const inFlight = useRef(false);
  const lastNewsAt = useRef(0);
  const lastPredictAt = useRef(0);
  const hasNews = useRef(false);
  const hasPrediction = useRef(false);
  const filtersRef = useRef(filters);
  const placeRef = useRef('');
  filtersRef.current = filters;
  placeRef.current = debouncedPlace;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedPlace(filters.place.trim()), 350);
    return () => clearTimeout(id);
  }, [filters.place]);

  const buildParams = useCallback((f, place) => {
    return {
      period: f.period,
      minMagnitude: f.minMagnitude,
      maxDepth:
        f.maxDepth === '' || f.maxDepth == null || f.maxDepth >= 700 ? undefined : f.maxDepth,
      place: place || undefined,
      alertThreshold: f.alertThreshold,
    };
  }, []);

  const load = useCallback(
    async ({ soft = false, includeNews = true, includePredict = true } = {}) => {
      if (inFlight.current) return false;
      inFlight.current = true;

      const f = filtersRef.current;
      const place = placeRef.current;
      const params = buildParams(f, place);

      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const now = Date.now();
        const shouldFetchNews =
          includeNews &&
          (!soft || now - lastNewsAt.current >= NEWS_MIN_INTERVAL_MS || !hasNews.current);
        const shouldFetchPredict =
          includePredict &&
          (!soft || now - lastPredictAt.current >= PREDICT_MIN_INTERVAL_MS || !hasPrediction.current);

        const requests = [
          api.summary(params),
          api.earthquakes({ ...params, limit: 2000 }),
          api.analytics(params),
          api.alerts(params),
        ];
        const slots = ['summary', 'events', 'analytics', 'alerts'];

        if (shouldFetchNews) {
          requests.push(api.news({ region: place, limit: 20 }));
          slots.push('news');
        }
        if (shouldFetchPredict) {
          requests.push(api.predict(params));
          slots.push('predict');
          requests.push(api.model());
          slots.push('model');
        }

        const results = await Promise.all(requests);
        const bySlot = Object.fromEntries(slots.map((key, i) => [key, results[i]]));

        setSummary(bySlot.summary);
        setEvents(bySlot.events);
        setAnalytics(bySlot.analytics);
        setAlerts(bySlot.alerts);

        if (bySlot.news) {
          setNews(bySlot.news);
          lastNewsAt.current = Date.now();
          hasNews.current = true;
        }
        if (bySlot.predict) {
          setPrediction(bySlot.predict);
          lastPredictAt.current = Date.now();
          hasPrediction.current = true;
        }
        if (bySlot.model) {
          setModelInfo(bySlot.model);
        }

        const synced = Date.now();
        setLastSyncedAt(synced);
        if (f.autoRefresh) {
          setNextRefreshAt(synced + (Number(f.refreshSeconds) || 30) * 1000);
        } else {
          setNextRefreshAt(null);
        }
        return true;
      } catch (err) {
        setError(err.message || 'Failed to load seismic data');
        throw err;
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
        if (first.current) {
          first.current = false;
          setBoot(false);
        }
      }
    },
    [buildParams],
  );

  // Initial + filter-driven loads
  useEffect(() => {
    load({ soft: !first.current }).catch(() => {});
  }, [
    load,
    filters.period,
    filters.minMagnitude,
    filters.maxDepth,
    debouncedPlace,
    filters.alertThreshold,
  ]);

  // Auto-refresh timer (respects interval + tab visibility)
  useEffect(() => {
    if (!filters.autoRefresh) {
      setNextRefreshAt(null);
      setSecondsToRefresh(null);
      return undefined;
    }

    const intervalMs = Math.max(10, Number(filters.refreshSeconds) || 30) * 1000;
    let timer;

    const schedule = () => {
      clearInterval(timer);
      const kickoff = Date.now();
      setNextRefreshAt(kickoff + intervalMs);
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        load({ soft: true }).catch(() => {});
      }, intervalMs);
    };

    schedule();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        load({ soft: true }).catch(() => {});
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [filters.autoRefresh, filters.refreshSeconds, load]);

  // Countdown tick for UI
  useEffect(() => {
    if (!filters.autoRefresh || !nextRefreshAt) {
      setSecondsToRefresh(null);
      return undefined;
    }
    const tick = () => {
      setSecondsToRefresh(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [filters.autoRefresh, nextRefreshAt]);

  const updateFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const resetFilters = () => {
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      autoRefresh: f.autoRefresh,
      refreshSeconds: f.refreshSeconds,
    }));
  };

  const trainModel = async (body = { days: 30, minMagnitude: 2.5 }) => {
    setTraining(true);
    try {
      const result = await api.train(body);
      const [pred, model] = await Promise.all([
        api.predict(buildParams(filtersRef.current, placeRef.current)),
        api.model(),
      ]);
      setPrediction(pred);
      setModelInfo(model);
      hasPrediction.current = true;
      lastPredictAt.current = Date.now();
      return result;
    } finally {
      setTraining(false);
    }
  };

  return {
    filters,
    updateFilter,
    resetFilters,
    setFilters,
    summary,
    events,
    analytics,
    alerts,
    news,
    prediction,
    modelInfo,
    training,
    trainModel,
    loading,
    refreshing,
    error,
    partialErrors: [],
    boot,
    lastSyncedAt,
    nextRefreshAt,
    secondsToRefresh,
    reload: () => load({ soft: true, includeNews: true, includePredict: true }),
  };
}
