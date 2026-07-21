import { useMemo, useState } from 'react'
import {
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  FLOOR_LABELS,
  FOOTPRINT_MAX_X,
  FOOTPRINT_MAX_Z,
  FOOTPRINT_MIN_X,
  FOOTPRINT_MIN_Z,
  MAIN_COLUMNS,
  WING_CENTER_X,
  WING_CENTER_Z,
  WING_COLUMNS,
  WING_DEPTH,
  WING_WIDTH,
  floorCenterY,
  floorIndexOf,
} from '../../lib/twinDimensions'
import type { Annotation, ConsolidatedItem, Photo, Severity, TwinPosition } from '../../types'

// Deliberately not shared with Markers.tsx — that file pulls in
// @react-three/drei's <Html>, and this plan view's whole point is to stay
// three.js-free so it never touches the twin's lazy 3D chunk.
const SEVERITY_COLOR: Record<Severity, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#4ade80',
}
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

function worstSeverity(items: ConsolidatedItem[]): Severity {
  if (items.length === 0) return 'low'
  return items.reduce<Severity>(
    (worst, it) => (SEVERITY_ORDER[it.severity] < SEVERITY_ORDER[worst] ? it.severity : worst),
    'low',
  )
}

// World-meter padding around the building footprint so markers placed near
// the edge (the 3D raycast target has its own small padding too) aren't
// clipped by the plan's viewBox.
const MARGIN = 4
const WORLD_X_MIN = FOOTPRINT_MIN_X - MARGIN
const WORLD_X_MAX = FOOTPRINT_MAX_X + MARGIN
const WORLD_Z_MIN = FOOTPRINT_MIN_Z - MARGIN
const WORLD_Z_MAX = FOOTPRINT_MAX_Z + MARGIN
const VIEW_WIDTH = WORLD_X_MAX - WORLD_X_MIN
const VIEW_HEIGHT = WORLD_Z_MAX - WORLD_Z_MIN

// The single source of truth for world (x,z) <-> plan-SVG coordinates,
// used by both rendering and click-to-place — so a point dropped here lands
// at the exact same spot the 3D raycast would put it, and vice versa.
function worldToPlan(x: number, z: number): [number, number] {
  return [x - WORLD_X_MIN, z - WORLD_Z_MIN]
}
function planToWorld(px: number, pz: number): [number, number] {
  return [px + WORLD_X_MIN, pz + WORLD_Z_MIN]
}

export default function TwinPlan2D({
  photos,
  items,
  annotations,
  selectedPhotoId,
  onSelectPhoto,
  selectedAnnotationId,
  onSelectAnnotation,
  placing,
  onPlace,
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
}) {
  const [ghost, setGhost] = useState<[number, number] | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all')

  const placedPhotos = useMemo(
    () =>
      photos
        .filter((p): p is Photo & { twin: NonNullable<Photo['twin']> } => !!p.twin)
        .filter((p) => selectedFloor === 'all' || floorIndexOf(p.twin.y) === selectedFloor)
        .map((photo) => ({
          photo,
          worst: worstSeverity(items.filter((it) => it.sourcePhotoIds.includes(photo.id))),
        })),
    [photos, items, selectedFloor],
  )
  const visibleAnnotations = useMemo(
    () => annotations.filter((a) => selectedFloor === 'all' || floorIndexOf(a.position.y) === selectedFloor),
    [annotations, selectedFloor],
  )

  function screenToWorld(e: React.MouseEvent<SVGSVGElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const pz = ((e.clientY - rect.top) / rect.height) * VIEW_HEIGHT
    return planToWorld(px, pz)
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!placing) return
    setGhost(screenToWorld(e))
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!placing) return
    const [x, z] = screenToWorld(e)
    const y = selectedFloor === 'all' ? 0 : floorCenterY(selectedFloor)
    onPlace({ x, y, z })
  }

  const [mainX, mainY] = worldToPlan(-BUILDING_WIDTH / 2, -BUILDING_DEPTH / 2)
  const [wingX, wingY] = worldToPlan(WING_CENTER_X - WING_WIDTH / 2, WING_CENTER_Z - WING_DEPTH / 2)
  const ghostPlan = ghost ? worldToPlan(ghost[0], ghost[1]) : null

  return (
    <div className="twin-plan-wrap">
      <div className="twin-plan-floor-row">
        <button
          className={`twin-plan-floor-btn ${selectedFloor === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFloor('all')}
        >
          All
        </button>
        {FLOOR_LABELS.map((label, i) => (
          <button
            key={label}
            className={`twin-plan-floor-btn ${selectedFloor === i ? 'active' : ''}`}
            onClick={() => setSelectedFloor(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className={`twin-plan-svg ${placing ? 'twin-plan-placing' : ''}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setGhost(null)}
        onClick={handleClick}
      >
      <defs>
        <pattern id="twin-plan-grid" width={4} height={4} patternUnits="userSpaceOnUse">
          <path d="M 4 0 L 0 0 0 4" className="twin-plan-grid-line" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#twin-plan-grid)" />

      <rect x={mainX} y={mainY} width={BUILDING_WIDTH} height={BUILDING_DEPTH} className="twin-plan-footprint" />
      <rect x={wingX} y={wingY} width={WING_WIDTH} height={WING_DEPTH} className="twin-plan-footprint" />

      {[...MAIN_COLUMNS, ...WING_COLUMNS].map(([x, z], i) => {
        const [px, pz] = worldToPlan(x, z)
        return <circle key={i} cx={px} cy={pz} r={0.1} className="twin-plan-column" />
      })}

      {placedPhotos.map(({ photo, worst }) => {
        const [px, pz] = worldToPlan(photo.twin.x, photo.twin.z)
        const selected = photo.id === selectedPhotoId
        return (
          <circle
            key={photo.id}
            cx={px}
            cy={pz}
            r={selected ? 0.95 : 0.7}
            fill={SEVERITY_COLOR[worst]}
            stroke={selected ? '#fff' : 'none'}
            strokeWidth={0.14}
            className="twin-plan-marker"
            onClick={(e) => {
              e.stopPropagation()
              onSelectPhoto(photo)
            }}
          >
            <title>{photo.label}</title>
          </circle>
        )
      })}

      {visibleAnnotations.map((a) => {
        const [px, pz] = worldToPlan(a.position.x, a.position.z)
        const selected = a.id === selectedAnnotationId
        const size = selected ? 1.1 : 0.85
        return (
          <rect
            key={a.id}
            x={px - size / 2}
            y={pz - size / 2}
            width={size}
            height={size}
            fill={SEVERITY_COLOR[a.severity]}
            stroke={selected ? '#fff' : 'none'}
            strokeWidth={0.14}
            transform={`rotate(45 ${px} ${pz})`}
            className="twin-plan-marker"
            onClick={(e) => {
              e.stopPropagation()
              onSelectAnnotation(a)
            }}
          >
            <title>{a.label}</title>
          </rect>
        )
      })}

      {placing && ghostPlan && (
        <circle cx={ghostPlan[0]} cy={ghostPlan[1]} r={0.6} className="twin-plan-ghost" />
      )}
      </svg>
    </div>
  )
}
