import { useState } from 'react'
import type { ExtractedDocument, ProjectDocument, Trade } from '../types'

const TYPE_LABEL: Record<ExtractedDocument['type'], string> = {
  rfi: 'RFI',
  change_order: 'Change Order',
  notice: 'Notice',
}

const TRADES: Trade[] = [
  'electrical',
  'plumbing',
  'drywall',
  'paint',
  'concrete',
  'carpentry',
  'safety',
  'general',
]

export default function DocumentCard({
  doc,
  onSave,
  onMarkReviewed,
}: {
  doc: ProjectDocument
  onSave: (id: string, extracted: ExtractedDocument) => void
  onMarkReviewed: (id: string) => void
}) {
  const [extracted, setExtracted] = useState(doc.extracted)

  function set<K extends keyof ExtractedDocument>(key: K, value: ExtractedDocument[K]) {
    setExtracted((prev) => ({ ...prev, [key]: value }))
  }

  function persist() {
    onSave(doc.id, extracted)
  }

  function numberField(raw: string): number | null {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isNaN(n) ? null : n
  }

  return (
    <div className={`doc-card doc-priority-${extracted.priority}`}>
      <div className="doc-card-head">
        <span className="doc-type-badge">{TYPE_LABEL[extracted.type]}</span>
        <span className={`sev sev-${extracted.priority === 'high' ? 'high' : extracted.priority === 'medium' ? 'medium' : 'low'}`}>
          {extracted.priority}
        </span>
        <span className={`doc-status-badge doc-status-${doc.status}`}>
          {doc.status === 'reviewed' ? 'Reviewed' : 'Draft'}
        </span>
      </div>

      <input
        className="doc-subject-input"
        value={extracted.subject}
        onChange={(e) => set('subject', e.target.value)}
        onBlur={persist}
        placeholder="Subject"
      />
      <textarea
        className="doc-summary-input"
        value={extracted.summary}
        onChange={(e) => set('summary', e.target.value)}
        onBlur={persist}
        rows={2}
        placeholder="Summary"
      />

      {extracted.type === 'rfi' && (
        <div className="doc-fields">
          <label>
            Question
            <textarea
              value={extracted.rfi_question}
              onChange={(e) => set('rfi_question', e.target.value)}
              onBlur={persist}
              rows={3}
            />
          </label>
          <div className="doc-fields-row">
            <label>
              Discipline
              <select value={extracted.rfi_discipline} onChange={(e) => { set('rfi_discipline', e.target.value as Trade | ''); persist() }}>
                <option value="">—</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Drawing / spec ref
              <input
                value={extracted.rfi_reference}
                onChange={(e) => set('rfi_reference', e.target.value)}
                onBlur={persist}
              />
            </label>
          </div>
          <p className="doc-note">RFIs aren't answered automatically — resolving them means reviewing the actual drawings/specs.</p>
        </div>
      )}

      {extracted.type === 'change_order' && (
        <div className="doc-fields">
          <label>
            Description
            <textarea
              value={extracted.co_description}
              onChange={(e) => set('co_description', e.target.value)}
              onBlur={persist}
              rows={3}
            />
          </label>
          <div className="doc-fields-row">
            <label>
              Trade
              <select value={extracted.co_trade} onChange={(e) => { set('co_trade', e.target.value as Trade | ''); persist() }}>
                <option value="">—</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Cost amount
              <input
                type="number"
                value={extracted.co_cost_amount ?? ''}
                placeholder="not stated"
                onChange={(e) => set('co_cost_amount', numberField(e.target.value))}
                onBlur={persist}
              />
            </label>
            <label>
              Schedule impact (days)
              <input
                type="number"
                value={extracted.co_schedule_impact_days ?? ''}
                placeholder="not stated"
                onChange={(e) => set('co_schedule_impact_days', numberField(e.target.value))}
                onBlur={persist}
              />
            </label>
          </div>
          {extracted.co_cost_amount === null && (
            <p className="doc-note">No dollar amount was stated in the source message — left blank rather than guessed.</p>
          )}
        </div>
      )}

      {extracted.type === 'notice' && (
        <div className="doc-fields">
          <label>
            Notice body (draft — review before sending)
            <textarea
              value={extracted.notice_body_draft}
              onChange={(e) => set('notice_body_draft', e.target.value)}
              onBlur={persist}
              rows={5}
            />
          </label>
        </div>
      )}

      <details className="doc-source">
        <summary>Source message</summary>
        <p>{doc.sourceText}</p>
      </details>

      {doc.status === 'draft' && (
        <div className="doc-card-actions">
          <button className="upload-btn" onClick={() => onMarkReviewed(doc.id)}>
            Mark reviewed
          </button>
        </div>
      )}
    </div>
  )
}
