import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeatures, enrichEvents, extractRegion } from './parser.js';
import {
  applyFilters,
  computeKpis,
  buildRegionalRanking,
  sampleForDisplay,
} from './analytics.js';
import { analyzePatterns, trainModel } from './ml.js';

const sampleFeatures = [
  {
    id: 'us1',
    properties: {
      mag: 5.2,
      place: '10 km N of Tokyo, Japan',
      time: Date.now() - 3600000,
      status: 'reviewed',
      type: 'earthquake',
      url: 'https://example.com',
      tsunami: 0,
    },
    geometry: { coordinates: [139.7, 35.7, 35] },
  },
  {
    id: 'us2',
    properties: {
      mag: 3.1,
      place: 'California',
      time: Date.now() - 7200000,
      status: 'automatic',
      type: 'earthquake',
      url: 'https://example.com',
    },
    geometry: { coordinates: [-120.5, 36.1, 12] },
  },
  {
    id: 'us3',
    properties: {
      mag: 6.1,
      place: 'Near coast of Chile',
      time: Date.now() - 1800000,
      status: 'reviewed',
      type: 'earthquake',
      url: 'https://example.com',
      tsunami: 1,
    },
    geometry: { coordinates: [-72.0, -33.0, 40] },
  },
];

test('parseFeatures + enrichEvents normalizes USGS geojson', () => {
  const events = enrichEvents(parseFeatures(sampleFeatures));
  assert.equal(events.length, 3);
  assert.equal(extractRegion('10 km N of Tokyo, Japan'), 'Japan');
  assert.equal(extractRegion('Off coast of Japan'), 'Japan');
  assert.equal(events.find((e) => e.id === 'us3').region, 'Chile');
  assert.ok(events[0].energyJ > 0);
  assert.equal(events.find((e) => e.id === 'us1').magCategory, 'Moderate');
});

test('skips invalid coordinates and missing time', () => {
  const events = parseFeatures([
    {
      id: 'bad-coords',
      properties: { mag: 4, place: 'Nowhere', time: Date.now() },
      geometry: { coordinates: [999, 999, 10] },
    },
    {
      id: 'no-time',
      properties: { mag: 4, place: 'Somewhere' },
      geometry: { coordinates: [10, 10, 10] },
    },
    {
      id: 'ok',
      properties: { mag: -0.2, place: 'Micro, Alaska', time: Date.now() },
      geometry: { coordinates: [-150, 61, 5] },
    },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].magnitude, -0.2);
});

test('computeKpis filters and sampling', () => {
  const events = enrichEvents(parseFeatures(sampleFeatures));
  const kpis = computeKpis(events);
  assert.equal(kpis.totalEvents, 3);
  assert.ok(kpis.largestMagnitude >= 6);
  assert.equal(kpis.tsunamiFlags, 1);

  const filtered = applyFilters(events, { minMagnitude: 5 });
  assert.equal(filtered.length, 2);

  const many = Array.from({ length: 50 }, (_, i) => ({
    ...events[i % events.length],
    id: `e${i}`,
    magnitude: i % 10 === 0 ? 5 : 2,
    timeMs: Date.now() - i * 1000,
  }));
  const sampled = sampleForDisplay(many, 20);
  assert.equal(sampled.sampled, true);
  assert.ok(sampled.events.length <= 20);
  assert.ok(sampled.events.filter((e) => e.magnitude >= 4).length >= 5);
});

test('regional ranking and ML patterns', () => {
  const base = enrichEvents(parseFeatures(sampleFeatures));
  const events = [];
  for (let i = 0; i < 40; i += 1) {
    const b = base[i % base.length];
    events.push({
      ...b,
      id: `e${i}`,
      latitude: b.latitude + (i % 5) * 0.2,
      longitude: b.longitude + (i % 7) * 0.2,
      magnitude: b.magnitude + (i % 3) * 0.1,
      timeMs: Date.now() - i * 600000,
      time: new Date(Date.now() - i * 600000).toISOString(),
    });
  }

  const regions = buildRegionalRanking(events);
  assert.ok(regions.length >= 1);

  const model = trainModel(events);
  assert.ok(model.eventCount === 40 || model.samples >= 0);
  assert.ok(model.metrics != null || model.accuracyEstimate != null);

  const patterns = analyzePatterns(events, model);
  assert.ok(Array.isArray(patterns.insights));
  assert.ok(patterns.globalRisk);
  assert.ok(Array.isArray(patterns.anomalies));
});
