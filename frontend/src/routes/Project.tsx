import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listItemsByRound, listPhotosByRound, listRoundsByProject } from '../lib/db'
import { addPhotosToRound, retryPhoto, runRoundAnalysis } from '../lib/analyze'
import UploadDrop from '../components/UploadDrop'
import PhotoGrid from '../components/PhotoGrid'
import ProgressList from '../components/ProgressList'
import ItemsTable from '../components/ItemsTable'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import type { ConsolidatedItem, Photo, Project as ProjectType, Round } from '../types'

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [items, setItems] = useState<ConsolidatedItem[]>([])
  const [apiKey, setApiKey] = useApiKey()
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!projectId) return
    const p = await getProject(projectId)
    setProject(p ?? null)
    const rounds = await listRoundsByProject(projectId)
    const current = rounds[rounds.length - 1] ?? null
    setRound(current)
    if (current) {
      const [ph, it] = await Promise.all([
        listPhotosByRound(current.id),
        listItemsByRound(current.id),
      ])
      setPhotos(ph)
      setItems(it)
    } else {
      setPhotos([])
      setItems([])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleFiles(files: File[]) {
    if (!projectId || !round) return
    await addPhotosToRound(projectId, round.id, files)
    await refresh()
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
      await runRoundAnalysis(round.id, apiKey.trim(), () => void refresh())
      await refresh()
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
      await retryPhoto(photoId, apiKey.trim(), () => void refresh())
      await refresh()
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

  return (
    <div className="page">
      <section className="panel">
        <h2>{project.name}</h2>
        <p className="summary">{round.name}</p>
        {round.projectSummary && <p className="summary">{round.projectSummary}</p>}
        {round.progressNotes && <p className="summary progress-notes">{round.progressNotes}</p>}
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

      <section className="panel results">
        <h2>Consolidated punch list</h2>
        <ItemsTable items={items} />
      </section>
    </div>
  )
}
