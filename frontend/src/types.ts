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

// A free-standing marker on the digital twin — not tied to any photo.
// Placed directly by clicking the model (3D) or the plan (2D); the two
// views share the same world coordinates so a point placed in either one
// lands in the same spot in the other.
export interface Annotation {
  id: string
  projectId: string
  roundId: string
  label: string
  note?: string
  trade: Trade
  severity: Severity
  position: TwinPosition
  createdAt: number
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
  // Hand-linked in the demo project only (never auto-generated for live
  // items — that would mean classifying a finding against a code without
  // being asked to, which risks a wrong citation reading as authoritative).
  codeRefs?: { section: string; title: string }[]
}

// --- v2 Day 4: document intelligence (RFI / change order / notice) ---

export type DocumentType = 'rfi' | 'change_order' | 'notice'
export type DocumentPriority = 'low' | 'medium' | 'high'
export type DocumentStatus = 'draft' | 'reviewed'
export type NoticeType = 'delay' | 'change' | 'defect' | 'other' | ''

// Mirrors backend/main.py's DOCUMENT_TOOL exactly: one flat shape, fields
// belonging to the other two types left as '' / null rather than omitted.
export interface ExtractedDocument {
  type: DocumentType
  priority: DocumentPriority
  summary: string
  subject: string
  rfi_question: string
  rfi_discipline: Trade | ''
  rfi_reference: string
  co_description: string
  co_trade: Trade | ''
  co_cost_amount: number | null
  co_cost_currency: string
  co_schedule_impact_days: number | null
  co_initiated_by: string
  notice_type: NoticeType
  notice_body_draft: string
}

export interface ProjectDocument {
  id: string
  projectId: string
  status: DocumentStatus
  createdAt: number
  sourceText: string
  extracted: ExtractedDocument
}
