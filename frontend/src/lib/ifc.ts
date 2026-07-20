import * as THREE from 'three'
import { IfcAPI, type PlacedGeometry, type FlatMesh } from 'web-ifc'

// A thin loader around web-ifc's raw API (not web-ifc-three, which is
// deprecated and pinned to an old three.js) — we build THREE.BufferGeometry
// ourselves from web-ifc's vertex/index arrays. Conversion logic mirrors the
// official example at engine_web-ifc/examples/viewer/web-ifc-three.ts:
// vertex data is interleaved [x,y,z,nx,ny,nz] per vertex (stride 6).
let apiPromise: Promise<IfcAPI> | null = null

function getApi(): Promise<IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new IfcAPI()
      // Single-threaded build (web-ifc.wasm, not -mt) — avoids requiring
      // SharedArrayBuffer / COOP-COEP response headers, which Vercel's
      // static hosting doesn't set by default.
      api.SetWasmPath('/', true)
      await api.Init(undefined, true)
      return api
    })()
  }
  return apiPromise
}

export interface LoadedIfcModel {
  group: THREE.Group
  boundingBox: THREE.Box3
  meshCount: number
}

export async function loadIfcModel(data: ArrayBuffer): Promise<LoadedIfcModel> {
  const api = await getApi()
  const modelID = api.OpenModel(new Uint8Array(data), { COORDINATE_TO_ORIGIN: true })
  if (modelID < 0) {
    throw new Error('Failed to parse IFC file — the model may be corrupt or use an unsupported schema.')
  }

  const group = new THREE.Group()
  const materials = new Map<string, THREE.Material>()
  let meshCount = 0

  try {
    api.StreamAllMeshes(modelID, (mesh: FlatMesh) => {
      const placedGeometries = mesh.geometries
      for (let i = 0; i < placedGeometries.size(); i++) {
        const placed = placedGeometries.get(i)
        const bufferGeometry = buildBufferGeometry(api, modelID, placed)
        const material = getMaterial(materials, placed)
        group.add(new THREE.Mesh(bufferGeometry, material))
        meshCount++
      }
    })
  } finally {
    api.CloseModel(modelID)
  }

  if (meshCount === 0) {
    throw new Error('This IFC file has no visible geometry to display.')
  }

  const boundingBox = new THREE.Box3().setFromObject(group)
  return { group, boundingBox, meshCount }
}

function buildBufferGeometry(api: IfcAPI, modelID: number, placed: PlacedGeometry): THREE.BufferGeometry {
  const geometry = api.GetGeometry(modelID, placed.geometryExpressID)
  const vertexData = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize())
  const indexData = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize())

  const vertexCount = vertexData.length / 6
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexData.length; i += 6) {
    const o = (i / 2) | 0
    positions[o] = vertexData[i]
    positions[o + 1] = vertexData[i + 1]
    positions[o + 2] = vertexData[i + 2]
    normals[o] = vertexData[i + 3]
    normals[o + 1] = vertexData[i + 4]
    normals[o + 2] = vertexData[i + 5]
  }

  const bufferGeometry = new THREE.BufferGeometry()
  bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  bufferGeometry.setIndex(new THREE.BufferAttribute(indexData.slice(), 1))

  const matrix = new THREE.Matrix4().fromArray(placed.flatTransformation)
  bufferGeometry.applyMatrix4(matrix)

  geometry.delete()
  return bufferGeometry
}

function getMaterial(cache: Map<string, THREE.Material>, placed: PlacedGeometry): THREE.Material {
  const { x, y, z, w } = placed.color
  const key = `${x}_${y}_${z}_${w}`
  const cached = cache.get(key)
  if (cached) return cached

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(x, y, z),
    side: THREE.DoubleSide,
    transparent: w !== 1,
    opacity: w,
  })
  cache.set(key, material)
  return material
}
