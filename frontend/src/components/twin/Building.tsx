import { Edges, Grid } from '@react-three/drei'
import {
  BASEMENT_HEIGHT,
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  GRID_SPACING,
} from '../../lib/twinDimensions'

const COLUMN_RADIUS = 0.15
const TOTAL_HEIGHT = BASEMENT_HEIGHT + BUILDING_HEIGHT

function columnPositions(): [number, number][] {
  const positions: [number, number][] = []
  const halfW = BUILDING_WIDTH / 2
  const halfD = BUILDING_DEPTH / 2
  for (let x = -halfW; x <= halfW + 0.01; x += GRID_SPACING) {
    for (let z = -halfD; z <= halfD + 0.01; z += GRID_SPACING) {
      positions.push([x, z])
    }
  }
  return positions
}

const COLUMNS = columnPositions()

// A schematic, procedurally-generated building massing model — not a
// survey-accurate BIM. Avoids licensing/attribution concerns of a
// downloaded GLTF and loads instantly. Floor shells are translucent so
// markers inside remain visible from any angle.
export default function Building() {
  return (
    <group>
      <Grid
        position={[0, -BASEMENT_HEIGHT - 0.01, 0]}
        args={[BUILDING_WIDTH * 2.5, BUILDING_DEPTH * 2.5]}
        cellColor="#24304a"
        sectionColor="#3a4a6b"
        fadeDistance={45}
        infiniteGrid
      />

      {/* Basement volume */}
      <mesh position={[0, -BASEMENT_HEIGHT / 2, 0]}>
        <boxGeometry args={[BUILDING_WIDTH, BASEMENT_HEIGHT, BUILDING_DEPTH]} />
        <meshStandardMaterial color="#182238" transparent opacity={0.35} />
        <Edges color="#3a4a6b" />
      </mesh>

      {/* Above-grade shell, one translucent volume per floor */}
      {Array.from({ length: FLOOR_COUNT }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_HEIGHT + FLOOR_HEIGHT / 2, 0]}>
          <boxGeometry args={[BUILDING_WIDTH, FLOOR_HEIGHT, BUILDING_DEPTH]} />
          <meshStandardMaterial color="#f97316" transparent opacity={0.05} depthWrite={false} />
          <Edges color="#f97316" />
        </mesh>
      ))}

      {/* Floor slabs */}
      {Array.from({ length: FLOOR_COUNT + 1 }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_HEIGHT, 0]}>
          <boxGeometry args={[BUILDING_WIDTH, 0.15, BUILDING_DEPTH]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}

      {/* Structural column grid, basement through roof */}
      {COLUMNS.map(([x, z], i) => (
        <mesh key={i} position={[x, TOTAL_HEIGHT / 2 - BASEMENT_HEIGHT, z]}>
          <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS, TOTAL_HEIGHT, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  )
}
