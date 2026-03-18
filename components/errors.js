'use client'
import { useState, useCallback } from 'react'

// ── ERROR STATE COMPONENT ─────────────────────────────────────────────────────
export function ErrorState({ message, onRetry, compact = false }) {
  if (compact) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(138,40,40,0.06)', border: '1px solid rgba(138,40,40,0.18)', borderRadius: 8, fontSize: 11, color: '#8a2828', fontFamily: 'JetBrains Mono, monospace' }}>
      <span>⚠</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && <button onClick={onRetry} style={{ background: 'transparent', border: '1px solid rgba(138,40,40,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, color: '#8a2828', fontFamily: 'JetBrains Mono, monospace' }}>Retry</button>}
    </div>
  )

  return (
    <div style={{ padding: '20px 16px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.88)', borderRadius: 14, textAlign: 'center', boxShadow: '0 3px 18px rgba(20,60,35,0.13)' }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>⚠</div>
      <div style={{ fontSize: 13, color: '#182e22', fontWeight: 500, marginBottom: 4 }}>Something went wrong</div>
      <div style={{ fontSize: 11.5, color: '#7aaa8a', marginBottom: 14, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>Try again</button>
      )}
    </div>
  )
}

// ── LOADING STATE ─────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading…', compact = false }) {
  if (compact) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', color: '#7aaa8a', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ width: 12, height: 12, border: '2px solid rgba(122,170,138,0.3)', borderTopColor: '#2d7a52', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
      {message}
    </div>
  )

  return (
    <div style={{ padding: '22px 16px', display: 'flex', alignItems: 'center', gap: 12, color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.88)', borderRadius: 14 }}>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(122,170,138,0.3)', borderTopColor: '#2d7a52', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
      {message}
    </div>
  )
}

// ── OFFLINE BANNER ────────────────────────────────────────────────────────────
export function OfflineBanner() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(138,40,40,0.92)', backdropFilter: 'blur(8px)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11.5, color: '#fff', fontFamily: 'JetBrains Mono, monospace', zIndex: 500 }}>
      <span>●</span> Offline — tasks saved locally, will sync when reconnected
    </div>
  )
}

// ── ASYNC WITH RETRY HOOK ─────────────────────────────────────────────────────
export function useAsyncRetry(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: false, error: null })
  const attempt = useRef(0)

  const run = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const thisAttempt = ++attempt.current
    try {
      const data = await asyncFn()
      if (thisAttempt === attempt.current) setState({ data, loading: false, error: null })
    } catch (err) {
      if (thisAttempt === attempt.current) setState(s => ({ ...s, loading: false, error: err.message || 'Something went wrong' }))
    }
  }, deps)

  return { ...state, retry: run, run }
}

// ── TOAST NOTIFICATIONS ───────────────────────────────────────────────────────
let toastQueue = []
let setToastsGlobal = null

export function ToastProvider() {
  const [toasts, setToasts] = useState([])
  setToastsGlobal = setToasts

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 400 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === 'error' ? 'rgba(138,40,40,0.95)' : 'rgba(15,110,86,0.95)', backdropFilter: 'blur(12px)', border: `1px solid ${t.type === 'error' ? 'rgba(138,40,40,0.4)' : 'rgba(15,110,86,0.4)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#fff', fontFamily: 'JetBrains Mono, monospace', maxWidth: 280, display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeUp .2s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  )
}

export function toast(message, type = 'success', duration = 3500) {
  if (!setToastsGlobal) return
  const id = Date.now()
  setToastsGlobal(t => [...t, { id, message, type }])
  setTimeout(() => setToastsGlobal(t => t.filter(x => x.id !== id)), duration)
}

import { useRef } from 'react'
