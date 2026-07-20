import { DEMO_DATA, DEMO_PROJECT_ID } from '../data/demoProject'
import { processPhoto } from './images'
import { getDB, putPhoto, putProject, putRound, replaceItemsForRound } from './db'
import type { ConsolidatedItem, Photo, Project, Round } from '../types'

// Bump when DEMO_DATA changes shape/content so returning users get the
// refreshed seed instead of a stale one from an earlier version.
const DEMO_VERSION = 1

export async function ensureDemoProject(): Promise<void> {
  const db = await getDB()
  const existing = await db.get('projects', DEMO_PROJECT_ID)
  if (existing?.seeded?.demoVersion === DEMO_VERSION) return

  if (existing) await clearProjectData(DEMO_PROJECT_ID)

  const now = Date.now()
  const project: Project = {
    id: DEMO_PROJECT_ID,
    name: DEMO_DATA.projectName,
    createdAt: now,
    updatedAt: now,
    seeded: { demoVersion: DEMO_VERSION },
  }
  await putProject(project)

  for (const roundData of DEMO_DATA.rounds) {
    const round: Round = {
      id: roundData.id,
      projectId: DEMO_PROJECT_ID,
      index: roundData.index,
      name: roundData.name,
      createdAt: now,
      projectSummary: roundData.projectSummary,
      progressNotes: roundData.progressNotes,
      diff: roundData.diff,
    }
    await putRound(round)

    for (const p of roundData.photos) {
      const sourceBlob = await fetch(p.photoPath).then((r) => r.blob())
      const { blob, thumbBlob, width, height } = await processPhoto(sourceBlob)
      const photo: Photo = {
        id: p.id,
        projectId: DEMO_PROJECT_ID,
        roundId: round.id,
        label: p.label,
        source: 'upload',
        blob,
        thumbBlob,
        width,
        height,
        createdAt: now,
        status: 'done',
        analysis: p.analysis,
      }
      await putPhoto(photo)
    }

    const items: ConsolidatedItem[] = roundData.items.map((it) => ({
      ...it,
      projectId: DEMO_PROJECT_ID,
      roundId: round.id,
    }))
    await replaceItemsForRound(round.id, items)
  }
}

async function clearProjectData(projectId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['rounds', 'photos', 'items'], 'readwrite')
  const rounds = await tx.objectStore('rounds').index('by-project').getAll(projectId)
  const photos = await tx.objectStore('photos').index('by-project').getAll(projectId)
  const items = await tx.objectStore('items').index('by-project').getAll(projectId)
  await Promise.all([
    ...rounds.map((r) => tx.objectStore('rounds').delete(r.id)),
    ...photos.map((p) => tx.objectStore('photos').delete(p.id)),
    ...items.map((i) => tx.objectStore('items').delete(i.id)),
  ])
  await tx.done
}
