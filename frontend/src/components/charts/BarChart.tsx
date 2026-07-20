import { TRADE_COLORS } from '../../lib/tradeColors'
import type { Trade } from '../../types'

const ROW_HEIGHT = 28
const BAR_HEIGHT = 16
const LABEL_WIDTH = 84
const VALUE_GAP = 8
const CHART_WIDTH = 320

export default function BarChart({ data }: { data: { trade: Trade; count: number }[] }) {
  if (data.length === 0) return <p className="summary">No open items.</p>

  const max = Math.max(...data.map((d) => d.count))
  const barAreaWidth = CHART_WIDTH - LABEL_WIDTH
  const height = data.length * ROW_HEIGHT

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH + 30} ${height}`}
      className="chart chart-bar"
      role="img"
      aria-label="Open items by trade"
    >
      {data.map((d, i) => {
        const barWidth = max > 0 ? Math.max((d.count / max) * barAreaWidth, 3) : 0
        const y = i * ROW_HEIGHT
        return (
          <g key={d.trade}>
            <title>{`${d.trade}: ${d.count}`}</title>
            <text
              x={LABEL_WIDTH - 8}
              y={y + ROW_HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-label"
            >
              {d.trade}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
              width={barWidth}
              height={BAR_HEIGHT}
              rx={4}
              fill={TRADE_COLORS[d.trade]}
            />
            <text
              x={LABEL_WIDTH + barWidth + VALUE_GAP}
              y={y + ROW_HEIGHT / 2}
              dominantBaseline="middle"
              className="chart-value"
            >
              {d.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
