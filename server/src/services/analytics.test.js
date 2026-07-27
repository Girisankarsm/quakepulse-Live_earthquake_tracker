import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeatures, enrichEvents } from '../services/parser.js';
import {
  applyFilters,
  computeKpis,
  getAlerts,
  formatEnergy,
  sampleForDisplay,
  buildDepthAnalysis,
} from '../services/analytics.js';
import { analyzePatterns } from '../services/ml.js';

const SAMPLE = {
  id: 'us7000test',
  properties: {
    mag: 4.8,
    place: '10 km N of Ridgecrest, CA',
    time: 1_700_000_000_000,
    status: 'reviewed',
    type: 'earthquake',
    url: 'https://example.com',
    felt: 12,
    tsunami: 0,
  },
  geometry: { coordinates: [-117.6, 35.7, 8.2] },
};

function sampleEvents() {
  const features = [
    SAMPLE,
    {
      ...SAMPLE,
      id: 'us7000test2',
      properties: {
        ...SAMPLE.properties,
        mag: 6.2,
        place: 'Off coast of Japan',
        time: 1_700_000_100_000,
      },
      geometry: { coordinates: [142.0, 38.0, 45.0] },
    },
    {
      ...SAMPLE,
      id: 'us7000test3',
      properties: {
        ...SAMPLE.properties,
        mag: 2.1,
        place: 'Near Tokyo, Japan',
        time: 1_700_000_200_000,
      },
      geometry: { coordinates: [139.0, 35.0, 320.0] },
    },
  ];
  return enrichEvents(parseFeatures(features));
}

describe('parser', () => {
  it('parses and enriches features', () => {
    const events = sampleEvents();
    assert.equal(events.length, 3);
    assert.ok(events[0].energyJ > 0);
    assert.ok(['Low', 'Medium', 'High'].includes(events[0].magRange));
    assert.equal(events[1].region, 'Japan');
  });

  it('skips features without time', () => {
    const events = parseFeatures([
      { id: 'x', properties: { mag: 3 }, geometry: { coordinates: [0, 0, 0] } },
    ]);
    assert.equal(events.length, 0);
  });
});

describe('analytics', () => {
  it('filters by magnitude and place', () => {
    const events = sampleEvents();
    const byMag = applyFilters(events, { minMagnitude: 5 });
    assert.equal(byMag.length, 1);
    assert.equal(byMag[0].magnitude, 6.2);

    const byPlace = applyFilters(events, { placeQuery: 'japan' });
    assert.equal(byPlace.length, 2);
  });

  it('computes KPIs and alerts', () => {
    const events = sampleEvents();
    const kpis = computeKpis(events);
    assert.equal(kpis.totalEvents, 3);
    assert.equal(kpis.largestMagnitude, 6.2);
    assert.ok(kpis.significantEvents >= 1);

    const alerts = getAlerts(events, 5);
    assert.equal(alerts.length, 1);
  });

  it('formats energy and samples display set', () => {
    assert.match(formatEnergy(500), /J/);
    assert.match(formatEnergy(5e9), /GJ/);

    const events = sampleEvents();
    const weak = [];
    for (let i = 0; i < 20; i++) {
      weak.push({ ...events[2], id: `weak_${i}`, magnitude: 1.5 });
    }
    const big = [...events, ...weak];
    const { events: sampled, sampled: was } = sampleForDisplay(big, 5);
    assert.equal(was, true);
    assert.ok(sampled.some((e) => e.magnitude >= 4));
    assert.ok(sampled.length <= 5);
  });

  it('builds depth analysis profiles', () => {
    const depth = buildDepthAnalysis(sampleEvents());
    assert.ok(depth.profiles.length === 3);
    assert.ok(depth.depthBins.length > 0);
  });
});

describe('ml patterns', () => {
  it('returns risk scores and insights', () => {
    const report = analyzePatterns(sampleEvents());
    assert.ok(report.model);
    assert.ok(report.globalRisk);
    assert.ok(Array.isArray(report.regions));
    assert.ok(report.insights.length >= 1);
    assert.ok(report.depthPatterns.dominant);
  });
});
