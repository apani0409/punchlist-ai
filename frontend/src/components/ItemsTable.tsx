import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ConsolidatedItem, Photo, Severity, Trade } from '../types'
import SeverityBadge from './SeverityBadge'
import BlobImage from './BlobImage'
import PhotoLightbox from './PhotoLightbox'

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export default function ItemsTable({
  items,
  photosById,
  projectId,
}: {
  items: ConsolidatedItem[]
  photosById: Map<string, Photo>
  projectId?: string
}) {
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [tradeFilter, setTradeFilter] = useState<Trade | 'all'>('all')
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  const trades = useMemo(() => [...new Set(items.map((i) => i.trade))], [items])

  const filtered = useMemo(() => {
    return items
      .filter((i) => severityFilter === 'all' || i.severity === severityFilter)
      .filter((i) => tradeFilter === 'all' || i.trade === tradeFilter)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [items, severityFilter, tradeFilter])

  if (items.length === 0) {
    return <p className="summary">No consolidated items yet.</p>
  }

  return (
    <div>
      <div className="toolbar">
        <div className="filters">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
          >
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value as Trade | 'all')}>
            <option value="all">All trades</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="count">
            {filtered.length} of {items.length} items
          </span>
        </div>
      </div>

      <div className="table-scroll table-scroll-desktop-only">
        <table>
          <thead>
            <tr>
              <th>Issue</th>
              <th>Location</th>
              <th>Trade</th>
              <th>Severity</th>
              <th>Recommended action</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id}>
                <td>
                  <strong>{it.title}</strong>
                  <div className="desc">{it.description}</div>
                </td>
                <td>{it.location}</td>
                <td>
                  <span className="trade">{it.trade}</span>
                </td>
                <td>
                  <SeverityBadge severity={it.severity} />
                </td>
                <td>
                  {it.recommended_action}
                  {it.codeRefs && it.codeRefs.length > 0 && projectId && (
                    <div className="code-refs">
                      {it.codeRefs.map((ref) => (
                        <Link key={ref.section} to={`/project/${projectId}/codes`} className="code-ref-chip" title={ref.title}>
                          {ref.section}
                        </Link>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <div className="photo-thumbs">
                    {it.sourcePhotoIds.map((pid) => {
                      const photo = photosById.get(pid)
                      if (!photo) return null
                      return (
                        <button
                          key={pid}
                          className="photo-thumb-btn"
                          title={photo.label}
                          onClick={() => setLightboxPhoto(photo)}
                        >
                          <BlobImage blob={photo.thumbBlob} alt={photo.label} className="photo-thumb-img" />
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="item-cards">
        {filtered.map((it) => (
          <div key={it.id} className="item-card">
            <div className="item-card-head">
              <SeverityBadge severity={it.severity} />
              <span className="trade">{it.trade}</span>
            </div>
            <strong className="item-card-title">{it.title}</strong>
            <p className="item-card-desc">{it.description}</p>
            <div className="item-card-row">
              <span className="item-card-label">Location</span>
              <span>{it.location}</span>
            </div>
            <div className="item-card-row">
              <span className="item-card-label">Action</span>
              <span>{it.recommended_action}</span>
            </div>
            {it.codeRefs && it.codeRefs.length > 0 && projectId && (
              <div className="code-refs">
                {it.codeRefs.map((ref) => (
                  <Link key={ref.section} to={`/project/${projectId}/codes`} className="code-ref-chip" title={ref.title}>
                    {ref.section}
                  </Link>
                ))}
              </div>
            )}
            {it.sourcePhotoIds.length > 0 && (
              <div className="photo-thumbs">
                {it.sourcePhotoIds.map((pid) => {
                  const photo = photosById.get(pid)
                  if (!photo) return null
                  return (
                    <button
                      key={pid}
                      className="photo-thumb-btn"
                      title={photo.label}
                      onClick={() => setLightboxPhoto(photo)}
                    >
                      <BlobImage blob={photo.thumbBlob} alt={photo.label} className="photo-thumb-img" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxPhoto && <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </div>
  )
}
