import { SAMPLES } from './samples'
import type { PunchListResult, RoundDiff, Severity, Trade } from '../types'

export const DEMO_PROJECT_ID = 'demo'

export interface DemoPhoto {
  id: string
  label: string
  photoPath: string
  analysis: PunchListResult
}

export interface DemoItem {
  id: string
  title: string
  description: string
  location: string
  trade: Trade
  severity: Severity
  recommended_action: string
  sourcePhotoIds: string[]
}

export interface DemoRound {
  id: string
  index: number
  name: string
  projectSummary: string
  progressNotes: string
  photos: DemoPhoto[]
  items: DemoItem[]
  diff?: RoundDiff
}

const [crackedWall, basementWiring, waterDamageCeiling] = SAMPLES

// Round 1 reuses the three hand-reviewed sample photos/analyses so the demo
// needs zero API calls. The three scenes don't share a physical location, so
// consolidation here is a straight 1:1 pass-through with project-level
// locations — an honest reflection of what /aggregate would return for a
// set of unrelated areas (no invented merges).
const round1: DemoRound = {
  id: 'demo-r1',
  index: 1,
  name: 'Initial inspection',
  projectSummary:
    'Three areas inspected: an exterior retaining wall, a basement utility room mid rough-in, ' +
    'and an interior ceiling with active water damage. Each area has at least one high-severity ' +
    'issue requiring attention before work can proceed to the next stage.',
  progressNotes:
    'Site shows mixed progress across areas: exterior hardscape and retaining walls are built but ' +
    'show structural distress, basement electrical/plumbing rough-in is underway with wiring still ' +
    'unsecured, and at least one occupied-space ceiling needs remediation before finishes can start. ' +
    'No single trade is blocking the others yet, but the ceiling leak should be traced before it does.',
  photos: [
    { id: 'demo-cracked-wall', label: crackedWall.label, photoPath: crackedWall.photo, analysis: crackedWall.result },
    {
      id: 'demo-basement-wiring',
      label: basementWiring.label,
      photoPath: basementWiring.photo,
      analysis: basementWiring.result,
    },
    {
      id: 'demo-water-damage-ceiling',
      label: waterDamageCeiling.label,
      photoPath: waterDamageCeiling.photo,
      analysis: waterDamageCeiling.result,
    },
  ],
  items: [
    ...crackedWall.result.items.map((it) => toDemoItem('demo-r1', 'demo-cracked-wall', crackedWall.label, it)),
    ...basementWiring.result.items.map((it) =>
      toDemoItem('demo-r1', 'demo-basement-wiring', basementWiring.label, it),
    ),
    ...waterDamageCeiling.result.items.map((it) =>
      toDemoItem('demo-r1', 'demo-water-damage-ceiling', waterDamageCeiling.label, it),
    ),
  ],
}

function toDemoItem(
  roundId: string,
  photoId: string,
  photoLabel: string,
  item: PunchListResult['items'][number],
): DemoItem {
  return {
    id: `${roundId}-${photoId}-${item.id}`,
    title: item.title,
    description: item.description,
    location: `${photoLabel} — ${item.location_in_photo}`,
    trade: item.trade,
    severity: item.severity,
    recommended_action: item.recommended_action,
    sourcePhotoIds: [photoId],
  }
}

export const DEMO_DATA = {
  projectName: 'Riverside Build — Demo Project',
  rounds: [round1],
}
