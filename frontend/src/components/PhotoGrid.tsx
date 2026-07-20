import { useEffect, useState } from 'react'
import type { Photo } from '../types'

export default function PhotoGrid({
  photos,
  onRetry,
}: {
  photos: Photo[]
  onRetry?: (photoId: string) => void
}) {
  if (photos.length === 0) return null
  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} onRetry={onRetry} />
      ))}
    </div>
  )
}

function PhotoCard({ photo, onRetry }: { photo: Photo; onRetry?: (photoId: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.thumbBlob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo.thumbBlob])

  return (
    <div className={`photo-card status-${photo.status}`}>
      {url && <img src={url} alt={photo.label} loading="lazy" />}
      <div className="photo-card-info">
        <span className="photo-label">{photo.label}</span>
        <span className="photo-status">
          {photo.status === 'pending' && 'Queued'}
          {photo.status === 'analyzing' && 'Analyzing…'}
          {photo.status === 'done' && `${photo.analysis?.items.length ?? 0} issue(s) found`}
          {photo.status === 'error' && (photo.error ?? 'Failed')}
        </span>
      </div>
      {photo.status === 'error' && onRetry && (
        <button className="retry-btn" onClick={() => onRetry(photo.id)}>
          Retry
        </button>
      )}
    </div>
  )
}
