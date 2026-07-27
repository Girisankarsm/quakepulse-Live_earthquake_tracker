const BASE = '/api';

async function request(path, params = {}) {
  const url = new URL(BASE + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }
  return body;
}

export const api = {
  health: () => request('/health'),
  meta: () => request('/meta'),
  summary: (params) => request('/earthquakes/summary', params),
  earthquakes: (params) => request('/earthquakes', params),
  alerts: (params) => request('/earthquakes/alerts', params),
  analytics: (params) => request('/earthquakes/analytics', params),
  patterns: (params) => request('/ml/patterns', params),
  predict: (params) => request('/ml/predict', params),
  model: () => request('/ml/model'),
  news: (params) => request('/news', params),
  train: async (body = { days: 90, minMagnitude: 2.5, epochs: 45 }) => {
    const res = await fetch(`${BASE}/ml/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Training failed');
    return data;
  },
  autoTrainStatus: () => request('/ml/auto-train'),
  autoTrainRun: async (body = {}) => {
    const res = await fetch(`${BASE}/ml/auto-train/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ force: true, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Auto-train failed');
    return data;
  },
};
