// "Closed" uses the categorical aqua slot (not the severity-low green) so
// round-over-round progress stays visually distinct from severity encoding.
const OPEN_COLOR = 'var(--accent)'
const CLOSED_COLOR = '#199e70'

const GROUP_WIDTH = 130
const BAR_WIDTH = 20
const BAR_GAP = 4
const TOP_PADDING = 18 // room for the value label above the tallest bar
const PLOT_HEIGHT = 90
const BOTTOM_PADDING = 24 // room for the round label below the baseline
const CHART_HEIGHT = TOP_PADDING + PLOT_HEIGHT + BOTTOM_PADDING
const BASELINE_Y = TOP_PADDING + PLOT_HEIGHT

export default function TrendChart({
  data,
}: {
  data: { roundName: string; roundIndex: number; open: number; closed: number }[]
}) {
  if (data.length === 0) return <p className="summary">Not enough rounds yet.</p>

  const max = Math.max(1, ...data.map((d) => Math.max(d.open, d.closed)))
  const width = data.length * GROUP_WIDTH

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        className="chart chart-trend"
        role="img"
        aria-label="Open vs closed items by round"
      >
        <line x1={0} y1={BASELINE_Y} x2={width} y2={BASELINE_Y} className="chart-baseline" />
        {data.map((d, i) => {
          const groupX = i * GROUP_WIDTH + GROUP_WIDTH / 2
          const openHeight = Math.max((d.open / max) * PLOT_HEIGHT, d.open > 0 ? 2 : 0)
          const closedHeight = Math.max((d.closed / max) * PLOT_HEIGHT, d.closed > 0 ? 2 : 0)
          const openX = groupX - BAR_GAP / 2 - BAR_WIDTH
          const closedX = groupX + BAR_GAP / 2
          return (
            <g key={d.roundIndex}>
              <title>{`${d.roundName} — open ${d.open}, closed ${d.closed}`}</title>
              <rect
                x={openX}
                y={BASELINE_Y - openHeight}
                width={BAR_WIDTH}
                height={openHeight}
                rx={4}
                fill={OPEN_COLOR}
              />
              <text x={openX + BAR_WIDTH / 2} y={BASELINE_Y - openHeight - 6} textAnchor="middle" className="chart-value">
                {d.open}
              </text>
              <rect
                x={closedX}
                y={BASELINE_Y - closedHeight}
                width={BAR_WIDTH}
                height={closedHeight}
                rx={4}
                fill={CLOSED_COLOR}
              />
              <text
                x={closedX + BAR_WIDTH / 2}
                y={BASELINE_Y - closedHeight - 6}
                textAnchor="middle"
                className="chart-value"
              >
                {d.closed}
              </text>
              <text x={groupX} y={BASELINE_Y + 18} textAnchor="middle" className="chart-label">
                {`R${d.roundIndex}`}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend chart-legend-row">
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: OPEN_COLOR }} />
          <span className="legend-label">Open</span>
        </div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: CLOSED_COLOR }} />
          <span className="legend-label">Closed</span>
        </div>
      </div>
    </div>
  )
}
