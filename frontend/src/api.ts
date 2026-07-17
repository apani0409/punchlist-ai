import type { PunchListResult } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function analyzePhoto(
  file: File,
  apiKey: string,
): Promise<PunchListResult> {
  const image_base64 = await fileToBase64(file)
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // BYO key: forwarded to the backend for this request only, never stored.
      'X-Anthropic-Key': apiKey,
    },
    body: JSON.stringify({ image_base64, media_type: file.type }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
