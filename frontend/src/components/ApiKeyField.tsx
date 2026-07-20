import { useState } from 'react'

const STORAGE_KEY = 'punchlist:apiKey'

// Shared across routes so the user doesn't re-paste their key on every page.
// Session-only by design: never written to localStorage or sent anywhere
// except the per-request X-Anthropic-Key header.
export function useApiKey(): [string, (key: string) => void] {
  const [apiKey, setApiKeyState] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  function setApiKey(key: string) {
    setApiKeyState(key)
    if (key) sessionStorage.setItem(STORAGE_KEY, key)
    else sessionStorage.removeItem(STORAGE_KEY)
  }
  return [apiKey, setApiKey]
}

export default function ApiKeyField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="password"
      className="api-key-field"
      placeholder="Anthropic API key (sk-ant-…) — per-request only, never stored"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
