import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { magColor, formatTime } from '../lib/format';

function eventFingerprint(events) {
  if (!events?.length) return 'empty';
  const sample = events.slice(0, 12).map((e) => e.id).join('|');
  return `${events.length}:${sample}:${events[0]?.id}:${events[events.length - 1]?.id}`;
}

function FitBounds({ events, enabled }) {
  const map = useMap();
  const lastFit = useRef('');

  useEffect(() => {
    if (!enabled) return;
    const fp = eventFingerprint(events);
    if (fp === lastFit.current) return;
    lastFit.current = fp;

    if (!events?.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 5);
      return;
    }
    const bounds = L.latLngBounds(events.map((e) => [e.latitude, e.longitude]));
    map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: 6 });
  }, [events, map, enabled]);

  return null;
}

function ClusterLayer({ events }) {
  const map = useMap();
  const key = eventFingerprint(events);

  useEffect(() => {
    if (!events?.length) return undefined;

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 46,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 8,
    });

    for (const e of events) {
      const color = magColor(e.magnitude);
      const marker = L.circleMarker([e.latitude, e.longitude], {
        radius: Math.max(4, (e.magnitude + 0.3) * 1.7),
        color,
        fillColor: color,
        fillOpacity: 0.82,
        weight: 1,
      });
      marker.bindPopup(
        `<div style="font-family:Outfit,sans-serif;min-width:190px;line-height:1.45">
          <strong>${escapeHtml(e.place)}</strong><br/>
          <span style="color:#9aa3b2;font-family:JetBrains Mono,monospace;font-size:12px">
            M ${e.magnitude.toFixed(1)} · ${e.depth.toFixed(1)} km · ${e.depthCategory || ''}<br/>
            ${formatTime(e.time)}
          </span>
        </div>`,
      );
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [key, events, map]);

  return null;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function QuakeMap({ events, mode = 'cluster', tall = false, autoFit = true }) {
  const list = useMemo(() => events || [], [events]);

  return (
    <div className={`map-wrap${tall ? ' map-wrap-tall' : ''}`}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        worldCopyJump
        attributionControl
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds events={list} enabled={autoFit} />
        {mode === 'cluster' ? (
          <ClusterLayer events={list} />
        ) : (
          list.map((e) => (
            <CircleMarker
              key={e.id}
              center={[e.latitude, e.longitude]}
              radius={Math.max(3, e.magnitude * 1.5)}
              pathOptions={{
                color: magColor(e.magnitude),
                fillColor: magColor(e.magnitude),
                fillOpacity: 0.6,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{e.place}</strong>
                <br />
                M {e.magnitude.toFixed(1)} · {e.depth.toFixed(1)} km
                <br />
                {formatTime(e.time)}
              </Popup>
            </CircleMarker>
          ))
        )}
      </MapContainer>
      <div className="map-legend" aria-hidden>
        <span>
          <i style={{ background: '#3ecf8e' }} /> M&lt;2.5
        </span>
        <span>
          <i style={{ background: '#e8b339' }} /> 2.5–5
        </span>
        <span>
          <i style={{ background: '#ef6b6b' }} /> M≥5
        </span>
      </div>
    </div>
  );
}
