import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { searchCodes, type CodeCitation, type CodeSearchResponse } from '../api'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import { CODE_CORPUS, CODE_SUGGESTED_QUESTIONS } from '../data/codeCorpus'

interface ChatMessage {
  id: string
  question: string
  response?: CodeSearchResponse
  error?: string
  asking: boolean
}

export default function Codes() {
  const { projectId } = useParams<{ projectId: string }>()
  const [question, setQuestion] = useState('')
  const [apiKey, setApiKey] = useApiKey()
  const [messages, setMessages] = useState<ChatMessage[]>([])

  async function ask(text: string) {
    const q = text.trim()
    if (!q) return

    // Same demo pattern as Ask.tsx: byte-identical canned answers for the
    // showcase questions (zero-key), anything else goes live.
    const canned = CODE_SUGGESTED_QUESTIONS.find((s) => s.question === q)
    if (canned) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), question: q, response: canned.answer, asking: false }])
      setQuestion('')
      return
    }

    if (!apiKey.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), question: q, asking: false, error: 'Add your Anthropic API key below to search live.' },
      ])
      return
    }

    const id = crypto.randomUUID()
    setMessages((prev) => [...prev, { id, question: q, asking: true }])
    setQuestion('')
    try {
      const response = await searchCodes(q, CODE_CORPUS, apiKey.trim())
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, response, asking: false } : m)))
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to search codes'
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, error, asking: false } : m)))
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>Codes &amp; standards search</h2>
            <p className="summary">
              A shared reference library — a curated subset of 29 CFR 1926 (OSHA construction safety
              standards, public domain text), not this project's data. Answers cite the exact section
              and quote it verbatim; ask something outside this subset and it says so instead of guessing.
            </p>
          </div>
          {projectId && (
            <Link to={`/project/${projectId}`} className="pdf-btn">
              ← Punch list
            </Link>
          )}
        </div>

        <div className="ask-suggestions">
          {CODE_SUGGESTED_QUESTIONS.map((s) => (
            <button key={s.question} className="ask-suggestion-btn" onClick={() => void ask(s.question)}>
              {s.question}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="ask-thread">
          {messages.length === 0 && <p className="summary">No questions yet — try one above, or type your own.</p>}
          {messages.map((m) => (
            <CodeExchange key={m.id} message={m} />
          ))}
        </div>

        <div className="live-row analyze-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void ask(question)}
            placeholder="Ask what a code section requires…"
          />
          <ApiKeyField value={apiKey} onChange={setApiKey} />
          <button className="upload-btn" disabled={!question.trim()} onClick={() => void ask(question)}>
            Search
          </button>
        </div>
      </section>
    </div>
  )
}

function CodeExchange({ message }: { message: ChatMessage }) {
  return (
    <div className="ask-exchange">
      <p className="ask-question">{message.question}</p>
      {message.asking && <p className="summary">Searching…</p>}
      {message.error && <p className="error">{message.error}</p>}
      {message.response && (
        <div className={`ask-answer ${message.response.grounded ? '' : 'ask-answer-ungrounded'}`}>
          {!message.response.grounded && <span className="ask-refused-badge">Not in this corpus</span>}
          <p>{message.response.answer}</p>
          {message.response.citations.length > 0 && (
            <div className="code-citations">
              {message.response.citations.map((c) => (
                <CitationCard key={c.section} citation={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CitationCard({ citation }: { citation: CodeCitation }) {
  const source = CODE_CORPUS.find((s) => s.section === citation.section)
  const card = (
    <>
      <div className="code-citation-head">
        <span className="code-citation-section">{citation.section}</span>
        <span className="code-citation-title">{citation.title}</span>
      </div>
      <blockquote className="code-citation-quote">&ldquo;{citation.quote}&rdquo;</blockquote>
    </>
  )
  return source ? (
    <a className="code-citation-card" href={source.sourceUrl} target="_blank" rel="noreferrer">
      {card}
    </a>
  ) : (
    <div className="code-citation-card">{card}</div>
  )
}
