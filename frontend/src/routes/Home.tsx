import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteProject, listProjects, listRoundsByProject, putProject, putRound } from '../lib/db'
import { ensureDemoProject } from '../lib/seed'
import { DEMO_PROJECT_ID } from '../data/demoProject'
import type { Project, Round } from '../types'

const PIPELINE_STEPS = [
  { icon: '📷', title: 'Capture', body: 'Photos, emails, texts — whatever the field already sends.' },
  { icon: '🧩', title: 'Structure', body: 'A VLM and forced-schema tools turn it into a punch list, RFI, or change order.' },
  { icon: '📈', title: 'Track', body: 'Every inspection round diffed against the last — closed, persistent, new.' },
  { icon: '🗺️', title: 'Contextualize', body: 'A dashboard, a 3D twin, grounded Q&A, and code search tie it together.' },
]

const CAPABILITIES = [
  {
    icon: '🗂️',
    title: 'Projects',
    body: 'Batch photo upload, consolidated across a project, tracked across inspection rounds.',
    to: `/project/${DEMO_PROJECT_ID}`,
  },
  {
    icon: '📥',
    title: 'Inbox',
    body: 'Paste an email or text — get back an editable RFI, change order, or notice.',
    to: `/project/${DEMO_PROJECT_ID}/inbox`,
  },
  {
    icon: '💬',
    title: 'Ask',
    body: "Grounded Q&A over the project's own data — cites sources, refuses rather than guesses.",
    to: `/project/${DEMO_PROJECT_ID}/ask`,
  },
  {
    icon: '📖',
    title: 'Codes',
    body: 'Grounded search over real regulation text — cites the exact section, quotes it verbatim.',
    to: `/project/${DEMO_PROJECT_ID}/codes`,
  },
  {
    icon: '🏢',
    title: 'Digital twin',
    body: 'A 3D twin with severity-colored markers — schematic by default, or a real parsed IFC model.',
    to: `/project/${DEMO_PROJECT_ID}/twin`,
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    await ensureDemoProject()
    const list = await listProjects()
    setProjects(list)
    const counts: Record<string, number> = {}
    for (const p of list) {
      counts[p.id] = (await listRoundsByProject(p.id)).length
    }
    setRoundCounts(counts)
    setLoading(false)
  }

  async function createProject() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    const now = Date.now()
    const project: Project = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }
    await putProject(project)
    const round: Round = {
      id: crypto.randomUUID(),
      projectId: project.id,
      index: 1,
      name: 'Initial inspection',
      createdAt: now,
    }
    await putRound(round)
    setCreating(false)
    navigate(`/project/${project.id}`)
  }

  async function handleDelete(id: string, name: string) {
    const ok = window.confirm(
      `Delete "${name}"? This removes all its photos, items, rounds and documents from this browser.`,
    )
    if (!ok) return
    await deleteProject(id)
    await refresh()
  }

  return (
    <div className="page">
      <section className="panel hero">
        <h2 className="hero-title">From one photo to a whole project</h2>
        <p className="hero-subtitle">
          A tracked, structured punch list — photos, emails, and texts turned into structured
          records that cite their sources and never invent a figure.
        </p>
        <div className="hero-cta">
          <Link to={`/project/${DEMO_PROJECT_ID}`} className="upload-btn hero-cta-btn">
            Explore the demo project →
          </Link>
          <span className="hero-cta-note">No API key needed</span>
        </div>

        <div className="pipeline-flow">
          {PIPELINE_STEPS.map((step, i) => (
            <div className="pipeline-step" key={step.title}>
              <div className="pipeline-step-head">
                <span className="pipeline-step-icon">{step.icon}</span>
                <span className="pipeline-step-title">{step.title}</span>
              </div>
              <p className="pipeline-step-body">{step.body}</p>
              {i < PIPELINE_STEPS.length - 1 && <span className="pipeline-arrow">→</span>}
            </div>
          ))}
        </div>

        <div className="capability-grid">
          {CAPABILITIES.map((c) => (
            <Link className="capability-card" key={c.title} to={c.to}>
              <span className="capability-icon">{c.icon}</span>
              <span className="capability-title">{c.title}</span>
              <span className="capability-body">{c.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Start a new project</h2>
        <p className="summary">
          Drop in a batch of site photos and PunchList AI analyzes each one, then consolidates the
          findings into a single project-level punch list.
        </p>
        <div className="live-row">
          <input
            type="text"
            placeholder="Project name (e.g. Riverside Build — Unit 4)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void createProject()}
          />
          <button
            className="upload-btn"
            disabled={!newName.trim() || creating}
            onClick={() => void createProject()}
          >
            {creating ? 'Creating…' : 'New project'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Projects</h2>
        {loading && <p className="summary">Loading…</p>}
        {!loading && projects.length === 0 && <p className="summary">No projects yet.</p>}
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card">
              <button className="project-card-clickable" onClick={() => navigate(`/project/${p.id}`)}>
                <div className="project-card-head">
                  <span className="project-name">{p.name}</span>
                  {p.seeded && <span className="demo-badge">Demo</span>}
                </div>
                <span className="project-meta">
                  {roundCounts[p.id] ?? 0} round{(roundCounts[p.id] ?? 0) === 1 ? '' : 's'}
                </span>
              </button>
              {!p.seeded && (
                <button
                  className="project-delete-btn"
                  aria-label={`Delete ${p.name}`}
                  title={`Delete ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDelete(p.id, p.name)
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
