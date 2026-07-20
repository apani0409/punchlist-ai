import type { Round } from '../types'

export default function RoundTabs({
  rounds,
  activeRoundId,
  onSelect,
}: {
  rounds: Round[]
  activeRoundId: string | null
  onSelect: (id: string) => void
}) {
  if (rounds.length <= 1) return null
  return (
    <div className="round-tabs">
      {rounds.map((r) => (
        <button
          key={r.id}
          className={`round-tab ${r.id === activeRoundId ? 'active' : ''}`}
          onClick={() => onSelect(r.id)}
        >
          {r.name}
        </button>
      ))}
    </div>
  )
}
