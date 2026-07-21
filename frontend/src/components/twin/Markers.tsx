import { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import type { Annotation, ConsolidatedItem, Photo, Severity } from '../../types'

const SEVERITY_COLOR: Record<Severity, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#4ade80',
}
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export default function Markers({
  photos,
  items,
  annotations,
  selectedPhotoId,
  onSelectPhoto,
  selectedAnnotationId,
  onSelectAnnotation,
}: {
  photos: Photo[]
  items: ConsolidatedItem[]
  annotations: Annotation[]
  selectedPhotoId: string | null
  onSelectPhoto: (photo: Photo) => void
  selectedAnnotationId: string | null
  onSelectAnnotation: (annotation: Annotation) => void
}) {
  // Photos sharing (near-)identical coordinates get a small vertical
  // stacking offset so their markers don't perfectly overlap.
  const placed = useMemo(() => {
    const seen = new Map<string, number>()
    return photos
      .filter((p): p is Photo & { twin: NonNullable<Photo['twin']> } => !!p.twin)
      .map((photo) => {
        const key = `${photo.twin.x.toFixed(1)}_${photo.twin.y.toFixed(1)}_${photo.twin.z.toFixed(1)}`
        const offsetIndex = seen.get(key) ?? 0
        seen.set(key, offsetIndex + 1)
        const worst = worstSeverity(items.filter((it) => it.sourcePhotoIds.includes(photo.id)))
        return { photo, worst, offsetIndex }
      })
  }, [photos, items])

  return (
    <group>
      {placed.map(({ photo, worst, offsetIndex }) => (
        <Marker
          key={photo.id}
          photo={photo}
          severity={worst}
          offsetIndex={offsetIndex}
          selected={photo.id === selectedPhotoId}
          onSelect={() => onSelectPhoto(photo)}
        />
      ))}
      {annotations.map((annotation) => (
        <AnnotationMarker
          key={annotation.id}
          annotation={annotation}
          selected={annotation.id === selectedAnnotationId}
          onSelect={() => onSelectAnnotation(annotation)}
        />
      ))}
    </group>
  )
}

function worstSeverity(items: ConsolidatedItem[]): Severity {
  if (items.length === 0) return 'low'
  return items.reduce<Severity>(
    (worst, it) => (SEVERITY_ORDER[it.severity] < SEVERITY_ORDER[worst] ? it.severity : worst),
    'low',
  )
}

function Marker({
  photo,
  severity,
  offsetIndex,
  selected,
  onSelect,
}: {
  photo: Photo & { twin: NonNullable<Photo['twin']> }
  severity: Severity
  offsetIndex: number
  selected: boolean
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const y = photo.twin.y + offsetIndex * 0.45

  return (
    <group position={[photo.twin.x, y, photo.twin.z]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        scale={selected || hovered ? 1.35 : 1}
        renderOrder={10}
      >
        <sphereGeometry args={[0.35, 16, 16]} />
        {/* depthTest off so markers always read on top of the translucent
            building shell / floor slabs — like a map pin, not physically
            occluded geometry, so every finding stays locatable regardless
            of camera angle (e.g. below-grade or behind a floor slab). */}
        <meshStandardMaterial
          color={SEVERITY_COLOR[severity]}
          emissive={SEVERITY_COLOR[severity]}
          emissiveIntensity={selected ? 0.9 : 0.35}
          depthTest={false}
          transparent
        />
      </mesh>
      {hovered && !selected && (
        <Html distanceFactor={12} style={{ pointerEvents: 'none' }} center>
          <div className="twin-tooltip">{photo.label}</div>
        </Html>
      )}
    </group>
  )
}

// Free-standing annotations render as an octahedron (diamond) rather than a
// sphere — a deliberate shape difference from photo markers so the two
// marker types stay visually distinguishable at a glance, not just by color.
function AnnotationMarker({
  annotation,
  selected,
  onSelect,
}: {
  annotation: Annotation
  selected: boolean
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { x, y, z } = annotation.position

  return (
    <group position={[x, y + 0.4, z]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        rotation={[0, Math.PI / 4, 0]}
        scale={selected || hovered ? 1.35 : 1}
        renderOrder={10}
      >
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color={SEVERITY_COLOR[annotation.severity]}
          emissive={SEVERITY_COLOR[annotation.severity]}
          emissiveIntensity={selected ? 0.9 : 0.35}
          depthTest={false}
          transparent
        />
      </mesh>
      {(hovered || selected) && (
        <Html distanceFactor={12} style={{ pointerEvents: 'none' }} center>
          <div className="twin-tooltip">{annotation.label}</div>
        </Html>
      )}
    </group>
  )
}
