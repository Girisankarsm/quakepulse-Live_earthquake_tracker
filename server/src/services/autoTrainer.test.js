import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAutoTrainStatus,
  stopAutoTrainer,
} from './autoTrainer.js';

test('auto-train status exposes loop fields', () => {
  stopAutoTrainer();
  const status = getAutoTrainStatus();
  assert.equal(typeof status.enabled, 'boolean');
  assert.equal(typeof status.running, 'boolean');
  assert.ok(status.intervalMs >= 15 * 60_000);
  assert.ok(status.days >= 7);
  assert.ok(status.model);
});
