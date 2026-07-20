import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getProject,
  listItemsByRound,
  listPhotosByRound,
  listRoundsByProject,
  putPhoto,
} from '../lib/db'
import RoundTabs from '../components/RoundTabs'
import SeverityBadge from '../components/SeverityBadge'
import BlobImage from '../components/BlobImage'
import PhotoLightbox from '../components/PhotoLightbox'
import type { ConsolidatedItem, Photo, Project as ProjectType, Round, TwinPosition } from '../types'

// Lazy-loaded so three.js / @react-three/* (~150KB gz) never touch the
// initial bundle — only paid when a user actually opens the twin.
const TwinCanvas = lazy(() => import('../components/twin/TwinCanvas'))

export default function Twin() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [items, setItems] = useState<ConsolidatedItem[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [placingPhotoId, setPlacingPhotoId] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadRound = useCallback(async (roundId: string) => {
    const [ph, it] = await Promise.all([listPhotosByRound(roundId), listItemsByRound(roundId)])
    setPhotos(ph)
    setItems(it)
    setSelectedPhoto(null)
    setPlacingPhotoId(null)
    setLightboxOpen(false)
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
      if (latest) await loadRound(latest.id)
      setLoading(false)
    })()
  }, [projectId, loadRound])

  async function selectRound(id: string) {
    setActiveRoundId(id)
    await loadRound(id)
  }

  async function handlePlace(point: TwinPosition) {
    if (!placingPhotoId) return
    const photo = photos.find((p) => p.id === placingPhotoId)
    if (!photo) return
    const updated: Photo = { ...photo, twin: point }
    await putPhoto(updated)
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? updated : p)))
    setPlacingPhotoId(null)
  }

  if (loading) {
    return (
      <div className="page">
        <p className="summary">Loading…</p>
      </div>
    )
  }

  const round = rounds.find((r) => r.id === activeRoundId) ?? null
  if (!project || !round) {
    return (
      <div className="page">
        <p className="summary">Project not found.</p>
      </div>
    )
  }

  const placingPhoto = photos.find((p) => p.id === placingPhotoId) ?? null
  const unplaced = photos.filter((p) => !p.twin)
  const selectedItems = selectedPhoto
    ? items.filter((it) => it.sourcePhotoIds.includes(selectedPhoto.id))
    : []

  return (
    <div className="page">
      <section className="panel">
        <div className="results-head">
          <div>
            <h2>{project.name} — Digital twin</h2>
            <p className="summary">
              Schematic 3D placeholder, not a survey-accurate model. Markers show where each photo
              was taken and are colored by the worst open severity found there — click one to see
              its findings.
            </p>
          </div>
          <Link to={`/project/${project.id}`} className="pdf-btn">
            ← Punch list
          </Link>
        </div>
        <RoundTabs rounds={rounds} activeRoundId={activeRoundId} onSelect={(id) => void selectRound(id)} />
      </section>

      <section className="panel twin-panel">
        {placingPhoto && (
          <div className="twin-placing-hint">
            <span>
              Click anywhere on the model to place <strong>{placingPhoto.label}</strong>.
            </span>
            <button className="pdf-btn" onClick={() => setPlacingPhotoId(null)}>
              Cancel
            </button>
          </div>
        )}

        <div className="twin-canvas-wrap">
          <Suspense fallback={<p className="summary twin-loading">Loading 3D viewer…</p>}>
            <TwinCanvas
              photos={photos}
              items={items}
              selectedPhotoId={selectedPhoto?.id ?? null}
              onSelectPhoto={setSelectedPhoto}
              placing={!!placingPhoto}
              onPlace={(p) => void handlePlace(p)}
            />
          </Suspense>
        </div>

        <div className="chart-legend chart-legend-row twin-legend">
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'var(--high)' }} />
            <span className="legend-label">High</span>
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'var(--medium)' }} />
            <span className="legend-label">Medium</span>
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'var(--low)' }} />
            <span className="legend-label">Low</span>
          </div>
        </div>
      </section>

      {unplaced.length > 0 && (
        <section className="panel">
          <h2>Place photos on the model</h2>
          <p className="summary">These photos from this round aren't positioned yet.</p>
          <div className="twin-unplaced-list">
            {unplaced.map((p) => (
              <button
                key={p.id}
                className="pdf-btn"
                disabled={!!placingPhoto}
                onClick={() => setPlacingPhotoId(p.id)}
              >
                Place "{p.label}"
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedPhoto && (
        <section className="panel">
          <div className="results-head">
            <div>
              <h2>{selectedPhoto.label}</h2>
              {selectedItems.length === 0 ? (
                <p className="summary">No open items at this photo.</p>
              ) : (
                <ul className="twin-item-list">
                  {selectedItems.map((it) => (
                    <li key={it.id}>
                      <SeverityBadge severity={it.severity} />
                      <span>{it.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="twin-selected-thumb-btn" onClick={() => setLightboxOpen(true)}>
              <BlobImage blob={selectedPhoto.thumbBlob} alt={selectedPhoto.label} className="thumb" />
            </button>
          </div>
        </section>
      )}

      {selectedPhoto && lightboxOpen && (
        <PhotoLightbox photo={selectedPhoto} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}
