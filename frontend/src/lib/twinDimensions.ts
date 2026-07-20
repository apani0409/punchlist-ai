// Shared building dimension constants for the digital-twin viewer. Kept
// dependency-free (no three.js/@react-three/*) so seed data can reference
// them without pulling the 3D viewer (and its ~150KB gz chunk) into the
// main bundle — only components/twin/* import three.js directly, and that
// tree is loaded via React.lazy from routes/Twin.tsx.
export const BUILDING_WIDTH = 20 // meters, X axis
export const BUILDING_DEPTH = 14 // meters, Z axis
export const FLOOR_HEIGHT = 3.2
export const FLOOR_COUNT = 3 // ground + 2 upper levels
export const BASEMENT_HEIGHT = 2.8
export const BUILDING_HEIGHT = FLOOR_HEIGHT * FLOOR_COUNT
export const GRID_SPACING = 4 // column grid spacing, meters
