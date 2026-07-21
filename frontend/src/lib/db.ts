import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Annotation, ConsolidatedItem, Photo, Project, ProjectDocument, Round } from '../types'

interface PunchListDB extends DBSchema {
  projects: {
    key: string
    value: Project
  }
  rounds: {
    key: string
    value: Round
    indexes: { 'by-project': string }
  }
  photos: {
    key: string
    value: Photo
    indexes: { 'by-round': string; 'by-project': string }
  }
  items: {
    key: string
    value: ConsolidatedItem
    indexes: { 'by-round': string; 'by-project': string }
  }
  documents: {
    key: string
    value: ProjectDocument
    indexes: { 'by-project': string }
  }
  annotations: {
    key: string
    value: Annotation
    indexes: { 'by-round': string; 'by-project': string }
  }
}

let dbPromise: Promise<IDBPDatabase<PunchListDB>> | null = null

export function getDB(): Promise<IDBPDatabase<PunchListDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PunchListDB>('punchlist-ai', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('projects', { keyPath: 'id' })

          const rounds = db.createObjectStore('rounds', { keyPath: 'id' })
          rounds.createIndex('by-project', 'projectId')

          const photos = db.createObjectStore('photos', { keyPath: 'id' })
          photos.createIndex('by-round', 'roundId')
          photos.createIndex('by-project', 'projectId')

          const items = db.createObjectStore('items', { keyPath: 'id' })
          items.createIndex('by-round', 'roundId')
          items.createIndex('by-project', 'projectId')
        }
        if (oldVersion < 2) {
          const documents = db.createObjectStore('documents', { keyPath: 'id' })
          documents.createIndex('by-project', 'projectId')
        }
        if (oldVersion < 3) {
          const annotations = db.createObjectStore('annotations', { keyPath: 'id' })
          annotations.createIndex('by-round', 'roundId')
          annotations.createIndex('by-project', 'projectId')
        }
      },
      blocking() {
        // Another tab is opening a newer schema version; release this
        // connection so that tab's upgrade can proceed instead of hanging
        // indefinitely on "Loading…" behind this one.
        void dbPromise?.then((db) => db.close())
      },
    })
  }
  return dbPromise
}

// --- projects ---

export async function putProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['projects', 'rounds', 'photos', 'items', 'documents', 'annotations'],
    'readwrite',
  )
  await tx.objectStore('projects').delete(id)
  const rounds = await tx.objectStore('rounds').index('by-project').getAll(id)
  const photos = await tx.objectStore('photos').index('by-project').getAll(id)
  const items = await tx.objectStore('items').index('by-project').getAll(id)
  const documents = await tx.objectStore('documents').index('by-project').getAll(id)
  const annotations = await tx.objectStore('annotations').index('by-project').getAll(id)
  await Promise.all([
    ...rounds.map((r) => tx.objectStore('rounds').delete(r.id)),
    ...photos.map((p) => tx.objectStore('photos').delete(p.id)),
    ...items.map((i) => tx.objectStore('items').delete(i.id)),
    ...documents.map((d) => tx.objectStore('documents').delete(d.id)),
    ...annotations.map((a) => tx.objectStore('annotations').delete(a.id)),
  ])
  await tx.done
}

// --- rounds ---

export async function putRound(round: Round): Promise<void> {
  const db = await getDB()
  await db.put('rounds', round)
}

export async function getRound(id: string): Promise<Round | undefined> {
  const db = await getDB()
  return db.get('rounds', id)
}

export async function listRoundsByProject(projectId: string): Promise<Round[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('rounds', 'by-project', projectId)
  return all.sort((a, b) => a.index - b.index)
}

// --- photos ---

export async function putPhoto(photo: Photo): Promise<void> {
  const db = await getDB()
  await db.put('photos', photo)
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const db = await getDB()
  return db.get('photos', id)
}

export async function listPhotosByRound(roundId: string): Promise<Photo[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('photos', 'by-round', roundId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function listPhotosByProject(projectId: string): Promise<Photo[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('photos', 'by-project', projectId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

// --- consolidated items ---

export async function putItems(items: ConsolidatedItem[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('items', 'readwrite')
  await Promise.all(items.map((item) => tx.store.put(item)))
  await tx.done
}

export async function replaceItemsForRound(
  roundId: string,
  items: ConsolidatedItem[],
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('items', 'readwrite')
  const existing = await tx.store.index('by-round').getAll(roundId)
  await Promise.all(existing.map((i) => tx.store.delete(i.id)))
  await Promise.all(items.map((item) => tx.store.put(item)))
  await tx.done
}

export async function listItemsByRound(roundId: string): Promise<ConsolidatedItem[]> {
  const db = await getDB()
  return db.getAllFromIndex('items', 'by-round', roundId)
}

export async function listItemsByProject(projectId: string): Promise<ConsolidatedItem[]> {
  const db = await getDB()
  return db.getAllFromIndex('items', 'by-project', projectId)
}

// --- documents (RFI / change order / notice) ---

export async function putDocument(document: ProjectDocument): Promise<void> {
  const db = await getDB()
  await db.put('documents', document)
}

export async function listDocumentsByProject(projectId: string): Promise<ProjectDocument[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('documents', 'by-project', projectId)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

// --- annotations (free-standing twin markers, not tied to a photo) ---

export async function putAnnotation(annotation: Annotation): Promise<void> {
  const db = await getDB()
  await db.put('annotations', annotation)
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('annotations', id)
}

export async function listAnnotationsByRound(roundId: string): Promise<Annotation[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('annotations', 'by-round', roundId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}
