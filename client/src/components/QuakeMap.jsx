import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { magColor, formatTime } from '../lib/format';

function FitBounds({ events }) {
  const map = useMap();
  useEffect(() => {
    if (!events?.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 5);
      return;
    }
    const bounds = L.latLngBounds(events.map((e) => [e.latitude, e.longitude]));
    map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 6 });
  }, [events, map]);
  return null;
}

function ClusterLayer({ events }) {
  const map = useMap();

  useEffect(() => {
    if (!events?.length) return undefined;

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
    });

    for (const e of events) {
      const color = magColor(e.magnitude);
      const marker = L.circleMarker([e.latitude, e.longitude], {
        radius: Math.max(4, (e.magnitude + 0.3) * 1.6),
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1,
      });
      marker.bindPopup(
        `<div style="font-family:Sora,sans-serif;min-width:180px;line-height:1.45">
          <strong>${escapeHtml(e.place)}</strong><br/>
          <span style="color:#6d7686;font-family:IBM Plex Mono,monospace;font-size:12px">
            M ${e.magnitude.toFixed(1)} · ${e.depth.toFixed(1)} km<br/>
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
  }, [events, map]);

  return null;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function QuakeMap({ events, mode = 'cluster' }) {
  const list = useMemo(() => events || [], [events]);

  return (
    <div className="map-wrap">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        worldCopyJump
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds events={list} />
        {mode === 'cluster' ? (
          <ClusterLayer events={list} />
        ) : (
          list.map((e) => (
            <CircleMarker
              key={e.id}
              center={[e.latitude, e.longitude]}
              radius={Math.max(3, e.magnitude * 1.4)}
              pathOptions={{
                color: magColor(e.magnitude),
                fillColor: magColor(e.magnitude),
                fillOpacity: 0.55,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{e.place}</strong>
                <br />
                M {e.magnitude.toFixed(1)} · {e.depth.toFixed(1)} km
              </Popup>
            </CircleMarker>
          ))
        )}
      </MapContainer>
    </div>
  );
}
