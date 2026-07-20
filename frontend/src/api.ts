import { blobToBase64 } from './lib/images'
import type { PunchListResult, Severity, Trade } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function analyzePhoto(file: File, apiKey: string): Promise<PunchListResult> {
  return analyzeImage(file, file.type, apiKey)
}

export async function analyzeImage(
  blob: Blob,
  mediaType: string,
  apiKey: string,
): Promise<PunchListResult> {
  const image_base64 = await blobToBase64(blob)
  return postJson<PunchListResult>('/analyze', { image_base64, media_type: mediaType }, apiKey)
}

export interface AggregatePhotoInput {
  photo_id: string
  label: string
  scene_summary: string
  items: PunchListResult['items']
}

export interface AggregateItem {
  id: number
  title: string
  description: string
  location: string
  trade: Trade
  severity: Severity
  recommended_action: string
  source_photos: { photo_id: string; item_id: number }[]
}

export interface AggregateResponse {
  project_summary: string
  progress_notes: string
  items: AggregateItem[]
}

export async function aggregatePhotos(
  photos: AggregatePhotoInput[],
  apiKey: string,
): Promise<AggregateResponse> {
  return postJson<AggregateResponse>('/aggregate', { photos }, apiKey)
}

async function postJson<T>(path: string, body: unknown, apiKey: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // BYO key: forwarded to the backend for this request only, never stored.
      'X-Anthropic-Key': apiKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}
