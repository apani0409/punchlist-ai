import { TrendingDown, TrendingUp } from 'lucide-react'

export default function StatCard({
  label,
  value,
  delta,
  deltaFormat = 'number',
  invertDelta = false,
  tone,
  caption,
}: {
  label: string
  value: string | number
  delta?: number | null
  deltaFormat?: 'number' | 'pp'
  // Whether an increase is good news (closure rate ↑) or bad news (risk
  // score ↑, open items ↑) — flips which color reads as "good".
  invertDelta?: boolean
  tone?: 'high'
  // Short formula/definition shown under the value — for metrics (like a
  // weighted risk score) whose number alone doesn't explain itself.
  caption?: string
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
          {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {formatDelta(Math.abs(delta!), deltaFormat)} vs previous round
        </span>
      )}
      {hasDelta && isFlat && <span className="stat-delta stat-delta-flat">— no change</span>}
      {caption && <span className="stat-caption">{caption}</span>}
    </div>
  )
}

function formatDelta(value: number, format: 'number' | 'pp'): string {
  if (format === 'pp') return `${Math.round(value * 100)}pp`
  return String(Math.round(value * 10) / 10)
}
