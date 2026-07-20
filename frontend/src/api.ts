import { blobToBase64 } from './lib/images'
import type { ExtractedDocument, PunchListResult, Severity, Trade } from './types'

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

export interface DiffItemInput {
  id: string
  title: string
  description: string
  location: string
  trade: Trade
  severity: Severity
}

export interface DiffResponse {
  closed: string[]
  persistent: { previous_id: string; current_id: string; note?: string }[]
  new: string[]
}

export async function diffRounds(
  previousItems: DiffItemInput[],
  currentItems: DiffItemInput[],
  apiKey: string,
): Promise<DiffResponse> {
  return postJson<DiffResponse>(
    '/diff',
    { previous_items: previousItems, current_items: currentItems },
    apiKey,
  )
}

export async function extractDocument(
  text: string,
  apiKey: string,
  hint?: 'rfi' | 'change_order' | 'notice',
): Promise<ExtractedDocument> {
  return postJson<ExtractedDocument>('/extract', { text, hint }, apiKey)
}

export interface AskContextItem {
  id: string
  title: string
  description: string
  location: string
  trade: Trade
  severity: Severity
  round_index: number
}

export interface AskContextRound {
  id: string
  index: number
  name: string
  project_summary: string
  progress_notes: string
}

export interface AskContextDocument {
  id: string
  type: string
  subject: string
  summary: string
}

export interface AskCitation {
  kind: 'item' | 'round' | 'document'
  id: string
  label: string
}

export interface AskResponse {
  answer: string
  grounded: boolean
  citations: AskCitation[]
}

export async function askProject(
  question: string,
  context: { items: AskContextItem[]; rounds: AskContextRound[]; documents: AskContextDocument[] },
  apiKey: string,
): Promise<AskResponse> {
  return postJson<AskResponse>('/ask', { question, ...context }, apiKey)
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
