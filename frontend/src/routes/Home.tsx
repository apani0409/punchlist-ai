import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, listRoundsByProject, putProject, putRound } from '../lib/db'
import { ensureDemoProject } from '../lib/seed'
import type { Project, Round } from '../types'

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

  return (
    <div className="page">
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
            <button key={p.id} className="project-card" onClick={() => navigate(`/project/${p.id}`)}>
              <div className="project-card-head">
                <span className="project-name">{p.name}</span>
                {p.seeded && <span className="demo-badge">Demo</span>}
              </div>
              <span className="project-meta">
                {roundCounts[p.id] ?? 0} round{(roundCounts[p.id] ?? 0) === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
