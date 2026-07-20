import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, listItemsByRound, listRoundsByProject } from '../lib/db'
import { computeProjectMetrics, type ProjectMetrics } from '../lib/metrics'
import { DEMO_PROJECT_ID, DEMO_RISK_REPORT } from '../data/demoProject'
import StatCard from '../components/StatCard'
import BarChart from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import TrendChart from '../components/charts/TrendChart'
import RiskReportPanel from '../components/RiskReportPanel'
import type { ConsolidatedItem, Project as ProjectType, Round } from '../types'

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [latestItems, setLatestItems] = useState<ConsolidatedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      setLoading(true)
      const p = await getProject(projectId)
      setProject(p ?? null)
      const allRounds = await listRoundsByProject(projectId)
      const itemsByRound = new Map<string, ConsolidatedItem[]>()
      for (const r of allRounds) itemsByRound.set(r.id, await listItemsByRound(r.id))
      setMetrics(computeProjectMetrics(allRounds, itemsByRound))
      setRounds(allRounds)
      const latest = allRounds[allRounds.length - 1]
      setLatestItems(latest ? itemsByRound.get(latest.id) ?? [] : [])
      setLoading(false)
    })()
  }, [projectId])

  if (loading) {
    return (
      <div className="page">
        <p className="summary">Loading…</p>
      </div>
    )
  }

  if (!project || !metrics) {
    return (
      <div className="page">
        <p className="summary">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>{project.name} — Dashboard</h2>
            <p className="summary">
              Metrics derived from the latest inspection round's punch list. No projections or
              synthetic figures.
            </p>
          </div>
          <div className="project-nav-links">
            <Link to={`/project/${project.id}/twin`} className="pdf-btn">
              Digital twin →
            </Link>
            <Link to={`/project/${project.id}`} className="pdf-btn">
              ← Punch list
            </Link>
          </div>
        </div>

        <div className="stat-grid">
          <StatCard label="Open items" value={metrics.openItems} delta={metrics.openItemsDelta} invertDelta />
          <StatCard label="High severity" value={metrics.highSeverityOpen} tone={metrics.highSeverityOpen > 0 ? 'high' : undefined} />
          <StatCard label="Safety open" value={metrics.safetyOpen} tone={metrics.safetyOpen > 0 ? 'high' : undefined} />
          <StatCard
            label="Closure rate"
            value={metrics.closureRate !== null ? `${Math.round(metrics.closureRate * 100)}%` : '—'}
            delta={metrics.closureRateDelta}
            deltaFormat="pp"
          />
          <StatCard
            label="Risk score"
            value={metrics.riskScore}
            delta={metrics.riskScoreDelta}
            invertDelta
            caption="High×5 + Medium×2 + Low×1, open items only"
          />
        </div>
      </section>

      <section className="panel">
        <h2>Risk report</h2>
        <p className="summary">
          A short, prioritized read of what needs attention — grouped and ranked, every risk
          traceable to real open items. Not a live background monitor; generated on request.
        </p>
        <RiskReportPanel
          items={latestItems}
          latestRound={rounds[rounds.length - 1] ?? null}
          cannedReport={projectId === DEMO_PROJECT_ID ? DEMO_RISK_REPORT : undefined}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Open items by trade</h2>
          <BarChart data={metrics.byTrade} />
        </section>

        <section className="panel">
          <h2>Severity distribution</h2>
          <DonutChart data={metrics.bySeverity} />
        </section>

        <section className="panel dashboard-wide">
          <h2>Open vs closed by round</h2>
          <TrendChart data={metrics.roundTrend} />
        </section>
      </div>
    </div>
  )
}
