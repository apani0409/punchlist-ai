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
