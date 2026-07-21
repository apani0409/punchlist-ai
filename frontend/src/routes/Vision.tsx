import { useEffect, useRef, useState } from 'react'
import { detectFrame, preloadDetector, type Detection } from '../lib/detect'

const DETECTION_COLOR = '#22d3ee' // deliberately not a severity color — this isn't a defect finding

type LiveStatus = 'idle' | 'loading' | 'running' | 'error'
type UploadStatus = 'idle' | 'loading' | 'done' | 'error'

function drawBoxes(canvas: HTMLCanvasElement, dets: Detection[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const lineWidth = Math.max(2, canvas.width / 260)
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = DETECTION_COLOR
  ctx.font = `${Math.max(13, Math.round(canvas.width / 70))}px system-ui, sans-serif`
  ctx.textBaseline = 'top'
  for (const d of dets) {
    ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1)
    const label = `${d.className} ${Math.round(d.score * 100)}%`
    const textW = ctx.measureText(label).width
    const labelH = Math.max(16, Math.round(canvas.width / 45))
    ctx.fillStyle = DETECTION_COLOR
    ctx.fillRect(d.x1, Math.max(0, d.y1 - labelH), textW + 10, labelH)
    ctx.fillStyle = '#04222a'
    ctx.fillText(label, d.x1 + 5, Math.max(2, d.y1 - labelH + 2))
  }
}

