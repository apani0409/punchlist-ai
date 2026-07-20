import { useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { BASEMENT_HEIGHT, BUILDING_DEPTH, BUILDING_HEIGHT, BUILDING_WIDTH } from '../../lib/twinDimensions'
import type { TwinPosition } from '../../types'

const PADDING = 0.6
const TOTAL_HEIGHT = BASEMENT_HEIGHT + BUILDING_HEIGHT

// An invisible box slightly larger than the building envelope, used purely
// as a raycasting target so a click anywhere near the model resolves to a
// 3D point. Shows a ghost marker on hover so the user sees where their
// click will land before committing.
export default function PlacementController({ onPlace }: { onPlace: (point: TwinPosition) => void }) {
  const [ghost, setGhost] = useState<TwinPosition | null>(null)

  function handleMove(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    setGhost({ x: e.point.x, y: e.point.y, z: e.point.z })
  }

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    onPlace({ x: e.point.x, y: e.point.y, z: e.point.z })
  }

  return (
    <group>
      <mesh
        position={[0, TOTAL_HEIGHT / 2 - BASEMENT_HEIGHT, 0]}
        onPointerMove={handleMove}
        onPointerOut={() => setGhost(null)}
        onClick={handleClick}
      >
        <boxGeometry args={[BUILDING_WIDTH + PADDING, TOTAL_HEIGHT + PADDING, BUILDING_DEPTH + PADDING]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {ghost && (
        <mesh position={[ghost.x, ghost.y, ghost.z]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
}
