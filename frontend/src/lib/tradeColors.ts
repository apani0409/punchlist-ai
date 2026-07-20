import type { Trade } from '../types'

// Fixed trade -> hue mapping so a given trade always renders the same color
// across charts (color follows the entity, never its rank/position). Hues
// are the validated 8-slot dark-mode categorical set (see dataviz skill /
// references/palette.md) — worst adjacent CVD ΔE 8.4, normal-vision floor
// 19.3, all >=3:1 against the app's card surface (#131c2e). "General" gets
// the red slot since it's the lowest-signal bucket, keeping red mostly clear
// of collision with the severity "high" color used elsewhere in the UI.
export const TRADE_COLORS: Record<Trade, string> = {
  electrical: '#3987e5',
  plumbing: '#199e70',
  drywall: '#d55181',
  paint: '#c98500',
  concrete: '#008300',
  carpentry: '#d95926',
  safety: '#9085e9',
  general: '#e66767',
}
