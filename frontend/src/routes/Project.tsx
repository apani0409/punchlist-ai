import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getProject,
  listItemsByRound,
  listPhotosByRound,
  listRoundsByProject,
  putRound,
} from '../lib/db'
import { addPhotosToRound, retryPhoto, runRoundAnalysis } from '../lib/analyze'
import UploadDrop from '../components/UploadDrop'
import PhotoGrid from '../components/PhotoGrid'
import ProgressList from '../components/ProgressList'
import ItemsTable from '../components/ItemsTable'
import RoundTabs from '../components/RoundTabs'
import DiffView from '../components/DiffView'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import { exportProjectPdf } from '../pdf'
import type { ConsolidatedItem, Photo, Project as ProjectType, Round } from '../types'

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [items, setItems] = useState<ConsolidatedItem[]>([])
  const [previousItems, setPreviousItems] = useState<ConsolidatedItem[]>([])
  const [apiKey, setApiKey] = useApiKey()
  const [analyzing, setAnalyzing] = useState(false)
  const [creatingRound, setCreatingRound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const round = rounds.find((r) => r.id === activeRoundId) ?? null

  const loadRoundDetail = useCallback(async (target: Round, allRounds: Round[]) => {
    const [ph, it] = await Promise.all([listPhotosByRound(target.id), listItemsByRound(target.id)])
    setPhotos(ph)
    setItems(it)
    const prevRound = allRounds.find((r) => r.index === target.index - 1)
    setPreviousItems(prevRound ? await listItemsByRound(prevRound.id) : [])
  }, [])

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      setLoading(true)
      const p = await getProject(projectId)
      setProject(p ?? null)
      const allRounds = await listRoundsByProject(projectId)
      setRounds(allRounds)
      const latest = allRounds[allRounds.length - 1] ?? null
      setActiveRoundId(latest?.id ?? null)
      if (latest) await loadRoundDetail(latest, allRounds)
      setLoading(false)
    })()
  }, [projectId, loadRoundDetail])

  async function selectRound(id: string) {
    setActiveRoundId(id)
    const target = rounds.find((r) => r.id === id)
    if (target) await loadRoundDetail(target, rounds)
  }

  // Reloads rounds (to pick up updated diff/summary/progressNotes) plus the
  // currently active round's photos/items. Used after any mutation that
  // doesn't itself switch rounds (upload, analyze, retry).
  async function refreshCurrent() {
    if (!projectId || !activeRoundId) return
    const allRounds = await listRoundsByProject(projectId)
    setRounds(allRounds)
    const target = allRounds.find((r) => r.id === activeRoundId) ?? null
    if (target) await loadRoundDetail(target, allRounds)
  }

  async function handleStartRound() {
    if (!projectId) return
    setCreatingRound(true)
    const now = Date.now()
    const nextIndex = (rounds[rounds.length - 1]?.index ?? 0) + 1
    const newRound: Round = {
      id: crypto.randomUUID(),
      projectId,
      index: nextIndex,
      name: `Round ${nextIndex}`,
      createdAt: now,
    }
    await putRound(newRound)
    const allRounds = await listRoundsByProject(projectId)
    setRounds(allRounds)
    setActiveRoundId(newRound.id)
    await loadRoundDetail(newRound, allRounds)
    setCreatingRound(false)
  }

  async function handleFiles(files: File[]) {
    if (!projectId || !round) return
    await addPhotosToRound(projectId, round.id, files)
    await refreshCurrent()
  }

  async function handleAnalyze() {
    if (!round) return
    if (!apiKey.trim()) {
      setError('Add your Anthropic API key below to analyze photos.')
      return
    }
    setError(null)
    setAnalyzing(true)
    try {
      await runRoundAnalysis(round.id, apiKey.trim(), () => void refreshCurrent())
      await refreshCurrent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRetry(photoId: string) {
    if (!apiKey.trim()) {
      setError('Add your Anthropic API key below to retry.')
      return
    }
    setError(null)
    try {
      await retryPhoto(photoId, apiKey.trim(), () => void refreshCurrent())
      await refreshCurrent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="summary">Loading…</p>
      </div>
    )
  }

  if (!project || !round) {
    return (
      <div className="page">
        <p className="summary">Project not found.</p>
      </div>
    )
  }

  const hasPending = photos.some((p) => p.status === 'pending' || p.status === 'error')
  const photosById = new Map(photos.map((p) => [p.id, p]))

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>{project.name}</h2>
            <p className="summary">{round.name}</p>
          </div>
          <div className="project-nav-links">
            <Link to={`/project/${project.id}/twin`} className="pdf-btn">
              Digital twin →
            </Link>
            <Link to={`/project/${project.id}/dashboard`} className="pdf-btn">
              Dashboard →
            </Link>
          </div>
        </div>
        <RoundTabs rounds={rounds} activeRoundId={activeRoundId} onSelect={(id) => void selectRound(id)} />
        {round.projectSummary && <p className="summary">{round.projectSummary}</p>}
        {round.progressNotes && <p className="summary progress-notes">{round.progressNotes}</p>}
        <div className="round-actions">
          <button className="pdf-btn" disabled={creatingRound} onClick={() => void handleStartRound()}>
            {creatingRound ? 'Starting…' : `Start round ${(rounds[rounds.length - 1]?.index ?? 0) + 1}`}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Photos</h2>
        <UploadDrop onFiles={(files) => void handleFiles(files)} disabled={analyzing} />
        <PhotoGrid photos={photos} onRetry={(id) => void handleRetry(id)} />
        <ProgressList photos={photos} />

        {hasPending && (
          <div className="live-row analyze-row">
            <ApiKeyField value={apiKey} onChange={setApiKey} />
            <button className="upload-btn" disabled={analyzing} onClick={() => void handleAnalyze()}>
              {analyzing ? 'Analyzing…' : 'Analyze photos'}
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {round.diff && (
        <section className="panel">
          <h2>Changes vs previous round</h2>
          <DiffView diff={round.diff} previousItems={previousItems} currentItems={items} />
        </section>
      )}

      <section className="panel results">
        <div className="results-head">
          <h2>Consolidated punch list</h2>
          {items.length > 0 && (
            <button
              className="pdf-btn"
              onClick={() => void exportProjectPdf(project.name, round.name, items)}
            >
              Export PDF
            </button>
          )}
        </div>
        <ItemsTable items={items} photosById={photosById} />
      </section>
    </div>
  )
}
