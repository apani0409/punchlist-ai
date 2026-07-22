import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listDocumentsByProject, putDocument } from '../lib/db'
import { extractDocument } from '../api'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import DocumentCard from '../components/DocumentCard'
import type { ExtractedDocument, Project as ProjectType, ProjectDocument } from '../types'

type Hint = 'auto' | 'rfi' | 'change_order' | 'notice'

export default function Inbox() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [sourceText, setSourceText] = useState('')
  const [hint, setHint] = useState<Hint>('auto')
  const [apiKey, setApiKey] = useApiKey()
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      setLoading(true)
      const p = await getProject(projectId)
      setProject(p ?? null)
      setDocuments(await listDocumentsByProject(projectId))
      setLoading(false)
    })()
  }, [projectId])

  async function handleExtract() {
    if (!projectId || !sourceText.trim()) return
    if (!apiKey.trim()) {
      setError('Add your Anthropic API key below to extract.')
      return
    }
    setError(null)
    setExtracting(true)
    try {
      const extracted: ExtractedDocument = await extractDocument(
        sourceText.trim(),
        apiKey.trim(),
        hint === 'auto' ? undefined : hint,
      )
      const doc: ProjectDocument = {
        id: crypto.randomUUID(),
        projectId,
        status: 'draft',
        createdAt: Date.now(),
        sourceText: sourceText.trim(),
        extracted,
      }
      await putDocument(doc)
      setDocuments((prev) => [doc, ...prev])
      setSourceText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave(id: string, extracted: ExtractedDocument) {
    const doc = documents.find((d) => d.id === id)
    if (!doc) return
    const updated: ProjectDocument = { ...doc, extracted }
    await putDocument(updated)
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  async function handleMarkReviewed(id: string) {
    const doc = documents.find((d) => d.id === id)
    if (!doc) return
    const updated: ProjectDocument = { ...doc, status: 'reviewed' }
    await putDocument(updated)
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  if (loading) {
    return (
      <div className="page">
        <p className="summary">Loading…</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="page">
        <p className="summary">Project not found.</p>
      </div>
    )
  }

  const changeOrders = documents.filter((d) => d.extracted.type === 'change_order')
  const costed = changeOrders.filter((d) => d.extracted.co_cost_amount !== null)
  const totalCost = costed.reduce((sum, d) => sum + (d.extracted.co_cost_amount ?? 0), 0)
  const pendingCost = changeOrders.length - costed.length

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>{project.name} — Inbox</h2>
            <p className="summary">
              Paste a raw email or text from a subcontractor, architect, or field crew — an RFI,
              change order, or notice gets extracted as an editable record. Nothing is invented:
              cost and schedule figures stay blank when the message doesn't state them.
            </p>
          </div>
        </div>

        <textarea
          className="doc-input"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste an email or text message here…"
          rows={5}
          disabled={extracting}
        />
        <div className="live-row analyze-row">
          <select value={hint} onChange={(e) => setHint(e.target.value as Hint)} disabled={extracting}>
            <option value="auto">Auto-detect type</option>
            <option value="rfi">RFI</option>
            <option value="change_order">Change order</option>
            <option value="notice">Notice</option>
          </select>
          <ApiKeyField value={apiKey} onChange={setApiKey} />
          <button
            className="upload-btn"
            disabled={extracting || !sourceText.trim()}
            onClick={() => void handleExtract()}
          >
            {extracting ? 'Extracting…' : 'Extract'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {changeOrders.length > 0 && (
        <section className="panel">
          <h2>Change-order cost impact</h2>
          <p className="summary">
            Total from stated amounts only — never estimated: <strong>${totalCost.toLocaleString('en-US')}</strong> across{' '}
            {costed.length} change order{costed.length === 1 ? '' : 's'}
            {pendingCost > 0 && ` (${pendingCost} pending an amount)`}.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Documents</h2>
        {documents.length === 0 ? (
          <p className="summary">No documents yet — extract one above.</p>
        ) : (
          <div className="doc-list">
            {documents.map((d) => (
              <DocumentCard
                key={d.id}
                doc={d}
                onSave={(id, extracted) => void handleSave(id, extracted)}
                onMarkReviewed={(id) => void handleMarkReviewed(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
