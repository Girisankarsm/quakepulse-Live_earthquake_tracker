/**
 * Normalize USGS GeoJSON features into structured event records.
 */

export function parseFeatures(features = []) {
  if (!Array.isArray(features)) return [];
  const events = [];

  for (const feature of features) {
    const props = feature?.properties || {};
    const coords = feature?.geometry?.coordinates;
    const timeMs = props.time;

    if (timeMs == null || !Number.isFinite(Number(timeMs))) continue;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const magRaw = props.mag == null ? 0 : Number(props.mag);
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const depthRaw = coords[2] == null ? 0 : Number(coords[2]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const magnitude = Number.isFinite(magRaw) ? magRaw : 0;
    const depth = Number.isFinite(depthRaw) ? depthRaw : 0;

    events.push({
      id: feature.id || `${lat}-${lon}-${timeMs}`,
      magnitude,
      depth,
      place: props.place || 'Unknown location',
      time: new Date(timeMs).toISOString(),
      timeMs: Number(timeMs),
      latitude: lat,
      longitude: lon,
      status: props.status || 'unknown',
      type: props.type || 'earthquake',
      url: props.url || '',
      felt: props.felt ?? null,
      cdi: props.cdi ?? null,
      mmi: props.mmi ?? null,
      tsunami: Boolean(props.tsunami),
      sig: props.sig ?? null,
      alert: props.alert || null,
    });
  }

  return events;
}

export function enrichEvents(events) {
  return events.map((e) => {
    const magnitude = e.magnitude;
    const energyMag = Math.max(0, magnitude);
    const energyJ = 10 ** (1.5 * energyMag + 4.8);
    const magRange = magnitude < 2.5 ? 'Low' : magnitude < 5 ? 'Medium' : 'High';
    const magCategory =
      magnitude < 3 ? 'Minor' : magnitude < 6 ? 'Moderate' : magnitude < 9 ? 'Strong' : 'Severe';
    const depthCategory =
      e.depth < 70 ? 'Shallow' : e.depth < 300 ? 'Intermediate' : 'Deep';

    return {
      ...e,
      sizeScaled: (Math.max(0, magnitude) + 0.3) * 5,
      energyJ,
      magRange,
      magCategory,
      depthCategory,
      region: extractRegion(e.place),
    };
  });
}

export function extractRegion(place = '') {
  const text = String(place).trim();
  if (!text) return 'Unknown';

  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];

  // "Off coast of Japan", "Near coast of Chile", "10 km N of Tokyo"
  const ofMatch = text.match(/\bof\s+(.+)$/i);
  if (ofMatch?.[1]) return ofMatch[1].trim();

  return parts[0] || text;
}
