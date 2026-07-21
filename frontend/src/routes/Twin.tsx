import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  deleteAnnotation,
  getPhoto,
  getProject,
  listAnnotationsByRound,
  listItemsByRound,
  listPhotosByRound,
  listRoundsByProject,
  putAnnotation,
  putPhoto,
} from '../lib/db'
import { retryPhoto, type AnalyzeProgress } from '../lib/analyze'
import { processPhoto } from '../lib/images'
import RoundTabs from '../components/RoundTabs'
import SeverityBadge from '../components/SeverityBadge'
import BlobImage from '../components/BlobImage'
import PhotoLightbox from '../components/PhotoLightbox'
import ApiKeyField, { useApiKey } from '../components/ApiKeyField'
import TwinPlan2D from '../components/twin/TwinPlan2D'
import type {
  Annotation,
  ConsolidatedItem,
  Photo,
  Project as ProjectType,
  Round,
  Severity,
  Trade,
  TwinPosition,
} from '../types'

const TRADE_OPTIONS: Trade[] = [
  'electrical',
  'plumbing',
  'drywall',
  'paint',
  'concrete',
  'carpentry',
  'safety',
  'general',
]
const SEVERITY_OPTIONS: Severity[] = ['low', 'medium', 'high']

type Placing = { kind: 'photo'; photoId: string } | { kind: 'annotation' } | { kind: 'new-photo'; file: File }

// Lazy-loaded so three.js / @react-three/* (~150KB gz) never touch the
// initial bundle — only paid when a user actually opens the twin.
const TwinCanvas = lazy(() => import('../components/twin/TwinCanvas'))

const DEMO_IFC_URL = '/models/demo-building.ifc'

type IfcStatus = 'idle' | 'loading' | 'loaded' | 'error'

