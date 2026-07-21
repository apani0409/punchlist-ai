// Shared building dimension constants for the digital-twin viewer. Kept
// dependency-free (no three.js/@react-three/*) so seed data can reference
// them without pulling the 3D viewer (and its ~150KB gz chunk) into the
// main bundle — only components/twin/* import three.js directly, and that
// tree is loaded via React.lazy from routes/Twin.tsx.
export const BUILDING_WIDTH = 20 // main block, meters, X axis
export const BUILDING_DEPTH = 14 // main block, meters, Z axis
export const FLOOR_HEIGHT = 3.2
export const FLOOR_COUNT = 4 // ground + 3 upper levels
export const BASEMENT_HEIGHT = 2.8
export const BUILDING_HEIGHT = FLOOR_HEIGHT * FLOOR_COUNT
export const GRID_SPACING = 4 // column grid spacing, meters

// A lower wing attached to the main block's east side (e.g. a mechanical/
// utility annex) — an L-shaped footprint instead of a single plain box.
// No basement under the wing (a plausible later addition to the main
// structure).
export const WING_WIDTH = 10
export const WING_DEPTH = 10
export const WING_FLOORS = 2
export const WING_CENTER_X = BUILDING_WIDTH / 2 + WING_WIDTH / 2
export const WING_CENTER_Z = -BUILDING_DEPTH / 2 + WING_DEPTH / 2

// Combined bounding box (main block + wing), for camera framing and the
// twin's click-to-place raycasting target.
export const FOOTPRINT_MIN_X = -BUILDING_WIDTH / 2
export const FOOTPRINT_MAX_X = BUILDING_WIDTH / 2 + WING_WIDTH
export const FOOTPRINT_CENTER_X = (FOOTPRINT_MIN_X + FOOTPRINT_MAX_X) / 2
export const FOOTPRINT_SPAN_X = FOOTPRINT_MAX_X - FOOTPRINT_MIN_X
export const FOOTPRINT_SPAN_Z = BUILDING_DEPTH // wing's Z range sits inside the main block's
export const FOOTPRINT_MIN_Z = -FOOTPRINT_SPAN_Z / 2
export const FOOTPRINT_MAX_Z = FOOTPRINT_SPAN_Z / 2

// Column grid, shared by the 3D building massing (Building.tsx) and the 2D
// plan view (TwinPlan2D.tsx) — kept here, not in either renderer, so the 2D
// view never has to import three.js just to draw the same grid.
export function columnPositions(
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
): [number, number][] {
  const positions: [number, number][] = []
  const halfW = width / 2
  const halfD = depth / 2
  for (let x = centerX - halfW; x <= centerX + halfW + 0.01; x += GRID_SPACING) {
    for (let z = centerZ - halfD; z <= centerZ + halfD + 0.01; z += GRID_SPACING) {
      positions.push([x, z])
    }
  }
  return positions
}

export const MAIN_COLUMNS = columnPositions(0, 0, BUILDING_WIDTH, BUILDING_DEPTH)
export const WING_COLUMNS = columnPositions(WING_CENTER_X, WING_CENTER_Z, WING_WIDTH, WING_DEPTH)
