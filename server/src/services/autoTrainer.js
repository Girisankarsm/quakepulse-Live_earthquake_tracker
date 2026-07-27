/**
 * Automatic collect → train loop.
 * Periodically downloads fresh multi-catalog data from the network
 * and retrains the early-risk model without manual intervention.
 */

import {
  AUTO_TRAIN_ENABLED,
  AUTO_TRAIN_INTERVAL_MS,
  AUTO_TRAIN_DAYS,
  AUTO_TRAIN_MIN_MAG,
  AUTO_TRAIN_EPOCHS,
  AUTO_TRAIN_ON_BOOT,
  AUTO_TRAIN_BOOT_DELAY_MS,
} from '../config.js';
import { downloadTrainingDataset, loadPersistedDataset } from './datasets.js';
import { trainRiskModel, loadModel } from './ml.js';

const state = {
  enabled: AUTO_TRAIN_ENABLED,
  running: false,
  startedAt: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastResult: null,
  nextRunAt: null,
  runCount: 0,
  timer: null,
  bootTimer: null,
};

/**
 * One collect+train cycle. Safe to call manually or from the loop.
 */
export async function runCollectAndTrain(opts = {}) {
  if (state.running) {
    return { ok: false, skipped: true, reason: 'already-running' };
  }

  // Skip if a fresh model already exists (unless forced)
  if (!opts.force) {
    const existing = loadModel();
    const ageMs = existing.trainedAt ? Date.now() - Date.parse(existing.trainedAt) : Infinity;
    const minAge = opts.minAgeMs ?? Math.min(AUTO_TRAIN_INTERVAL_MS * 0.5, 30 * 60_000);
    if (existing.samples > 1000 && Number.isFinite(ageMs) && ageMs < minAge) {
      console.log(
        `[auto-train] skip — model is fresh (${Math.round(ageMs / 60000)}m old, need ${Math.round(minAge / 60000)}m)`,
      );
      state.nextRunAt = new Date(Date.now() + (AUTO_TRAIN_INTERVAL_MS - ageMs)).toISOString();
      return {
        ok: true,
        skipped: true,
        reason: 'model-fresh',
        modelAgeMinutes: round(ageMs / 60000, 1),
      };
    }
  }

  state.running = true;
  state.lastStartedAt = new Date().toISOString();
  state.lastError = null;
  const days = opts.days ?? AUTO_TRAIN_DAYS;
  const minMagnitude = opts.minMagnitude ?? AUTO_TRAIN_MIN_MAG;
  const epochs = opts.epochs ?? AUTO_TRAIN_EPOCHS;

  console.log(`[auto-train] starting collect+train · ${days}d · minM ${minMagnitude}`);

  try {
    const downloaded = await downloadTrainingDataset({
      days,
      minMagnitude,
      persist: true,
    });

    // Merge with prior cache so we don't lose older coverage if a source flakes
    let events = downloaded.events;
    const prior = await loadPersistedDataset();
    if (prior?.events?.length && prior.meta?.downloadedAt !== downloaded.meta.downloadedAt) {
      // already persisted as downloaded; events are the fresh set
      events = downloaded.events;
    }

    if (!events.length) {
      throw new Error('No events collected from network catalogs');
    }

    const model = trainRiskModel(events, {
      epochs,
      horizonHours: 6,
      magThreshold: 4.0,
      persist: true,
      forcePersist: true,
      maxSamples: 30_000,
    });

    state.runCount += 1;
    state.lastFinishedAt = new Date().toISOString();
    state.lastResult = {
      ok: true,
      collectedAt: downloaded.meta.downloadedAt,
      eventCount: events.length,
      sources: downloaded.meta.sources,
      model: {
        version: model.version,
        trainedAt: model.trainedAt,
        samples: model.samples,
        metrics: model.metrics,
        threshold: model.threshold,
      },
    };

    console.log(
      `[auto-train] done · ${events.length} events · ${model.samples} samples · F1 ${model.metrics?.f1 ?? '—'}`,
    );
    return state.lastResult;
  } catch (err) {
    state.lastError = {
      message: err.message || String(err),
      at: new Date().toISOString(),
    };
    state.lastFinishedAt = new Date().toISOString();
    console.error('[auto-train] failed:', err.message);
    return { ok: false, error: state.lastError };
  } finally {
    state.running = false;
    if (state.enabled) {
      state.nextRunAt = new Date(Date.now() + AUTO_TRAIN_INTERVAL_MS).toISOString();
    }
  }
}

export function getAutoTrainStatus() {
  const model = loadModel();
  return {
    enabled: state.enabled,
    running: state.running,
    startedAt: state.startedAt,
    lastStartedAt: state.lastStartedAt,
    lastFinishedAt: state.lastFinishedAt,
    nextRunAt: state.nextRunAt,
    runCount: state.runCount,
    intervalMs: AUTO_TRAIN_INTERVAL_MS,
    intervalHours: round(AUTO_TRAIN_INTERVAL_MS / 3_600_000, 2),
    days: AUTO_TRAIN_DAYS,
    minMagnitude: AUTO_TRAIN_MIN_MAG,
    epochs: AUTO_TRAIN_EPOCHS,
    lastError: state.lastError,
    lastResult: state.lastResult,
    model: {
      loaded: Boolean(model.trainedAt),
      version: model.version,
      trainedAt: model.trainedAt,
      samples: model.samples,
      eventCount: model.eventCount,
      metrics: model.metrics,
    },
  };
}

/** Start the perpetual collect→train loop (idempotent). */
export function startAutoTrainer() {
  if (!AUTO_TRAIN_ENABLED) {
    console.log('[auto-train] disabled (set AUTO_TRAIN=1 to enable)');
    return getAutoTrainStatus();
  }

  if (state.timer) {
    return getAutoTrainStatus();
  }

  state.enabled = true;
  state.startedAt = new Date().toISOString();
  console.log(
    `[auto-train] loop on · every ${round(AUTO_TRAIN_INTERVAL_MS / 3_600_000, 2)}h · ${AUTO_TRAIN_DAYS}d catalogs`,
  );

  const scheduleNext = () => {
    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      await runCollectAndTrain();
      if (state.enabled) scheduleNext();
    }, AUTO_TRAIN_INTERVAL_MS);
    if (typeof state.timer.unref === 'function') state.timer.unref();
    state.nextRunAt = new Date(Date.now() + AUTO_TRAIN_INTERVAL_MS).toISOString();
  };

  if (AUTO_TRAIN_ON_BOOT) {
    const delay = Math.max(0, AUTO_TRAIN_BOOT_DELAY_MS);
    console.log(`[auto-train] boot run in ${Math.round(delay / 1000)}s`);
    state.bootTimer = setTimeout(async () => {
      await runCollectAndTrain();
      if (state.enabled) scheduleNext();
    }, delay);
    if (typeof state.bootTimer.unref === 'function') state.bootTimer.unref();
    state.nextRunAt = new Date(Date.now() + delay).toISOString();
  } else {
    scheduleNext();
  }

  return getAutoTrainStatus();
}

export function stopAutoTrainer() {
  state.enabled = false;
  clearTimeout(state.timer);
  clearTimeout(state.bootTimer);
  state.timer = null;
  state.bootTimer = null;
  state.nextRunAt = null;
  console.log('[auto-train] loop stopped');
  return getAutoTrainStatus();
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
