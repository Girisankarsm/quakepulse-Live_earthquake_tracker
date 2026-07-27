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

const tooltipStyle = {
  background: '#1c222c',
  border: '1px solid rgba(232,236,243,0.12)',
  borderRadius: 8,
  fontSize: 12,
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
              <stop offset="0%" stopColor="#e07020" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e07020" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => formatTime(v)}
            stroke="#6d7686"
            fontSize={11}
            minTickGap={40}
          />
          <YAxis stroke="#6d7686" fontSize={11} width={36} label={{ value: 'Avg M', angle: -90, position: 'insideLeft', fill: '#6d7686', fontSize: 10 }} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatTime(v)}
          />
          <Area
            type="monotone"
            dataKey="avgMag"
            name="Avg Mag"
            stroke="#e07020"
            fill="url(#magFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MagHistogram({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data || []}>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" vertical={false} />
          <XAxis dataKey="bin" stroke="#6d7686" fontSize={11} />
          <YAxis stroke="#6d7686" fontSize={11} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill="#e07020" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnergyChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data || []}>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => formatTime(v)}
            stroke="#6d7686"
            fontSize={11}
            minTickGap={40}
          />
          <YAxis
            stroke="#6d7686"
            fontSize={11}
            width={48}
            tickFormatter={(v) => `${(v / 1e12).toFixed(1)}T`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatTime(v)}
            formatter={(v) => [Number(v).toExponential(2) + ' J', 'Energy']}
          />
          <Line
            type="monotone"
            dataKey="energyJ"
            stroke="#5b9fd4"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepthScatter({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" />
          <XAxis
            type="number"
            dataKey="magnitude"
            name="Mag"
            stroke="#6d7686"
            fontSize={11}
            domain={['auto', 'auto']}
          />
          <YAxis
            type="number"
            dataKey="depth"
            name="Depth"
            stroke="#6d7686"
            fontSize={11}
            reversed
            unit=" km"
          />
          <ZAxis type="number" dataKey="magnitude" range={[40, 200]} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) => [value, name]}
          />
          <Scatter data={data || []} fill="#e07020" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepthBinsChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data || []} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" horizontal={false} />
          <XAxis type="number" stroke="#6d7686" fontSize={11} />
          <YAxis type="category" dataKey="label" stroke="#6d7686" fontSize={11} width={78} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill="#5b9fd4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionsChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={(data || []).slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" horizontal={false} />
          <XAxis type="number" stroke="#6d7686" fontSize={11} />
          <YAxis
            type="category"
            dataKey="region"
            stroke="#6d7686"
            fontSize={11}
            width={88}
            tickFormatter={(v) => (v.length > 12 ? v.slice(0, 11) + '…' : v)}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" fill="#e8b339" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimelineChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart>
          <CartesianGrid stroke="rgba(154,163,178,0.12)" />
          <XAxis
            type="number"
            dataKey="timeMs"
            domain={['auto', 'auto']}
            tickFormatter={(v) => formatTime(new Date(v).toISOString())}
            stroke="#6d7686"
            fontSize={11}
            name="Time"
          />
          <YAxis type="number" dataKey="magnitude" stroke="#6d7686" fontSize={11} name="Mag" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={() => ''}
            formatter={(value, name) => [value, name]}
          />
          <Scatter
            data={(data || []).map((d) => ({ ...d, timeMs: Date.parse(d.time) }))}
            fill="#ef6b6b"
            fillOpacity={0.75}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
