import type { Severity } from '../../types'

// Reuses the app's existing severity colors (SeverityBadge, PDF export) —
// already validated at 6.16:1 / 10.2:1 / 9.77:1 contrast against the dark
// card surface — rather than a separate chart-only palette, so severity
// means the same color everywhere in the app.
const SEVERITY_COLOR: Record<Severity, string> = {
  high: 'var(--high)',
  medium: 'var(--medium)',
  low: 'var(--low)',
}
const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const ORDER: Severity[] = ['high', 'medium', 'low']

const SIZE = 140
const RADIUS = 56
const STROKE_WIDTH = 20
const GAP = 3 // circumference units of visual separation between segments

export default function DonutChart({ data }: { data: Record<Severity, number> }) {
  const total = ORDER.reduce((sum, s) => sum + data[s], 0)
  if (total === 0) return <p className="summary">No open items.</p>

  const circumference = 2 * Math.PI * RADIUS
  let cumulative = 0
  const segments = ORDER.filter((s) => data[s] > 0).map((s) => {
    const value = data[s]
    const fraction = value / total
    const dash = Math.max(fraction * circumference - GAP, 0)
    const offset = -cumulative * circumference
    cumulative += fraction
    return { severity: s, value, dash, offset }
  })

  return (
    <div className="donut-wrap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="chart chart-donut"
        role="img"
        aria-label="Open items by severity"
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE_WIDTH} />
        {segments.map((seg) => (
          <circle
            key={seg.severity}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={SEVERITY_COLOR[seg.severity]}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          >
            <title>{`${SEVERITY_LABEL[seg.severity]}: ${seg.value}`}</title>
          </circle>
        ))}
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-total-value">
          {total}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 15} textAnchor="middle" className="donut-total-label">
          items
        </text>
      </svg>
      <div className="chart-legend">
        {ORDER.map((s) => (
          <div key={s} className="legend-row">
            <span className="legend-swatch" style={{ background: SEVERITY_COLOR[s] }} />
            <span className="legend-label">{SEVERITY_LABEL[s]}</span>
            <span className="legend-value">{data[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
