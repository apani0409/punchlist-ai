import type { ConsolidatedItem, Round, Severity, Trade } from '../types'

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 5, medium: 2, low: 1 }

export interface ProjectMetrics {
  openItems: number
  openItemsDelta: number | null // vs the previous round's open item count
  highSeverityOpen: number
  safetyOpen: number
  closureRate: number | null // fraction 0-1, from the latest round's diff
  closureRateDelta: number | null // vs the previous round's closure rate
  riskScore: number // severity-weighted sum of open items
  riskScoreDelta: number | null // vs the previous round's risk score
  bySeverity: Record<Severity, number>
  byTrade: { trade: Trade; count: number }[]
  roundTrend: { roundName: string; roundIndex: number; open: number; closed: number }[]
}

// All figures here are derived directly from stored rounds/items — no
// projections, no synthetic SPI/CPI. `itemsByRound` must already contain an
// entry for every round passed in `rounds`.
export function computeProjectMetrics(
  rounds: Round[],
  itemsByRound: Map<string, ConsolidatedItem[]>,
): ProjectMetrics {
  const sorted = [...rounds].sort((a, b) => a.index - b.index)
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const beforePrevious = sorted[sorted.length - 3]

  const latestItems = latest ? itemsByRound.get(latest.id) ?? [] : []
  const previousItems = previous ? itemsByRound.get(previous.id) ?? [] : []

  const openItems = latestItems.length
  const openItemsDelta = previous ? openItems - previousItems.length : null
  const highSeverityOpen = latestItems.filter((i) => i.severity === 'high').length
  const safetyOpen = latestItems.filter((i) => i.trade === 'safety').length
  const riskScore = sumRisk(latestItems)

  const closureRate = closureRateOf(latest)
  let closureRateDelta: number | null = null
  if (closureRate !== null && beforePrevious) {
    const previousClosureRate = closureRateOf(previous)
    if (previousClosureRate !== null) closureRateDelta = closureRate - previousClosureRate
  }

  let riskScoreDelta: number | null = null
  if (previous) riskScoreDelta = riskScore - sumRisk(previousItems)

  const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 }
  for (const item of latestItems) bySeverity[item.severity]++

  const tradeCounts = new Map<Trade, number>()
  for (const item of latestItems) tradeCounts.set(item.trade, (tradeCounts.get(item.trade) ?? 0) + 1)
  const byTrade = [...tradeCounts.entries()]
    .map(([trade, count]) => ({ trade, count }))
    .sort((a, b) => b.count - a.count)

  const roundTrend = sorted.map((r) => ({
    roundName: r.name,
    roundIndex: r.index,
    open: (itemsByRound.get(r.id) ?? []).length,
    closed: r.diff?.closed.length ?? 0,
  }))

  return {
    openItems,
    openItemsDelta,
    highSeverityOpen,
    safetyOpen,
    closureRate,
    closureRateDelta,
    riskScore,
    riskScoreDelta,
    bySeverity,
    byTrade,
    roundTrend,
  }
}

function sumRisk(items: ConsolidatedItem[]): number {
  return items.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0)
}

function closureRateOf(round: Round | undefined): number | null {
  if (!round?.diff) return null
  const totalPrevious = round.diff.closed.length + round.diff.persistent.length
  return totalPrevious > 0 ? round.diff.closed.length / totalPrevious : null
}
