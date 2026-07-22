import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, listDocumentsByProject, listItemsByProject, listRoundsByProject } from '../lib/db'
import { askProject, type AskCitation, type AskContextDocument, type AskContextItem, type AskContextRound, type AskResponse } from '../api'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import { DEMO_PROJECT_ID, DEMO_SUGGESTED_QUESTIONS } from '../data/demoProject'
import type { Project as ProjectType } from '../types'

interface ChatMessage {
  id: string
  question: string
  response?: AskResponse
  error?: string
  asking: boolean
}

const GENERIC_SUGGESTIONS = [
  'What high-severity issues are still open?',
  'What is the total change-order cost impact so far?',
  'What is the project budget?',
]

export default function Ask() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [context, setContext] = useState<{
    items: AskContextItem[]
    rounds: AskContextRound[]
    documents: AskContextDocument[]
  }>({ items: [], rounds: [], documents: [] })
  const [question, setQuestion] = useState('')
  const [apiKey, setApiKey] = useApiKey()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      setLoading(true)
      const p = await getProject(projectId)
      setProject(p ?? null)

      const [items, rounds, documents] = await Promise.all([
        listItemsByProject(projectId),
        listRoundsByProject(projectId),
        listDocumentsByProject(projectId),
      ])
      const roundIndexById = new Map(rounds.map((r) => [r.id, r.index]))
      setContext({
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          location: i.location,
          trade: i.trade,
          severity: i.severity,
          round_index: roundIndexById.get(i.roundId) ?? 0,
        })),
        rounds: rounds.map((r) => ({
          id: r.id,
          index: r.index,
          name: r.name,
          project_summary: r.projectSummary ?? '',
          progress_notes: r.progressNotes ?? '',
        })),
        documents: documents.map((d) => ({
          id: d.id,
          type: d.extracted.type,
          subject: d.extracted.subject,
          summary: d.extracted.summary,
        })),
      })
      setLoading(false)
    })()
  }, [projectId])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || !projectId) return

    // The demo project's showcase questions use pre-computed canned answers
    // (byte-identical, zero-key) rather than a live call — anything else,
    // including a free-typed question on the demo project, goes live.
    if (projectId === DEMO_PROJECT_ID) {
      const canned = DEMO_SUGGESTED_QUESTIONS.find((s) => s.question === q)
      if (canned) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), question: q, response: canned.answer, asking: false }])
        setQuestion('')
        return
      }
    }

    if (!apiKey.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), question: q, asking: false, error: 'Add your Anthropic API key below to ask a live question.' },
      ])
      return
    }

    const id = crypto.randomUUID()
    setMessages((prev) => [...prev, { id, question: q, asking: true }])
    setQuestion('')
    try {
      const response = await askProject(q, context, apiKey.trim())
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, response, asking: false } : m)))
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to get an answer'
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, error, asking: false } : m)))
    }
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

  const suggestions =
    projectId === DEMO_PROJECT_ID ? DEMO_SUGGESTED_QUESTIONS.map((s) => s.question) : GENERIC_SUGGESTIONS

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>{project.name} — Ask</h2>
            <p className="summary">
              Ask a question about this project. Answers come only from this project's own data —
              if something isn't tracked here, it says so instead of guessing, and cites what it
              used for every answer.
            </p>
          </div>
        </div>

        <div className="ask-suggestions">
          {suggestions.map((s) => (
            <button key={s} className="ask-suggestion-btn" onClick={() => void ask(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="ask-thread">
          {messages.length === 0 && <p className="summary">No questions yet — try one above, or type your own.</p>}
          {messages.map((m) => (
            <AskExchange key={m.id} message={m} projectId={project.id} />
          ))}
        </div>

        <div className="live-row analyze-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void ask(question)}
            placeholder="Ask a question about this project…"
          />
          <ApiKeyField value={apiKey} onChange={setApiKey} />
          <button className="upload-btn" disabled={!question.trim()} onClick={() => void ask(question)}>
            Ask
          </button>
        </div>
      </section>
    </div>
  )
}

function AskExchange({ message, projectId }: { message: ChatMessage; projectId: string }) {
  return (
    <div className="ask-exchange">
      <p className="ask-question">{message.question}</p>
      {message.asking && <p className="summary">Thinking…</p>}
      {message.error && <p className="error">{message.error}</p>}
      {message.response && (
        <div className={`ask-answer ${message.response.grounded ? '' : 'ask-answer-ungrounded'}`}>
          {!message.response.grounded && <span className="ask-refused-badge">Not in project data</span>}
          <p>{message.response.answer}</p>
          {message.response.citations.length > 0 && (
            <div className="ask-citations">
              {message.response.citations.map((c) => (
                <CitationChip key={`${c.kind}-${c.id}`} citation={c} projectId={projectId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CitationChip({ citation, projectId }: { citation: AskCitation; projectId: string }) {
  const to = citation.kind === 'document' ? `/project/${projectId}/inbox` : `/project/${projectId}`
  return (
    <Link to={to} className="ask-citation-chip">
      {citation.label}
    </Link>
  )
}
