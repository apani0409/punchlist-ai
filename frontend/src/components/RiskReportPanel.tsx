import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { riskReport, type RiskReportResponse } from '../api'
import ApiKeyField, { useApiKey } from './ApiKeyField'
import SeverityBadge from './SeverityBadge'
import type { ConsolidatedItem, Round } from '../types'

export default function RiskReportPanel({
  items,
  latestRound,
  cannedReport,
}: {
  items: ConsolidatedItem[]
  latestRound: Round | null
  cannedReport?: RiskReportResponse
}) {
  const [apiKey, setApiKey] = useApiKey()
  const [report, setReport] = useState<RiskReportResponse | null>(cannedReport ?? null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // `useState`'s initializer only runs on mount — if this component instance
  // is ever reused across a projectId-only navigation (React Router can do
  // this for same-route param changes), reset explicitly so a stale report
  // from the previous project never lingers.
  useEffect(() => {
    setReport(cannedReport ?? null)
    setError(null)
  }, [cannedReport])

  async function generate() {
    if (!apiKey.trim()) {
      setError('Add your Anthropic API key below to generate a risk report.')
      return
    }
    if (items.length === 0) {
      setError('No open items to assess yet.')
      return
    }
    setError(null)
    setGenerating(true)
    try {
      const diff = latestRound?.diff
        ? {
            closed_count: latestRound.diff.closed.length,
            persistent_count: latestRound.diff.persistent.length,
            new_count: latestRound.diff.new.length,
          }
        : undefined
      const resp = await riskReport(
        items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          location: i.location,
          trade: i.trade,
          severity: i.severity,
        })),
        diff,
        latestRound?.progressNotes,
        apiKey.trim(),
      )
      setReport(resp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate risk report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="risk-report">
      {report && (
        <>
          <p className="risk-headline">{report.headline}</p>
          <ol className="risk-list">
            {report.risks.map((r, i) => (
              <li key={i} className="risk-item">
                <div className="risk-item-head">
                  <SeverityBadge severity={r.severity} />
                  <strong>{r.title}</strong>
                </div>
                <p className="risk-why">{r.why}</p>
                <p className="risk-action">
                  <ArrowRight size={13} />
                  {r.recommended_action}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="live-row analyze-row">
        <ApiKeyField value={apiKey} onChange={setApiKey} />
        <button className="upload-btn" disabled={generating} onClick={() => void generate()}>
          {generating ? 'Generating…' : report ? 'Regenerate' : 'Generate risk report'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
