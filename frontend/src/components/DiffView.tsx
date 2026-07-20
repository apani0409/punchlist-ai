import type { ReactNode } from 'react'
import type { ConsolidatedItem, RoundDiff } from '../types'
import SeverityBadge from './SeverityBadge'

export default function DiffView({
  diff,
  previousItems,
  currentItems,
}: {
  diff: RoundDiff
  previousItems: ConsolidatedItem[]
  currentItems: ConsolidatedItem[]
}) {
  const prevById = new Map(previousItems.map((i) => [i.id, i]))
  const currById = new Map(currentItems.map((i) => [i.id, i]))

  const closed = diff.closed
    .map((id) => prevById.get(id))
    .filter((x): x is ConsolidatedItem => !!x)
  const persistent = diff.persistent.flatMap((p) => {
    const item = currById.get(p.currentId)
    return item ? [{ item, note: p.note }] : []
  })
  const fresh = diff.new.map((id) => currById.get(id)).filter((x): x is ConsolidatedItem => !!x)

  return (
    <div className="diff-view">
      <DiffColumn title="Closed" tone="closed" count={closed.length}>
        {closed.length === 0 && <p className="diff-empty">Nothing closed this round.</p>}
        {closed.map((it) => (
          <DiffRow key={it.id} item={it} />
        ))}
      </DiffColumn>
      <DiffColumn title="Persistent" tone="persistent" count={persistent.length}>
        {persistent.length === 0 && <p className="diff-empty">No repeat findings.</p>}
        {persistent.map(({ item, note }) => (
          <DiffRow key={item.id} item={item} note={note} />
        ))}
      </DiffColumn>
      <DiffColumn title="New" tone="new" count={fresh.length}>
        {fresh.length === 0 && <p className="diff-empty">No new findings.</p>}
        {fresh.map((it) => (
          <DiffRow key={it.id} item={it} />
        ))}
      </DiffColumn>
    </div>
  )
}

function DiffColumn({
  title,
  tone,
  count,
  children,
}: {
  title: string
  tone: 'closed' | 'persistent' | 'new'
  count: number
  children: ReactNode
}) {
  return (
    <div className={`diff-column diff-${tone}`}>
      <h3>
        {title} <span className="count">{count}</span>
      </h3>
      <div className="diff-rows">{children}</div>
    </div>
  )
}

function DiffRow({ item, note }: { item: ConsolidatedItem; note?: string }) {
  return (
    <div className="diff-row">
      <SeverityBadge severity={item.severity} />
      <div>
        <strong>{item.title}</strong>
        <div className="desc">{item.location}</div>
        {note && <div className="diff-note">{note}</div>}
      </div>
    </div>
  )
}
