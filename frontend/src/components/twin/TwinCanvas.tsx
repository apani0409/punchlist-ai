import { lazy, Suspense } from 'react'
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
import type { Annotation, ConsolidatedItem, Photo, TwinPosition } from '../../types'

// web-ifc (~1MB+ of WASM-loading JS glue) is only fetched when a user
// actually switches to the BIM geometry source — a second lazy boundary
// inside the twin's own already-lazy chunk, not paid just for opening Twin.
const IfcModel = lazy(() => import('./IfcModel'))

const CAM_DISTANCE = Math.max(FOOTPRINT_SPAN_X, FOOTPRINT_SPAN_Z) * 1.4
const TARGET_Y = (BUILDING_HEIGHT - BASEMENT_HEIGHT) / 2

export default function TwinCanvas({
  photos,
  items,
  annotations,
  selectedPhotoId,
  onSelectPhoto,
  selectedAnnotationId,
  onSelectAnnotation,
  placing,
  onPlace,
  ifcUrl,
  onIfcLoaded,
  onIfcError,
}: {
  photos: Photo[]
  items: ConsolidatedItem[]
  annotations: Annotation[]
  selectedPhotoId: string | null
  onSelectPhoto: (photo: Photo) => void
  selectedAnnotationId: string | null
  onSelectAnnotation: (annotation: Annotation) => void
  placing: boolean
  onPlace: (point: TwinPosition) => void
  ifcUrl: string | null
  onIfcLoaded?: (meshCount: number) => void
  onIfcError?: (message: string) => void
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

      {ifcUrl ? (
        <Suspense fallback={null}>
          <IfcModel url={ifcUrl} onLoaded={onIfcLoaded} onError={onIfcError} />
        </Suspense>
      ) : (
        <Building />
      )}
      <Markers
        photos={photos}
        items={items}
        annotations={annotations}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={onSelectPhoto}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
      />
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
