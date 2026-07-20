import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { loadIfcModel } from '../../lib/ifc'
import { BUILDING_HEIGHT, FOOTPRINT_MAX_X, FOOTPRINT_MIN_X, FOOTPRINT_SPAN_Z } from '../../lib/twinDimensions'

// Scales + centers the loaded IFC model to roughly fill the same footprint
// as the procedural schematic building, so the twin's existing markers
// (placed against the schematic's coordinate system) land sensibly on it
// regardless of the source file's real-world proportions. This is a
// demonstration that markers are agnostic to the geometry source, not a
// survey-accurate registration — real BIM coordination would align the
// model's own site coordinates, not rescale it to fit.
function normalizeToFootprint(group: THREE.Group, box: THREE.Box3) {
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const targetSpanX = FOOTPRINT_MAX_X - FOOTPRINT_MIN_X
  const targetCenterX = (FOOTPRINT_MAX_X + FOOTPRINT_MIN_X) / 2

  const scaleX = size.x > 0.01 ? targetSpanX / size.x : 1
  const scaleZ = size.z > 0.01 ? FOOTPRINT_SPAN_Z / size.z : 1
  const scaleY = size.y > 0.01 ? BUILDING_HEIGHT / size.y : 1

  group.scale.set(scaleX, scaleY, scaleZ)
  group.position.set(targetCenterX - center.x * scaleX, -box.min.y * scaleY, -center.z * scaleZ)
}

export default function IfcModel({
  url,
  onLoaded,
  onError,
}: {
  url: string
  onLoaded?: (meshCount: number) => void
  onError?: (message: string) => void
}) {
  const [group, setGroup] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let cancelled = false
    setGroup(null)

    void (async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Could not fetch the model file (${res.status}).`)
        const buffer = await res.arrayBuffer()
        const { group: loadedGroup, boundingBox, meshCount } = await loadIfcModel(buffer)
        if (cancelled) return
        normalizeToFootprint(loadedGroup, boundingBox)
        setGroup(loadedGroup)
        onLoaded?.(meshCount)
      } catch (e) {
        if (!cancelled) onError?.(e instanceof Error ? e.message : 'Failed to load the IFC model.')
      }
    })()

    return () => {
      cancelled = true
    }
    // Intentionally re-runs only when `url` changes, not on every render of
    // the onLoaded/onError callbacks passed down from Twin.tsx.
  }, [url])

  if (!group) return null
  return <primitive object={group} />
}