export default function Vision() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uploadCanvasRef = useRef<HTMLCanvasElement>(null)
  const runningRef = useRef(false)

  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)
  const [detectionCount, setDetectionCount] = useState(0)

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadCount, setUploadCount] = useState(0)

  // Draw one idle preview frame (no boxes) as soon as the video can, so the
  // panel doesn't show a blank canvas before the user clicks Run.
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    function paintPreview() {
      if (!video || !canvas || runningRef.current) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
    video.addEventListener('loadeddata', paintPreview)
    return () => video.removeEventListener('loadeddata', paintPreview)
  }, [])

  useEffect(() => () => {
    runningRef.current = false
  }, [])

  function loop() {
    if (!runningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      requestAnimationFrame(loop)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    // Detect on the frame just painted (the canvas itself), not a fresh read
    // of `video` — by the time inference resolves the video has moved on,
    // so detecting on the snapshot keeps the drawn boxes matched to what's
    // actually on screen instead of a slightly later frame.
    detectFrame(canvas, canvas.width, canvas.height)
      .then((dets) => {
        if (!runningRef.current) return
        drawBoxes(canvas, dets)
        setDetectionCount(dets.length)
      })
      .catch((err: unknown) => {
        runningRef.current = false
        setLiveStatus('error')
        setLiveError(err instanceof Error ? err.message : 'Detection failed.')
      })
      .finally(() => {
        if (runningRef.current) requestAnimationFrame(loop)
      })
  }

  async function startLive() {
    setLiveError(null)
    setLiveStatus('loading')
    try {
      await preloadDetector()
    } catch (err) {
      setLiveStatus('error')
      setLiveError(err instanceof Error ? err.message : 'Failed to load the detector.')
      return
    }
    setLiveStatus('running')
    runningRef.current = true
    await videoRef.current?.play()
    loop()
  }

  function stopLive() {
    runningRef.current = false
    setLiveStatus('idle')
    videoRef.current?.pause()
  }

  async function handleUpload(file: File) {
    setUploadError(null)
    setUploadStatus('loading')
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not load that image.'))
        img.src = url
      })
      await preloadDetector()
      const dets = await detectFrame(img, img.naturalWidth, img.naturalHeight)
      const canvas = uploadCanvasRef.current
      if (canvas) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d')?.drawImage(img, 0, 0)
        drawBoxes(canvas, dets)
      }
      setUploadCount(dets.length)
      setUploadStatus('done')
    } catch (err) {
      setUploadStatus('error')
      setUploadError(err instanceof Error ? err.message : 'Detection failed.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="page">
      <section className="panel hero vision-hero">
        <video className="vision-hero-video" src="/video/aerial-hero.mp4" autoPlay muted loop playsInline />
        <h2 className="hero-title">Perception: when a VLM is the wrong tool</h2>
        <p className="hero-subtitle">
          Every other page in this app runs a general-purpose vision-language model on a photo.
          That was a deliberate choice, argued for in the README — and this page is the honest
          exception: the one shape of problem a VLM genuinely isn't built for.
        </p>
      </section>

      <section className="panel">
        <h2>Why not always one or the other</h2>
        <p className="summary">
          <code>/analyze</code> sends a single photo and gets back an open-ended read — what's
          wrong, why, what to do about it — with zero training data, because a general model
          already knows what a cracked wall or a missing cover plate looks like. That's the right
          tool for a discrete photo reviewed after the fact. It's the wrong tool for a live camera
          feed: nobody calls a cloud model 15-30 times a second, and the question a safety camera
          needs answered — is a person in this restricted area right now — is narrow and fixed, not
          open-ended. That's a real-time detector's job. Below is a working one, not a slide.
        </p>
      </section>

      <section className="panel">
        <div className="results-head">
          <div>
            <h2>Live: person detection, floor level</h2>
            <p className="summary">
              YOLOX-Nano (Apache-2.0, Megvii-BaseDetection) running entirely in your browser via
              onnxruntime-web — nothing sent to a server. First click downloads ~13MB of WASM
              runtime (~3.4MB compressed) plus a 3.6MB model; both are cached by the browser after
              that.
            </p>
          </div>
          {liveStatus === 'running' ? (
            <button className="pdf-btn" onClick={stopLive}>
              Stop detection
            </button>
          ) : (
            <button className="upload-btn" onClick={() => void startLive()} disabled={liveStatus === 'loading'}>
              {liveStatus === 'loading' ? 'Loading detector…' : 'Run detection'}
            </button>
          )}
        </div>
        {liveError && <p className="error">{liveError}</p>}
        <div className="vision-canvas-wrap">
          <video ref={videoRef} className="vision-source-video" src="/video/floor-level.mp4" muted loop playsInline />
          <canvas ref={canvasRef} className="vision-canvas" />
        </div>
        <p className="summary">
          {liveStatus === 'running'
            ? `${detectionCount} ${detectionCount === 1 ? 'person' : 'people'} detected in the current frame.`
            : 'Click Run detection to start — the video plays and the model runs frame by frame, live.'}
        </p>
      </section>

      <section className="panel">
        <h2>Try your own photo</h2>
        <p className="summary">
          Same detector, run once against a photo you choose — nothing uploaded anywhere, it never
          leaves your browser.
        </p>
        <label className="pdf-btn vision-upload-label">
          {uploadStatus === 'loading' ? 'Detecting…' : 'Choose photo…'}
          <input
            type="file"
            accept="image/*"
            className="vision-upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
        </label>
        {uploadError && <p className="error">{uploadError}</p>}
        {uploadStatus !== 'idle' && (
          <div className="vision-canvas-wrap vision-upload-preview">
            <canvas ref={uploadCanvasRef} className="vision-canvas" />
          </div>
        )}
        {uploadStatus === 'done' && (
          <p className="summary">
            {uploadCount} {uploadCount === 1 ? 'person' : 'people'} detected.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Same problem, two different data pipelines</h2>
        <p className="summary">
          The model swap is the easy part. What actually changes is how the data is handled end to
          end.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Photo → VLM (this app's core)</th>
                <th>Live feed → real-time detector</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Input</td>
                <td>One discrete photo, uploaded when ready</td>
                <td>15-30 frames per second, continuously</td>
              </tr>
              <tr>
                <td>Where it runs</td>
                <td>Cloud (Claude vision, via <code>/analyze</code>)</td>
                <td>The edge — in the browser here, or on-device in the field, no round trip</td>
              </tr>
              <tr>
                <td>Latency &amp; cost</td>
                <td>Seconds, a per-call API cost</td>
                <td>Milliseconds, effectively free once the model is loaded</td>
              </tr>
              <tr>
                <td>What it knows</td>
                <td>Open-ended — describes anything visible, in its own words</td>
                <td>A fixed, pre-trained set of classes decided in advance</td>
              </tr>
              <tr>
                <td>Training data needed</td>
                <td>None — zero-shot</td>
                <td>Needed upfront, to define those fixed classes</td>
              </tr>
              <tr>
                <td>What gets stored</td>
                <td>The full structured finding, cited back to its photo</td>
                <td>Events and tracks, not raw frames — the video itself is never the record</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Where this fits, honestly</h2>
        <p className="summary">
          The README's construction-AI landscape table names this directly, in the "Perceive" row:
          this project uses a general-purpose VLM instead of a defect-specific CNN/YOLO model, and
          names "real-time video/CCTV monitoring" as the roadmap gap that leaves open. This page is
          that gap, filled honestly and scoped narrowly — a real-time detector watching for people
          in a floor-level feed, not a replacement for the VLM's defect-finding job, and not a
          claim that it could do that job. The aerial footage above is illustration only, for the
          drone-capture-layer story elsewhere in this app (<code>Photo.source: 'drone'</code>) —
          it is never run through detection. Off-the-shelf detectors are unreliable on aerial
          footage without purpose-built retraining, and cleanly-licensed pretrained weights for
          that specific case are hard to find; floor-level, person-only is the honest scope this
          page actually delivers.
        </p>
      </section>
    </div>
  )
}
