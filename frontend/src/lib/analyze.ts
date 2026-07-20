import { aggregatePhotos, analyzeImage, diffRounds, type AggregateResponse, type DiffResponse } from '../api'
import {
  getPhoto,
  getRound,
  listItemsByRound,
  listPhotosByRound,
  listRoundsByProject,
  putPhoto,
  putRound,
  replaceItemsForRound,
} from './db'
import { processPhoto } from './images'
import type { ConsolidatedItem, Photo, RoundDiff } from '../types'

const CONCURRENCY = 2

export interface AnalyzeProgress {
  photoId: string
  status: Photo['status']
  error?: string
}

export async function addPhotosToRound(
  projectId: string,
  roundId: string,
  files: File[],
): Promise<Photo[]> {
  const photos: Photo[] = []
  for (const file of files) {
    const { blob, thumbBlob, width, height } = await processPhoto(file)
    const photo: Photo = {
      id: crypto.randomUUID(),
      projectId,
      roundId,
      label: file.name.replace(/\.[^/.]+$/, ''),
      source: 'upload',
      blob,
      thumbBlob,
      width,
      height,
      createdAt: Date.now(),
      status: 'pending',
    }
    await putPhoto(photo)
    photos.push(photo)
  }
  return photos
}

// Analyzes every pending/errored photo in a round (bounded concurrency),
// then consolidates the round via /aggregate. State is persisted to
// IndexedDB after every transition so a refresh mid-batch loses nothing.
export async function runRoundAnalysis(
  roundId: string,
  apiKey: string,
  onProgress?: (p: AnalyzeProgress) => void,
): Promise<void> {
  const photos = await listPhotosByRound(roundId)
  const pending = photos.filter((p) => p.status === 'pending' || p.status === 'error')

  await runQueue(pending, CONCURRENCY, (photo) => analyzeSinglePhoto(photo, apiKey, onProgress))
  await aggregateRound(roundId, apiKey)
}

export async function retryPhoto(
  photoId: string,
  apiKey: string,
  onProgress?: (p: AnalyzeProgress) => void,
): Promise<void> {
  const photo = await getPhoto(photoId)
  if (!photo) return
  await analyzeSinglePhoto(photo, apiKey, onProgress)
  await aggregateRound(photo.roundId, apiKey)
}

async function analyzeSinglePhoto(
  photo: Photo,
  apiKey: string,
  onProgress?: (p: AnalyzeProgress) => void,
): Promise<void> {
  photo.status = 'analyzing'
  photo.error = undefined
  await putPhoto(photo)
  onProgress?.({ photoId: photo.id, status: 'analyzing' })
  try {
    const analysis = await analyzeImage(photo.blob, 'image/jpeg', apiKey)
    photo.analysis = analysis
    photo.status = 'done'
    await putPhoto(photo)
    onProgress?.({ photoId: photo.id, status: 'done' })
  } catch (e) {
    photo.status = 'error'
    photo.error = e instanceof Error ? e.message : 'Analysis failed'
    await putPhoto(photo)
    onProgress?.({ photoId: photo.id, status: 'error', error: photo.error })
  }
}

// Consolidates every analyzed photo in a round via /aggregate. If the call
// fails (bad key, rate limit, network), falls back to a pass-through list
// (each photo's items, unmerged) so the pipeline never dead-ends.
export async function aggregateRound(roundId: string, apiKey: string): Promise<void> {
  const round = await getRound(roundId)
  if (!round) return
  const photos = await listPhotosByRound(roundId)
  const done = photos.filter((p) => p.status === 'done' && p.analysis)
  if (done.length === 0) return

  let items: ConsolidatedItem[]
  let projectSummary = round.projectSummary
  let progressNotes = round.progressNotes

  try {
    const resp = await aggregatePhotos(
      done.map((p) => ({
        photo_id: p.id,
        label: p.label,
        scene_summary: p.analysis!.scene_summary,
        items: p.analysis!.items,
      })),
      apiKey,
    )
    items = toConsolidatedItems(round.projectId, roundId, resp)
    projectSummary = resp.project_summary
    progressNotes = resp.progress_notes
  } catch {
    items = passthroughItems(round.projectId, roundId, done)
  }

  await replaceItemsForRound(roundId, items)

  let diff = round.diff
  if (round.index > 1) {
    const siblingRounds = await listRoundsByProject(round.projectId)
    const previousRound = siblingRounds.find((r) => r.index === round.index - 1)
    if (previousRound) {
      const previousItems = await listItemsByRound(previousRound.id)
      diff = await computeRoundDiff(previousItems, items, apiKey)
    }
  }

  await putRound({ ...round, projectSummary, progressNotes, diff })
}

