import { REQUEST_TIMEOUT_MS } from '../config.js';

export class FetchError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'FetchError';
    this.cause = cause;
  }
}

export async function fetchJson(url, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, application/rss+xml, text/xml, */*' },
    });
    if (response.status === 204) {
      return '';
    }
    if (!response.ok) {
      throw new FetchError(`HTTP ${response.status} for ${url}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      return response.json();
    }
    return response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new FetchError(`Request timed out after ${timeout}ms`, err);
    }
    if (err instanceof FetchError) throw err;
    throw new FetchError(`Failed to fetch: ${err.message}`, err);
  } finally {
    clearTimeout(timer);
  }
}