export default function Twin() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectType | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [items, setItems] = useState<ConsolidatedItem[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useApiKey()

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [geometrySource, setGeometrySource] = useState<'schematic' | 'ifc'>('schematic')
  const [ifcUrl, setIfcUrl] = useState<string | null>(null)
  const [ifcFileName, setIfcFileName] = useState<string | null>(null)
  const [ifcStatus, setIfcStatus] = useState<IfcStatus>('idle')
  const [ifcMeshCount, setIfcMeshCount] = useState<number | null>(null)
  const [ifcError, setIfcError] = useState<string | null>(null)

  function showSchematic() {
    setGeometrySource('schematic')
  }

  function showDemoIfc() {
    if (ifcUrl?.startsWith('blob:')) URL.revokeObjectURL(ifcUrl)
    setIfcUrl(DEMO_IFC_URL)
    setIfcFileName('demo-building.ifc')
    setIfcStatus('loading')
    setIfcMeshCount(null)
    setIfcError(null)
    setGeometrySource('ifc')
  }

  function handleIfcUpload(file: File) {
    if (ifcUrl?.startsWith('blob:')) URL.revokeObjectURL(ifcUrl)
    setIfcUrl(URL.createObjectURL(file))
    setIfcFileName(file.name)
    setIfcStatus('loading')
    setIfcMeshCount(null)
    setIfcError(null)
    setGeometrySource('ifc')
  }

  const loadRound = useCallback(async (roundId: string) => {
    const [ph, it, an] = await Promise.all([
      listPhotosByRound(roundId),
      listItemsByRound(roundId),
      listAnnotationsByRound(roundId),
    ])
    setPhotos(ph)
    setItems(it)
    setAnnotations(an)
    setSelectedPhoto(null)
    setSelectedAnnotation(null)
    setPlacing(null)
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
    if (!placing || !activeRoundId || !project) return
    if (placing.kind === 'photo') {
      const photo = photos.find((p) => p.id === placing.photoId)
      if (!photo) return
      const updated: Photo = { ...photo, twin: point }
      await putPhoto(updated)
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? updated : p)))
    } else if (placing.kind === 'new-photo') {
      const { blob, thumbBlob, width, height } = await processPhoto(placing.file)
      const photo: Photo = {
        id: crypto.randomUUID(),
        projectId: project.id,
        roundId: activeRoundId,
        label: placing.file.name.replace(/\.[^/.]+$/, '') || 'Photo',
        source: 'upload',
        blob,
        thumbBlob,
        width,
        height,
        createdAt: Date.now(),
        status: 'pending',
        twin: point,
      }
      await putPhoto(photo)
      setPhotos((prev) => [...prev, photo])
      setSelectedAnnotation(null)
      setSelectedPhoto(photo)
      if (apiKey.trim()) void analyzeNewPhoto(photo.id)
    } else {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        projectId: project.id,
        roundId: activeRoundId,
        label: 'New annotation',
        trade: 'general',
        severity: 'medium',
        position: point,
        createdAt: Date.now(),
      }
      await putAnnotation(annotation)
      setAnnotations((prev) => [...prev, annotation])
      setSelectedPhoto(null)
      setSelectedAnnotation(annotation)
    }
    setPlacing(null)
  }

  // Reuses the exact same single-photo analyze + reaggregate pipeline the
  // Project page's batch upload uses (lib/analyze.ts) — a photo placed here
  // goes through the identical /analyze -> /aggregate path, so it shows up
  // in the punch list, dashboard, and diffs like any other photo, not a
  // twin-only side channel.
  async function analyzeNewPhoto(photoId: string) {
    if (!apiKey.trim() || !activeRoundId) return
    const onProgress = (p: AnalyzeProgress) => {
      setPhotos((prev) => prev.map((ph) => (ph.id === p.photoId ? { ...ph, status: p.status, error: p.error } : ph)))
    }
    await retryPhoto(photoId, apiKey.trim(), onProgress)
    const [freshItems, freshPhoto] = await Promise.all([listItemsByRound(activeRoundId), getPhoto(photoId)])
    setItems(freshItems)
    if (freshPhoto) {
      setPhotos((prev) => prev.map((ph) => (ph.id === photoId ? freshPhoto : ph)))
      setSelectedPhoto((prev) => (prev?.id === photoId ? freshPhoto : prev))
    }
  }

  async function updateAnnotation(patch: Partial<Annotation>) {
    if (!selectedAnnotation) return
    const updated: Annotation = { ...selectedAnnotation, ...patch }
    await putAnnotation(updated)
    setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setSelectedAnnotation(updated)
  }

  async function removeAnnotation(id: string) {
    await deleteAnnotation(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    setSelectedAnnotation((prev) => (prev?.id === id ? null : prev))
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

  const placingPhoto = placing?.kind === 'photo' ? photos.find((p) => p.id === placing.photoId) ?? null : null
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
              Markers show where each photo was taken and are colored by the worst open severity
              found there — click one to see its findings. Markers work the same regardless of the
              geometry underneath.
            </p>
          </div>
          <Link to={`/project/${project.id}`} className="pdf-btn">
            ← Punch list
          </Link>
        </div>
        <RoundTabs rounds={rounds} activeRoundId={activeRoundId} onSelect={(id) => void selectRound(id)} />
      </section>

      <section className="panel">
        <div className="twin-geometry-toggle">
          <div className="twin-geometry-buttons">
            <button className={`twin-geometry-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>
              3D
            </button>
            <button className={`twin-geometry-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>
              2D plan
            </button>
          </div>
        </div>

        {viewMode === '3d' ? (
          <div className="twin-geometry-toggle">
            <div className="twin-geometry-buttons">
              <button
                className={`twin-geometry-btn ${geometrySource === 'schematic' ? 'active' : ''}`}
                onClick={showSchematic}
              >
                Schematic
              </button>
              <button className={`twin-geometry-btn ${geometrySource === 'ifc' ? 'active' : ''}`} onClick={showDemoIfc}>
                BIM (IFC)
              </button>
              <label className="twin-geometry-upload">
                Upload .ifc…
                <input
                  type="file"
                  accept=".ifc"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleIfcUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {geometrySource === 'schematic' && (
              <p className="summary twin-geometry-note">
                Procedurally-generated massing model — a placeholder, not a survey-accurate building.
              </p>
            )}
            {geometrySource === 'ifc' && ifcStatus === 'loading' && (
              <p className="summary twin-geometry-note">Parsing {ifcFileName}…</p>
            )}
            {geometrySource === 'ifc' && ifcStatus === 'loaded' && (
              <p className="summary twin-geometry-note">
                Real IFC model parsed in your browser: {ifcFileName} ({ifcMeshCount} elements). Rescaled
                to this footprint so existing markers still land on it — not a survey-accurate
                registration.
              </p>
            )}
            {geometrySource === 'ifc' && ifcStatus === 'error' && (
              <p className="error twin-geometry-note">{ifcError}</p>
            )}
          </div>
        ) : (
          <p className="summary twin-geometry-note">
            Plan view always uses the schematic footprint as its reference, even when BIM (IFC)
            geometry is active in 3D — the imported model doesn't carry per-floor outline data, only
            an overall shape. Markers are the same underlying positions in both views.
          </p>
        )}
      </section>

      <section className="panel twin-panel">
        <div className="twin-toolbar">
          <button
            className="pdf-btn"
            disabled={!!placing}
            onClick={() => {
              setSelectedPhoto(null)
              setSelectedAnnotation(null)
              setPlacing({ kind: 'annotation' })
            }}
          >
            + Add annotation
          </button>
          <label className={`pdf-btn vision-upload-label ${placing ? 'twin-toolbar-btn-disabled' : ''}`}>
            + Add photo
            <input
              type="file"
              accept="image/*"
              className="vision-upload-input"
              disabled={!!placing}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setSelectedPhoto(null)
                setSelectedAnnotation(null)
                setPlacing({ kind: 'new-photo', file })
              }}
            />
          </label>
          <ApiKeyField value={apiKey} onChange={setApiKey} />
          <p className="summary twin-toolbar-hint">
            Drop a note, or a new photo — analyzed through the same <code>/analyze</code> pipeline
            as every other photo, so it joins the punch list too.
          </p>
        </div>

        {placing && (
          <div className="twin-placing-hint">
            <span>
              {placing.kind === 'photo' ? (
                <>
                  Click anywhere on the model to place <strong>{placingPhoto?.label}</strong>.
                </>
              ) : placing.kind === 'new-photo' ? (
                <>
                  Click anywhere on the model to place <strong>{placing.file.name}</strong>.
                </>
              ) : (
                'Click anywhere on the model to drop the annotation.'
              )}
            </span>
            <button className="pdf-btn" onClick={() => setPlacing(null)}>
              Cancel
            </button>
          </div>
        )}

        <div className="twin-canvas-wrap">
          {viewMode === '2d' ? (
            <TwinPlan2D
              photos={photos}
              items={items}
              annotations={annotations}
              selectedPhotoId={selectedPhoto?.id ?? null}
              onSelectPhoto={(p) => {
                setSelectedAnnotation(null)
                setSelectedPhoto(p)
              }}
              selectedAnnotationId={selectedAnnotation?.id ?? null}
              onSelectAnnotation={(a) => {
                setSelectedPhoto(null)
                setSelectedAnnotation(a)
              }}
              placing={!!placing}
              onPlace={(p) => void handlePlace(p)}
            />
          ) : (
          <Suspense fallback={<p className="summary twin-loading">Loading 3D viewer…</p>}>
            <TwinCanvas
              photos={photos}
              items={items}
              annotations={annotations}
              selectedPhotoId={selectedPhoto?.id ?? null}
              onSelectPhoto={(p) => {
                setSelectedAnnotation(null)
                setSelectedPhoto(p)
              }}
              selectedAnnotationId={selectedAnnotation?.id ?? null}
              onSelectAnnotation={(a) => {
                setSelectedPhoto(null)
                setSelectedAnnotation(a)
              }}
              placing={!!placing}
              onPlace={(p) => void handlePlace(p)}
              ifcUrl={geometrySource === 'ifc' ? ifcUrl : null}
              onIfcLoaded={(meshCount) => {
                setIfcStatus('loaded')
                setIfcMeshCount(meshCount)
              }}
              onIfcError={(message) => {
                setIfcStatus('error')
                setIfcError(message)
              }}
            />
          </Suspense>
          )}
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
          <div className="legend-row">
            <span className="legend-swatch twin-legend-swatch-annotation" />
            <span className="legend-label">Annotation</span>
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
                disabled={!!placing}
                onClick={() => {
                  setSelectedAnnotation(null)
                  setPlacing({ kind: 'photo', photoId: p.id })
                }}
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
              {selectedPhoto.status === 'pending' && (
                <>
                  <p className="summary">
                    {apiKey.trim()
                      ? 'Not analyzed yet.'
                      : 'Not analyzed yet — add an API key above, or run analysis from the punch list page.'}
                  </p>
                  {apiKey.trim() && (
                    <button className="pdf-btn" onClick={() => void analyzeNewPhoto(selectedPhoto.id)}>
                      Analyze
                    </button>
                  )}
                </>
              )}
              {selectedPhoto.status === 'analyzing' && <p className="summary">Analyzing…</p>}
              {selectedPhoto.status === 'error' && (
                <>
                  <p className="error">{selectedPhoto.error}</p>
                  <button
                    className="pdf-btn"
                    disabled={!apiKey.trim()}
                    onClick={() => void analyzeNewPhoto(selectedPhoto.id)}
                  >
                    Retry
                  </button>
                </>
              )}
              {selectedPhoto.status === 'done' &&
                (selectedItems.length === 0 ? (
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
                ))}
            </div>
            <button className="twin-selected-thumb-btn" onClick={() => setLightboxOpen(true)}>
              <BlobImage blob={selectedPhoto.thumbBlob} alt={selectedPhoto.label} className="thumb" />
            </button>
          </div>
        </section>
      )}

      {selectedAnnotation && (
        <section className="panel">
          <div className="results-head">
            <h2>Edit annotation</h2>
            <button className="pdf-btn" onClick={() => void removeAnnotation(selectedAnnotation.id)}>
              Delete
            </button>
          </div>
          <div className="doc-fields">
            <label>
              Label
              <input
                className="doc-input"
                value={selectedAnnotation.label}
                onChange={(e) => void updateAnnotation({ label: e.target.value })}
              />
            </label>
            <label>
              Note
              <textarea
                className="doc-input"
                rows={2}
                value={selectedAnnotation.note ?? ''}
                onChange={(e) => void updateAnnotation({ note: e.target.value })}
                placeholder="Optional detail…"
              />
            </label>
            <div className="doc-fields-row">
              <label>
                Trade
                <select
                  value={selectedAnnotation.trade}
                  onChange={(e) => void updateAnnotation({ trade: e.target.value as Trade })}
                >
                  {TRADE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select
                  value={selectedAnnotation.severity}
                  onChange={(e) => void updateAnnotation({ severity: e.target.value as Severity })}
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>
      )}

      {selectedPhoto && lightboxOpen && (
        <PhotoLightbox photo={selectedPhoto} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}
