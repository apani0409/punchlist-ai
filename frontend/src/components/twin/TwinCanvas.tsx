import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Building from './Building'
import Markers from './Markers'
import PlacementController from './PlacementController'
import {
  BASEMENT_HEIGHT,
  BUILDING_HEIGHT,
  FOOTPRINT_SPAN_X,
  FOOTPRINT_SPAN_Z,
} from '../../lib/twinDimensions'
import type { ConsolidatedItem, Photo, TwinPosition } from '../../types'

const CAM_DISTANCE = Math.max(FOOTPRINT_SPAN_X, FOOTPRINT_SPAN_Z) * 1.4
const TARGET_Y = (BUILDING_HEIGHT - BASEMENT_HEIGHT) / 2

export default function TwinCanvas({
  photos,
  items,
  selectedPhotoId,
  onSelectPhoto,
  placing,
  onPlace,
}: {
  photos: Photo[]
  items: ConsolidatedItem[]
  selectedPhotoId: string | null
  onSelectPhoto: (photo: Photo) => void
  placing: boolean
  onPlace: (point: TwinPosition) => void
}) {
  return (
    <Canvas
      camera={{ position: [CAM_DISTANCE * 0.7, CAM_DISTANCE * 0.55, CAM_DISTANCE * 0.7], fov: 45 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#0b1120']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[15, 25, 10]} intensity={1.1} />
      <directionalLight position={[-15, 10, -10]} intensity={0.3} />

      <Building />
      <Markers photos={photos} items={items} selectedPhotoId={selectedPhotoId} onSelectPhoto={onSelectPhoto} />
      {placing && <PlacementController onPlace={onPlace} />}

      <OrbitControls
        makeDefault
        minDistance={6}
        maxDistance={CAM_DISTANCE * 2.2}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, TARGET_Y, 0]}
      />
    </Canvas>
  )
}
