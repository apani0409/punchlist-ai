import { X } from 'lucide-react'
import BlobImage from './BlobImage'
import type { Photo } from '../types'

export default function PhotoLightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <BlobImage blob={photo.blob} alt={photo.label} className="lightbox-img" />
        <p className="lightbox-label">{photo.label}</p>
      </div>
    </div>
  )
}
