'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import TreeView from '@/components/TreeView'
import { sanitizeImageKey } from '@/lib/tree-display'

const m = { fontFamily: 'var(--m)' }
const btn = {
  ...m,
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  border: '1px solid var(--gb2)',
  background: 'var(--glass2)',
  color: 'var(--txt2)',
}
const btnHi = { ...btn, background: '#1a5a3c', color: '#fff', borderColor: '#1a5a3c' }

export default function TreePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [treeData, setTreeData] = useState(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState(null)
  const [variantInput, setVariantInput] = useState('')
  const [savingGallery, setSavingGallery] = useState(false)

  const refresh = useCallback(async () => {
    setTreeLoading(true)
    setTreeError(null)
    try {
      const res = await fetch('/api/tree', { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || res.statusText)
      setTreeData(j)
    } catch (e) {
      setTreeError(e.message || 'Failed to load tree')
      setTreeData(null)
    } finally {
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') refresh()
  }, [status, refresh])

  async function patchContext(partial) {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Save failed')
    }
  }

  async function setBgMode(mode) {
    try {
      await patchContext({ tree_bg_mode: mode })
      await refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  async function persistGallery(nextGallery) {
    setSavingGallery(true)
    try {
      await patchContext({ tree_gallery_by_slug: nextGallery })
      await refresh()
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingGallery(false)
    }
  }

  function addVariant() {
    const ms = treeData?.milestone_slug
    if (!ms) return
    const key = sanitizeImageKey(variantInput)
    if (!key) {
      alert('Use lowercase letters, numbers, and hyphens only (e.g. bristlecone-golden-hour).')
      return
    }
    const g = { ...(treeData.tree_gallery_by_slug || {}) }
    const cur = new Set(g[ms] || [ms])
    cur.add(key)
    g[ms] = [...cur]
    setVariantInput('')
    persistGallery(g)
  }

  function removeVariant(slugKey) {
    const ms = treeData?.milestone_slug
    if (!ms) return
    const g = { ...(treeData.tree_gallery_by_slug || {}) }
    const base = sanitizeImageKey(ms) || ms
    const cur = [...(g[ms] || [base])].filter((x) => x !== slugKey)
    const next = cur.length ? [...new Set(cur.map((x) => sanitizeImageKey(x)).filter(Boolean))] : [base]
    if (next.length === 1 && next[0] === base) delete g[ms]
    else g[ms] = next
    persistGallery(g)
  }

  if (status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--acc2)', color: '#fff', ...m, fontSize: 12 }}>
        Loading…
      </div>
    )
  }

  if (!session?.user?.email) {
    router.replace('/')
    return null
  }

  const mode = treeData?.tree_bg_mode || 'sticky'
  const ms = treeData?.milestone_slug
  const pool = treeData?.gallery_pool || []

  return (
    <>
      <div className="app-bg" style={{ zIndex: 0 }} />
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 12px 12px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => router.push('/')} style={btn}>
            ← Home
          </button>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 16, fontStyle: 'italic', color: 'var(--txt)' }}>Life tree</div>
            <div style={{ ...m, fontSize: 8, color: 'var(--txt3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Trunk timeline</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => setBgMode('sticky')} style={mode === 'sticky' ? btnHi : btn}>
              Fixed
            </button>
            <button type="button" onClick={() => setBgMode('rotate_load')} style={mode === 'rotate_load' ? btnHi : btn}>
              Rotate
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={mode !== 'rotate_load' || treeLoading}
              style={{
                ...btn,
                opacity: mode === 'rotate_load' && !treeLoading ? 1 : 0.45,
                cursor: mode === 'rotate_load' && !treeLoading ? 'pointer' : 'not-allowed',
              }}
            >
              Shuffle bg
            </button>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: 10 }}>
          <TreeView treeData={treeData} treeLoading={treeLoading} treeError={treeError} />
        </div>

        <div
          style={{
            flexShrink: 0,
            maxHeight: '42vh',
            overflowY: 'auto',
            borderRadius: 'var(--r2)',
            border: '1px solid var(--gb2)',
            background: 'var(--glass)',
            padding: 12,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ ...m, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>
            Past evolution — portraits at each milestone you have passed
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
            {(treeData?.past_milestones || []).map((row) => (
              <div
                key={row.tier}
                style={{
                  flex: '0 0 auto',
                  width: 108,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: row.slug === ms ? '2px solid #1a5a3c' : '1px solid var(--gb2)',
                  background: 'var(--glass2)',
                }}
              >
                <div
                  style={{
                    height: 72,
                    backgroundImage: `url('/species/${row.slug}.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                  }}
                />
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ ...m, fontSize: 8, color: 'var(--txt3)' }}>Tier {row.tier}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt)', lineHeight: 1.3 }}>
                    {row.emoji} {row.name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...m, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>
            Gallery — same species only ({ms || '…'})
          </div>
          <p style={{ fontSize: 11, color: 'var(--txt2)', lineHeight: 1.5, marginBottom: 10 }}>
            Add extra JPGs in <code style={m}>/public/species/</code> (e.g. <code style={m}>bristlecone-dusk.jpg</code>). Rotation picks only from this list for your current species.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {pool.map((key) => (
              <div
                key={key}
                style={{
                  position: 'relative',
                  width: 88,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: key === treeData?.species?.display_slug ? '2px solid #0f6e56' : '1px solid var(--gb2)',
                }}
              >
                {pool.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(key)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: 'none',
                      background: 'rgba(0,0,0,.55)',
                      color: '#fff',
                      fontSize: 12,
                      lineHeight: 1,
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                    title="Remove from gallery"
                  >
                    ×
                  </button>
                )}
                <div
                  style={{
                    height: 64,
                    backgroundImage: `url('/species/${key}.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                  }}
                />
                <div style={{ ...m, fontSize: 8, padding: '4px 6px', color: 'var(--txt3)', wordBreak: 'break-all' }}>{key}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={variantInput}
              onChange={(e) => setVariantInput(e.target.value)}
              placeholder="filename key (no .jpg)"
              style={{
                flex: 1,
                minWidth: 160,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--gb2)',
                background: 'var(--glass2)',
                fontSize: 12,
                ...m,
              }}
            />
            <button type="button" onClick={addVariant} disabled={savingGallery || !variantInput.trim()} style={btnHi}>
              {savingGallery ? '…' : 'Add variant'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
