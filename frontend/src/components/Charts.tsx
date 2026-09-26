import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { number } from '../lib/format'
type Point = { label: string; value: number }
export function Chart({
  data,
  unit,
  bars = false,
  color = 'var(--accent)',
  height = 190,
}: {
  data: Point[]
  unit: string
  bars?: boolean
  color?: string
  height?: number
}) {
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 6" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 11 }}
        minTickGap={16}
      />
      <YAxis
        width={42}
        tickLine={false}
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 11 }}
        tickFormatter={(v) =>
          Math.abs(Number(v)) >= 1000 ? `${number(Number(v) / 1000, 1)}k` : String(v)
        }
      />
      <Tooltip
        contentStyle={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          color: 'var(--text)',
        }}
        formatter={(value) => [`${number(Number(value), 1)} ${unit}`, '']}
        cursor={false}
      />
    </>
  )
  return (
    <div className="chart" role="img" aria-label={`График, ${unit}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {bars ? (
          <BarChart data={data} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
            {axes}
            <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} maxBarSize={32} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
            {axes}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
