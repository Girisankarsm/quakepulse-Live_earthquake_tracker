import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
} from 'recharts';
import { formatTime } from '../lib/format';

const BRAND = '#4a9b8e';
const WARM = '#c9a66b';
const COOL = '#6ea3c4';
const HIGH = '#e08a8a';
const GRID = 'rgba(146,160,176,0.14)';
const AXIS = '#6d7c8d';

const tooltipStyle = {
  background: '#1c2632',
  border: '1px solid rgba(200,214,228,0.14)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 12px 28px rgba(8,12,18,0.35)',
};

export function MagnitudeTrendChart({ data }) {
  if (!data?.length) {
    return <div className="chart-empty">No trend points for this window.</div>;
  }
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="magFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.38} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => formatTime(v)}
            stroke={AXIS}
            fontSize={11}
            minTickGap={40}
          />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            width={36}
            label={{ value: 'Avg M', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 10 }}
          />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(v)} />
          <Area
            type="monotone"
            dataKey="avgMag"
            name="Avg Mag"
            stroke={BRAND}
            fill="url(#magFill)"
            strokeWidth={2.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MagHistogram({ data }) {
  if (!data?.length) return <div className="chart-empty">No magnitude bins yet.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="bin" stroke={AXIS} fontSize={11} />
          <YAxis stroke={AXIS} fontSize={11} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill={BRAND} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnergyChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No energy series for this window.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => formatTime(v)}
            stroke={AXIS}
            fontSize={11}
            minTickGap={40}
          />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            width={48}
            tickFormatter={(v) => `${(v / 1e12).toFixed(1)}T`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatTime(v)}
            formatter={(v) => [Number(v).toExponential(2) + ' J', 'Energy']}
          />
          <Line type="monotone" dataKey="energyJ" stroke={WARM} strokeWidth={2.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepthScatter({ data }) {
  if (!data?.length) return <div className="chart-empty">No depth samples to plot.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="magnitude"
            name="Mag"
            stroke={AXIS}
            fontSize={11}
            domain={['auto', 'auto']}
          />
          <YAxis
            type="number"
            dataKey="depth"
            name="Depth"
            stroke={AXIS}
            fontSize={11}
            reversed
            unit=" km"
          />
          <ZAxis type="number" dataKey="magnitude" range={[40, 200]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={BRAND} fillOpacity={0.72} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepthBinsChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No depth bins yet.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke={AXIS} fontSize={11} />
          <YAxis type="category" dataKey="label" stroke={AXIS} fontSize={11} width={78} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill={COOL} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionsChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No regional hotspots yet.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke={AXIS} fontSize={11} />
          <YAxis
            type="category"
            dataKey="region"
            stroke={AXIS}
            fontSize={11}
            width={88}
            tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill={WARM} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimelineChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No timeline points yet.</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="timeMs"
            domain={['auto', 'auto']}
            tickFormatter={(v) => formatTime(new Date(v).toISOString())}
            stroke={AXIS}
            fontSize={11}
            name="Time"
          />
          <YAxis type="number" dataKey="magnitude" stroke={AXIS} fontSize={11} name="Mag" />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ''} />
          <Scatter
            data={data.map((d) => ({ ...d, timeMs: Date.parse(d.time) }))}
            fill={HIGH}
            fillOpacity={0.78}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
