import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, listItemsByRound, listRoundsByProject } from '../lib/db'
import { computeProjectMetrics, type ProjectMetrics } from '../lib/metrics'
import StatCard from '../components/StatCard'
import BarChart from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import TrendChart from '../components/charts/TrendChart'
import type { ConsolidatedItem, Project as ProjectType } from '../types'

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      setLoading(true)
      const p = await getProject(projectId)
      setProject(p ?? null)
      const rounds = await listRoundsByProject(projectId)
      const itemsByRound = new Map<string, ConsolidatedItem[]>()
      for (const r of rounds) itemsByRound.set(r.id, await listItemsByRound(r.id))
      setMetrics(computeProjectMetrics(rounds, itemsByRound))
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
          <Link to={`/project/${project.id}`} className="pdf-btn">
            ← Punch list
          </Link>
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
          <StatCard label="Risk score" value={metrics.riskScore} delta={metrics.riskScoreDelta} invertDelta />
        </div>
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
