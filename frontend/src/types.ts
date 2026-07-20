export type Trade =
  | 'electrical'
  | 'plumbing'
  | 'drywall'
  | 'paint'
  | 'concrete'
  | 'carpentry'
  | 'safety'
  | 'general'

export type Severity = 'low' | 'medium' | 'high'

export interface PunchItem {
  id: number
  title: string
  description: string
  location_in_photo: string
  trade: Trade
  severity: Severity
  recommended_action: string
}

export interface PunchListResult {
  scene_summary: string
  items: PunchItem[]
}

export interface Sample {
  id: string
  label: string
  photo: string // public path
  credit: string
  creditUrl: string
  result: PunchListResult
}

// --- v2: projects, rounds, photos, consolidated items ---

export type PhotoStatus = 'pending' | 'analyzing' | 'done' | 'error'

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  seeded?: { demoVersion: number }
}

export interface RoundDiff {
  closed: string[] // ConsolidatedItem ids from the previous round
  persistent: { previousId: string; currentId: string; note?: string }[]
  new: string[] // ConsolidatedItem ids from the current round
}

export interface Round {
  id: string
  projectId: string
  index: number // 1-based
  name: string
  createdAt: number
  projectSummary?: string
  progressNotes?: string // qualitative progress-over-time note, from /aggregate
  diff?: RoundDiff
}

export interface TwinPosition {
  x: number
  y: number
  z: number
}

export interface Photo {
  id: string
  projectId: string
  roundId: string
  label: string
  // 'upload' today; 'drone' reserved so the capture layer can later be
  // swapped for periodic drone-flight stills through the same pipeline.
  source: 'upload' | 'drone'
  blob: Blob
  thumbBlob: Blob
  width: number
  height: number
  createdAt: number
  status: PhotoStatus
  error?: string
  analysis?: PunchListResult // raw per-photo /analyze result
  twin?: TwinPosition // marker position on the 3D digital-twin model
}

export interface ConsolidatedItem {
  id: string
  projectId: string
  roundId: string
  title: string
  description: string
  location: string
  trade: Trade
  severity: Severity
  recommended_action: string
  sourcePhotoIds: string[]
}