// Compares two rounds' consolidated items and classifies each as closed,
// persistent, or new. Falls back to a trade+location heuristic if the
// /diff call fails, so round tracking never dead-ends.
async function computeRoundDiff(
  previousItems: ConsolidatedItem[],
  currentItems: ConsolidatedItem[],
  apiKey: string,
): Promise<RoundDiff> {
  if (previousItems.length === 0) {
    return { closed: [], persistent: [], new: currentItems.map((i) => i.id) }
  }
  if (currentItems.length === 0) {
    return { closed: previousItems.map((i) => i.id), persistent: [], new: [] }
  }

  try {
    const resp = await diffRounds(
      previousItems.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        location: i.location,
        trade: i.trade,
        severity: i.severity,
      })),
      currentItems.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        location: i.location,
        trade: i.trade,
        severity: i.severity,
      })),
      apiKey,
    )
    return validateDiff(resp, previousItems, currentItems)
  } catch {
    return heuristicDiff(previousItems, currentItems)
  }
}

// Anti-hallucination guard: drops any id the model invented, then assigns
// every remaining previous/current id to closed/new respectively so the
// diff always accounts for 100% of both rounds' items.
function validateDiff(
  resp: DiffResponse,
  previousItems: ConsolidatedItem[],
  currentItems: ConsolidatedItem[],
): RoundDiff {
  const previousIds = new Set(previousItems.map((i) => i.id))
  const currentIds = new Set(currentItems.map((i) => i.id))
  const claimedPrevious = new Set<string>()
  const claimedCurrent = new Set<string>()

  const persistent: RoundDiff['persistent'] = []
  for (const p of resp.persistent) {
    if (
      previousIds.has(p.previous_id) &&
      currentIds.has(p.current_id) &&
      !claimedPrevious.has(p.previous_id) &&
      !claimedCurrent.has(p.current_id)
    ) {
      persistent.push({ previousId: p.previous_id, currentId: p.current_id, note: p.note })
      claimedPrevious.add(p.previous_id)
      claimedCurrent.add(p.current_id)
    }
  }

  const closed: string[] = []
  for (const id of resp.closed) {
    if (previousIds.has(id) && !claimedPrevious.has(id)) {
      closed.push(id)
      claimedPrevious.add(id)
    }
  }
  for (const id of previousIds) {
    if (!claimedPrevious.has(id)) {
      closed.push(id)
      claimedPrevious.add(id)
    }
  }

  const fresh: string[] = []
  for (const id of resp.new) {
    if (currentIds.has(id) && !claimedCurrent.has(id)) {
      fresh.push(id)
      claimedCurrent.add(id)
    }
  }
  for (const id of currentIds) {
    if (!claimedCurrent.has(id)) {
      fresh.push(id)
      claimedCurrent.add(id)
    }
  }

  return { closed, persistent, new: fresh }
}

function heuristicDiff(previousItems: ConsolidatedItem[], currentItems: ConsolidatedItem[]): RoundDiff {
  const usedCurrent = new Set<string>()
  const persistent: RoundDiff['persistent'] = []
  const closed: string[] = []

  for (const prev of previousItems) {
    const match = currentItems.find(
      (cur) => !usedCurrent.has(cur.id) && cur.trade === prev.trade && similarLocation(cur.location, prev.location),
    )
    if (match) {
      persistent.push({ previousId: prev.id, currentId: match.id })
      usedCurrent.add(match.id)
    } else {
      closed.push(prev.id)
    }
  }

  const fresh = currentItems.filter((c) => !usedCurrent.has(c.id)).map((c) => c.id)
  return { closed, persistent, new: fresh }
}

function similarLocation(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((w) => w.length > 3),
    )
  const wordsA = words(a)
  const wordsB = words(b)
  if (wordsA.size === 0 || wordsB.size === 0) return false
  let overlap = 0
  for (const w of wordsA) if (wordsB.has(w)) overlap++
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.5
}

function toConsolidatedItems(
  projectId: string,
  roundId: string,
  resp: AggregateResponse,
): ConsolidatedItem[] {
  return resp.items.map((it) => ({
    id: crypto.randomUUID(),
    projectId,
    roundId,
    title: it.title,
    description: it.description,
    location: it.location,
    trade: it.trade,
    severity: it.severity,
    recommended_action: it.recommended_action,
    sourcePhotoIds: [...new Set(it.source_photos.map((sp) => sp.photo_id))],
  }))
}

function passthroughItems(projectId: string, roundId: string, photos: Photo[]): ConsolidatedItem[] {
  const items: ConsolidatedItem[] = []
  for (const photo of photos) {
    if (!photo.analysis) continue
    for (const item of photo.analysis.items) {
      items.push({
        id: crypto.randomUUID(),
        projectId,
        roundId,
        title: item.title,
        description: item.description,
        location: `${photo.label} — ${item.location_in_photo}`,
        trade: item.trade,
        severity: item.severity,
        recommended_action: item.recommended_action,
        sourcePhotoIds: [photo.id],
      })
    }
  }
  return items
}

async function runQueue<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  async function next(): Promise<void> {
    const i = index++
    if (i >= items.length) return
    await worker(items[i])
    await next()
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next))
}
