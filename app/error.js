'use client'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[FFTREE] Uncaught error:', error)
    // ChunkLoadError means the browser has a stale page from a previous deployment.
    // reset() won't help — the chunk file is gone. Force a hard reload to fetch the new bundle.
    if (error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk')) {
      window.location.reload()
    }
  }, [error])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)', zIndex: 0 }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <div style={{
          background: 'rgba(255,255,255,.93)', backdropFilter: 'blur(24px)',
          borderRadius: 20, padding: '28px 24px', maxWidth: 400, width: '100%',
          border: '1px solid rgba(255,255,255,.88)', boxShadow: '0 20px 60px rgba(20,60,35,.2)',
          fontFamily: 'JetBrains Mono,monospace',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8a2828', marginBottom: 10 }}>
            App error — check browser console for details
          </div>
          <pre style={{
            fontSize: 10.5, color: '#3a5c47', background: 'rgba(20,60,35,.05)',
            borderRadius: 8, padding: '10px 12px', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: 16,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {error?.message || String(error)}
            {error?.stack ? '\n\n' + error.stack : ''}
          </pre>
          <button
            onClick={reset}
            style={{
              background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </>
  )
}
