import type { Photo } from '../types'

export default function ProgressList({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null
  const done = photos.filter((p) => p.status === 'done').length
  const errors = photos.filter((p) => p.status === 'error').length
  const active = photos.some((p) => p.status === 'analyzing' || p.status === 'pending')

  return (
    <div className="progress-list">
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${((done + errors) / photos.length) * 100}%` }}
        />
      </div>
      <span className="progress-text">
        {done} of {photos.length} analyzed
        {errors > 0 && ` · ${errors} failed`}
        {active && ' · working…'}
      </span>
    </div>
  )
}
