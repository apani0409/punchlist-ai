import { Edges, Grid } from '@react-three/drei'
import {
  BASEMENT_HEIGHT,
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  FOOTPRINT_CENTER_X,
  FOOTPRINT_SPAN_X,
  FOOTPRINT_SPAN_Z,
  MAIN_COLUMNS,
  WING_CENTER_X,
  WING_CENTER_Z,
  WING_COLUMNS,
  WING_DEPTH,
  WING_FLOORS,
  WING_WIDTH,
} from '../../lib/twinDimensions'

const COLUMN_RADIUS = 0.15
const TOTAL_HEIGHT = BASEMENT_HEIGHT + BUILDING_HEIGHT
const WING_HEIGHT = FLOOR_HEIGHT * WING_FLOORS

// A schematic, procedurally-generated building massing model — not a
// survey-accurate BIM. Avoids licensing/attribution concerns of a
// downloaded GLTF and loads instantly. Floor shells are translucent so
// markers inside remain visible from any angle. An L-shaped footprint
// (main block + a lower wing) reads as more building-like than a single box.
export default function Building() {
  return (
    <group>
      <Grid
        position={[FOOTPRINT_CENTER_X, -BASEMENT_HEIGHT - 0.01, 0]}
        args={[FOOTPRINT_SPAN_X * 2, FOOTPRINT_SPAN_Z * 2.5]}
        cellColor="#24304a"
        sectionColor="#3a4a6b"
        fadeDistance={50}
        infiniteGrid
      />

      {/* Basement volume, under the main block only */}
      <mesh position={[0, -BASEMENT_HEIGHT / 2, 0]}>
        <boxGeometry args={[BUILDING_WIDTH, BASEMENT_HEIGHT, BUILDING_DEPTH]} />
        <meshStandardMaterial color="#182238" transparent opacity={0.35} />
        <Edges color="#3a4a6b" />
      </mesh>

      {/* Main block: translucent shell + slab per floor */}
      {Array.from({ length: FLOOR_COUNT }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_HEIGHT + FLOOR_HEIGHT / 2, 0]}>
          <boxGeometry args={[BUILDING_WIDTH, FLOOR_HEIGHT, BUILDING_DEPTH]} />
          <meshStandardMaterial color="#f97316" transparent opacity={0.05} depthWrite={false} />
          <Edges color="#f97316" />
        </mesh>
      ))}
      {Array.from({ length: FLOOR_COUNT + 1 }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_HEIGHT, 0]}>
          <boxGeometry args={[BUILDING_WIDTH, 0.15, BUILDING_DEPTH]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}
      {MAIN_COLUMNS.map(([x, z], i) => (
        <mesh key={i} position={[x, TOTAL_HEIGHT / 2 - BASEMENT_HEIGHT, z]}>
          <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS, TOTAL_HEIGHT, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}

      {/* Wing: same treatment, shorter, no basement below it */}
      {Array.from({ length: WING_FLOORS }).map((_, i) => (
        <mesh key={i} position={[WING_CENTER_X, i * FLOOR_HEIGHT + FLOOR_HEIGHT / 2, WING_CENTER_Z]}>
          <boxGeometry args={[WING_WIDTH, FLOOR_HEIGHT, WING_DEPTH]} />
          <meshStandardMaterial color="#f97316" transparent opacity={0.05} depthWrite={false} />
          <Edges color="#f97316" />
        </mesh>
      ))}
      {Array.from({ length: WING_FLOORS + 1 }).map((_, i) => (
        <mesh key={i} position={[WING_CENTER_X, i * FLOOR_HEIGHT, WING_CENTER_Z]}>
          <boxGeometry args={[WING_WIDTH, 0.15, WING_DEPTH]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}
      {WING_COLUMNS.map(([x, z], i) => (
        <mesh key={`wing-${i}`} position={[x, WING_HEIGHT / 2, z]}>
          <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS, WING_HEIGHT, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  )
}
