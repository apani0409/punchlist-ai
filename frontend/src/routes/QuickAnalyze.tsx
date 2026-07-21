import { useEffect, useMemo, useState } from 'react'
import { SAMPLES } from '../data/samples'
import { analyzePhoto } from '../api'
import { exportPdf } from '../pdf'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import type { PunchListResult, Severity, Trade } from '../types'

type Source =
  | { kind: 'sample'; id: string; label: string; photo: string }
  | { kind: 'upload'; label: string; photo: string }

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export default function QuickAnalyze() {
  const [source, setSource] = useState<Source | null>(null)
  const [result, setResult] = useState<PunchListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useApiKey()
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [tradeFilter, setTradeFilter] = useState<Trade | 'all'>('all')

  // Deep-link support: /?sample=<id> or /#sample=<id> pre-selects a sample.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('sample')
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('sample')
    const id = fromQuery ?? fromHash
    if (id && SAMPLES.some((s) => s.id === id)) selectSample(id)
    // Intentionally mount-only: re-running on every `selectSample` identity
    // change would fight the user's own sample picks after the deep link.
  }, [])

  const trades = useMemo(() => {
    if (!result) return []
    return [...new Set(result.items.map((i) => i.trade))]
  }, [result])

  const filtered = useMemo(() => {
    if (!result) return []
    return result.items
      .filter((i) => severityFilter === 'all' || i.severity === severityFilter)
      .filter((i) => tradeFilter === 'all' || i.trade === tradeFilter)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [result, severityFilter, tradeFilter])

  function selectSample(id: string) {
    const s = SAMPLES.find((x) => x.id === id)!
    setSource({ kind: 'sample', id: s.id, label: s.label, photo: s.photo })
    setResult(s.result)
    setError(null)
    setSeverityFilter('all')
    setTradeFilter('all')
  }

  async function handleUpload(file: File) {
    if (!apiKey.trim()) {
      setError(
        'Live mode needs an Anthropic API key (used for this request only, never stored). Or explore the pre-analyzed samples above — no key needed.',
      )
      return
    }
    const photoUrl = URL.createObjectURL(file)
    setSource({ kind: 'upload', label: file.name, photo: photoUrl })
    setResult(null)
    setError(null)
    setLoading(true)
    try {
      const res = await analyzePhoto(file, apiKey.trim())
      setResult(res)
      setSeverityFilter('all')
      setTradeFilter('all')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>1 · Pick a sample photo (instant, no API key)</h2>
        <div className="samples">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              className={`sample-card ${source?.kind === 'sample' && source.id === s.id ? 'active' : ''}`}
              onClick={() => selectSample(s.id)}
            >
              <img src={s.photo} alt={s.label} loading="lazy" />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <h2>2 · …or analyze your own photo (live)</h2>
        <div className="live-row">
          <ApiKeyField value={apiKey} onChange={setApiKey} />
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? 'Analyzing…' : 'Upload photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleUpload(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {source && result && (
        <section className="panel results">
          <div className="results-head">
            <div>
              <h2>Punch list — {source.label}</h2>
              <p className="summary">{result.scene_summary}</p>
            </div>
            <img className="thumb" src={source.photo} alt={source.label} />
          </div>

          <div className="toolbar">
            <div className="filters">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
              >
                <option value="all">All severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value as Trade | 'all')}
              >
                <option value="all">All trades</option>
                {trades.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="count">
                {filtered.length} of {result.items.length} items
              </span>
            </div>
            <button className="pdf-btn" onClick={() => void exportPdf(result, source.label)}>
              Export PDF
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Issue</th>
                  <th>Location in photo</th>
                  <th>Trade</th>
                  <th>Severity</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td className="num">{it.id}</td>
                    <td>
                      <strong>{it.title}</strong>
                      <div className="desc">{it.description}</div>
                    </td>
                    <td>{it.location_in_photo}</td>
                    <td>
                      <span className="trade">{it.trade}</span>
                    </td>
                    <td>
                      <span className={`sev sev-${it.severity}`}>{it.severity}</span>
                    </td>
                    <td>{it.recommended_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
