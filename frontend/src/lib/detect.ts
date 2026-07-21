// Client-side, real-time object detection — YOLOX-Nano (Apache-2.0,
// Megvii-BaseDetection) running entirely in the browser via onnxruntime-web
// (WASM). Deliberately NOT the VLM path the rest of this app uses: this is
// the "narrow, high-frequency, low-latency" case a general vision-language
// model isn't a fit for — see routes/Vision.tsx for the framing. Detects
// COCO's 80 classes; this app only surfaces "person" (safety/PPE context —
// not defect detection, which stays the VLM's job).
//
// Pre/post-processing here mirrors YOLOX's own reference implementation
// (yolox/data/data_augment.py's `preproc`, yolox/utils/demo_utils.py's
// `demo_postprocess` / `multiclass_nms`, demo/ONNXRuntime/onnx_inference.py)
// verified against the literal source, not a paraphrase — the letterbox
// padding value (114), top-left (not centered) placement, raw 0-255 pixel
// values with zero mean/std normalization, BGR channel order, and the
// per-stride anchor-free grid decode all match it exactly. Getting any of
// these subtly wrong produces boxes that look plausible but are off.

export interface Detection {
  x1: number
  y1: number
  x2: number
  y2: number
  score: number
  className: string
}

const INPUT_SIZE = 416 // yolox_nano's own exp config test_size — not the 640 the general YOLOX demo defaults to
const STRIDES = [8, 16, 32]
const NUM_CLASSES = 80
const SCORE_THRESHOLD = 0.3
const NMS_IOU_THRESHOLD = 0.45
const MODEL_URL = '/models/yolox_nano.onnx'

// Only classes this demo actually renders. Keeping the full COCO list (not
// just "person") makes the allowlist self-documenting and cheap to extend
// later (e.g. vehicle-proximity) without touching the decode math.
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
]
const DETECTABLE_CLASSES = new Set(['person'])

type Ort = typeof import('onnxruntime-web/wasm')

type Session = Awaited<ReturnType<Ort['InferenceSession']['create']>>

let ortModule: Ort | null = null
let sessionPromise: Promise<Session> | null = null

async function init() {
  if (!ortModule) {
    ortModule = await import('onnxruntime-web/wasm')
    // No wasmPaths override: left to resolve its own companion .wasm/.mjs
    // relative to itself (vite.config.ts excludes it from dependency
    // pre-bundling so that resolution isn't broken by Vite relocating it).
    // Single-threaded: the alternative (numThreads > 1) needs
    // SharedArrayBuffer, which needs COOP/COEP response headers — the same
    // tradeoff already made for web-ifc's WASM in lib/ifc.ts, for the same
    // reason (no header requirements to satisfy on Vercel).
    ortModule.env.wasm.numThreads = 1
  }
  if (!sessionPromise) {
    sessionPromise = ortModule.InferenceSession.create(MODEL_URL)
  }
  return { ort: ortModule, session: await sessionPromise }
}

// Call to pay the WASM + model download cost ahead of the first detection
// (e.g. as soon as the user opens the live-detection panel), so the first
// frame doesn't stall on a multi-MB fetch.
export async function preloadDetector(): Promise<void> {
  await init()
}

// Pads to a square INPUT_SIZE canvas (fill 114,114,114), scales the source
// down (never up) by the smaller of the two axis ratios, and places it at
// the canvas's top-left corner — matching YOLOX's `preproc` exactly, not a
// centered letterbox (a natural but wrong assumption here).
function letterbox(source: CanvasImageSource, srcW: number, srcH: number): { chw: Float32Array; ratio: number } {
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = 'rgb(114, 114, 114)'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)

  const ratio = Math.min(INPUT_SIZE / srcH, INPUT_SIZE / srcW)
  const resizedW = Math.round(srcW * ratio)
  const resizedH = Math.round(srcH * ratio)
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, resizedW, resizedH)

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const plane = INPUT_SIZE * INPUT_SIZE
  // RGBA -> BGR planar NCHW, raw [0,255] float — YOLOX's OpenCV-based
  // training pipeline normalizes neither the channel order nor the range.
  const chw = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    chw[i] = b
    chw[plane + i] = g
    chw[2 * plane + i] = r
  }
  return { chw, ratio }
}

// Anchor-free decode: for each stride level's grid cell, the raw center
// offset and log-scale size are turned into absolute INPUT_SIZE-space
// pixels via (raw + grid) * stride and exp(raw) * stride respectively —
// straight port of demo_utils.py's demo_postprocess, including the exact
// per-stride grid concatenation order ([8, 16, 32], row-major within each).
function decode(output: Float32Array): { boxes: number[][]; scores: number[] } {
  const boxes: number[][] = []
  const scores: number[] = []
  const stepSize = 5 + NUM_CLASSES
  let offset = 0

  for (const stride of STRIDES) {
    const gridW = INPUT_SIZE / stride
    const gridH = INPUT_SIZE / stride
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const rawCx = output[offset]
        const rawCy = output[offset + 1]
        const rawW = output[offset + 2]
        const rawH = output[offset + 3]
        const objectness = output[offset + 4]

        let bestClass = 0
        let bestClassProb = 0
        for (let c = 0; c < NUM_CLASSES; c++) {
          const p = output[offset + 5 + c]
          if (p > bestClassProb) {
            bestClassProb = p
            bestClass = c
          }
        }

        if (DETECTABLE_CLASSES.has(COCO_CLASSES[bestClass])) {
          const score = objectness * bestClassProb
          if (score > SCORE_THRESHOLD) {
            const cx = (rawCx + gx) * stride
            const cy = (rawCy + gy) * stride
            const w = Math.exp(rawW) * stride
            const h = Math.exp(rawH) * stride
            boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, bestClass])
            scores.push(score)
          }
        }
        offset += stepSize
      }
    }
  }
  return { boxes, scores }
}

function iou(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter)
}

function nms(boxes: number[][], scores: number[], iouThreshold: number): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
  const suppressed = new Set<number>()
  const keep: number[] = []
  for (const i of order) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (j === i || suppressed.has(j)) continue
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed.add(j)
    }
  }
  return keep
}

// Runs one detection pass on the current state of a video/image element.
// Pass the source's native pixel dimensions (videoWidth/videoHeight or
// naturalWidth/naturalHeight) — letterboxing needs the real aspect ratio,
// not whatever size it's displayed at in the page.
export async function detectFrame(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
): Promise<Detection[]> {
  const { ort, session } = await init()
  const { chw, ratio } = letterbox(source, srcWidth, srcHeight)
  const tensor = new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const results = await session.run({ [inputName]: tensor })
  const output = results[outputName].data as Float32Array

  const { boxes, scores } = decode(output)
  const keep = nms(boxes, scores, NMS_IOU_THRESHOLD)

  // Scale back from letterboxed INPUT_SIZE space to the source's own pixel
  // space — the inverse of letterbox()'s scale-down.
  return keep.map((i) => {
    const [x1, y1, x2, y2, classId] = boxes[i]
    return {
      x1: x1 / ratio,
      y1: y1 / ratio,
      x2: x2 / ratio,
      y2: y2 / ratio,
      score: scores[i],
      className: COCO_CLASSES[classId],
    }
  })
}
