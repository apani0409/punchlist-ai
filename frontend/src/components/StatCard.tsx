export default function StatCard({
  label,
  value,
  delta,
  deltaFormat = 'number',
  invertDelta = false,
  tone,
}: {
  label: string
  value: string | number
  delta?: number | null
  deltaFormat?: 'number' | 'pp'
  // Whether an increase is good news (closure rate ↑) or bad news (risk
  // score ↑, open items ↑) — flips which color reads as "good".
  invertDelta?: boolean
  tone?: 'high'
}) {
  const hasDelta = delta !== undefined && delta !== null
  const isFlat = hasDelta && Math.abs(delta!) < 0.005
  const isUp = hasDelta && delta! > 0
  const isGood = hasDelta ? (invertDelta ? !isUp : isUp) : null

  return (
    <div className={`stat-card ${tone ? `stat-card-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hasDelta && !isFlat && (
        <span className={`stat-delta ${isGood ? 'stat-delta-good' : 'stat-delta-bad'}`}>
          {isUp ? '▲' : '▼'} {formatDelta(Math.abs(delta!), deltaFormat)} vs previous round
        </span>
      )}
      {hasDelta && isFlat && <span className="stat-delta stat-delta-flat">— no change</span>}
    </div>
  )
}

function formatDelta(value: number, format: 'number' | 'pp'): string {
  if (format === 'pp') return `${Math.round(value * 100)}pp`
  return String(Math.round(value * 10) / 10)
}
