const MAX_FULL_EDGE = 1600
const MAX_THUMB_EDGE = 320
const JPEG_QUALITY = 0.8

export interface ProcessedPhoto {
  blob: Blob
  thumbBlob: Blob
  width: number
  height: number
}

// Downscales an uploaded photo to a JPEG capped at MAX_FULL_EDGE on the long
// edge (~150-400KB), plus a small thumbnail for grid views. Keeps IndexedDB
// usage low and every photo well under the backend's 5MB /analyze cap.
export async function processPhoto(file: File | Blob): Promise<ProcessedPhoto> {
  const bitmap = await loadBitmap(file)
  try {
    const { width, height } = bitmap
    const blob = await drawToJpeg(bitmap, fitWithin(width, height, MAX_FULL_EDGE))
    const thumbBlob = await drawToJpeg(bitmap, fitWithin(width, height, MAX_THUMB_EDGE))
    return { blob, thumbBlob, width, height }
  } finally {
    bitmap.close()
  }
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge) return { width, height }
  const scale = maxEdge / longEdge
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function drawToJpeg(
  bitmap: ImageBitmap,
  size: { width: number; height: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
