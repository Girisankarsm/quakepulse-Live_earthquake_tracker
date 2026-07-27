export function formatEnergy(joules = 0) {
  if (joules >= 1e18) return `${(joules / 1e18).toFixed(2)} EJ`;
  if (joules >= 1e15) return `${(joules / 1e15).toFixed(2)} PJ`;
  if (joules >= 1e12) return `${(joules / 1e12).toFixed(2)} TJ`;
  if (joules >= 1e9) return `${(joules / 1e9).toFixed(2)} GJ`;
  return `${Math.round(joules).toLocaleString()} J`;
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUtc(iso) {
  if (!iso) return '—';
  return (
    new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC'
  );
}

export function formatRelative(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return formatTime(iso);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function magClass(m) {
  if (m < 2.5) return 'mag-low';
  if (m < 5) return 'mag-med';
  return 'mag-high';
}

export function magColor(m) {
  if (m < 2.5) return '#6bbf9a';
  if (m < 5) return '#d4b56a';
  return '#e08a8a';
}

export function toCsv(events) {
  const headers = [
    'Time',
    'Magnitude',
    'Depth',
    'Place',
    'Latitude',
    'Longitude',
    'Status',
    'Type',
    'Url',
  ];
  const rows = events.map((e) =>
    [
      e.time,
      e.magnitude,
      e.depth,
      `"${String(e.place).replaceAll('"', '""')}"`,
      e.latitude,
      e.longitude,
      e.status,
      e.type,
      e.url,
    ].join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
