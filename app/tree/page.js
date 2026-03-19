'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TreeView from '@/components/TreeView'

export default function TreePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--acc2)', color: '#fff', fontFamily: 'var(--m)', fontSize: 12 }}>
        Loading…
      </div>
    )
  }

  if (!session?.user?.email) {
    router.replace('/')
    return null
  }

  return (
    <>
      <div className="app-bg" style={{ zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 10, height: '100vh', display: 'flex', flexDirection: 'column', padding: '10px 12px 12px', boxSizing: 'border-box' }}>
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{
              fontFamily: 'var(--m)',
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--gb2)',
              background: 'var(--glass2)',
              color: 'var(--txt2)',
              cursor: 'pointer',
            }}
          >
            ← Home
          </button>
          <div>
            <div style={{ fontFamily: 'var(--s)', fontSize: 16, fontStyle: 'italic', color: 'var(--txt)' }}>Life tree</div>
            <div style={{ fontFamily: 'var(--m)', fontSize: 8, color: 'var(--txt3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Trunk timeline</div>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 'var(--r2)', overflow: 'hidden' }}>
          <TreeView userId={session.user.email} />
        </div>
      </div>
    </>
  )
}
