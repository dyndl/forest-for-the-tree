'use client'
import { useState, useRef } from 'react'

function ArboristScore({ treeData }) {
  const branches = treeData?.branches || []
  const roots = treeData?.roots || []
  const rings = treeData?.rings || []
  const rels = treeData?.relationships || []

  const activeBranches = branches.filter(b => ['growing','done'].includes(b.state)).length
  const rootScore = roots.reduce((s, r) => s + (r.years_ago || 0) * (r.score || 1), 0) / 10
  const avgRingScore = rings.length ? rings.reduce((s, r) => s + (r.score || 0), 0) / rings.length : 0
  const strongRels = rels.filter(r => (r.score || 0) >= 4).length

  const score = Math.round(
    Math.min(activeBranches * 40, 300) +
    Math.min(rootScore, 250) +
    Math.min((avgRingScore / 8) * 250, 250) +
    Math.min(strongRels * 50, 200)
  )

  const pct = Math.min(100, (score / 1000) * 100)
  const color = score >= 700 ? '#2d7a52' : score >= 400 ? '#b85c00' : '#7aaa8a'

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--m)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: '#7aaa8a' }}>Arborist Score</span>
        <span style={{ fontFamily: 'var(--m)', fontSize: 14, fontWeight: 700, color }}>{score} <span style={{ fontSize: 10, fontWeight: 400, color: '#9aaa8a' }}>/1000</span></span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct.toFixed(1)}%`, transition: 'width .4s' }} />
      </div>
      <div style={{ fontFamily: 'var(--m)', fontSize: 9.5, color: '#9aaa8a', marginTop: 3 }}>
        {activeBranches} active branches · {roots.length} roots · {strongRels} close relationships
      </div>
    </div>
  )
}

function TierLadder({ treeData }) {
  const sp = treeData?.species
  const catalog = treeData?.catalog || []
  const currentTier = sp?.current_tier || 1
  const hXP = sp?.height_xp || 0
  const wXP = sp?.width_xp || 0
  const lastEvent = sp?.last_xp_event

  const [tierExpanded, setTierExpanded] = useState(null)
  const tierRefs = useRef({})

  const groups = {}
  catalog.forEach(r => {
    if (!groups[r.tier_group]) groups[r.tier_group] = { name: r.group_name, minTier: r.tier, maxTier: r.tier, species: [] }
    groups[r.tier_group].species.push(r)
    groups[r.tier_group].minTier = Math.min(groups[r.tier_group].minTier, r.tier)
    groups[r.tier_group].maxTier = Math.max(groups[r.tier_group].maxTier, r.tier)
  })
  const groupList = Object.entries(groups).map(([g, v]) => ({ ...v, id: +g })).sort((a, b) => a.minTier - b.minTier)
  const activeTierGroup = catalog.find(r => r.tier === currentTier)?.tier_group

  return (
    <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
      {lastEvent?.h_gained > 0 && (
        <div style={{ marginBottom: 8, padding: '5px 8px', borderRadius: 5, background: 'rgba(26,90,60,.07)', border: '1px solid rgba(26,90,60,.14)', fontFamily: 'var(--m)', fontSize: 10.5, color: '#2d7a52' }}>
          Today: +{lastEvent.h_gained} H · +{lastEvent.w_gained} W XP
        </div>
      )}
      <div style={{ fontFamily: 'var(--m)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: '#7aaa8a', marginBottom: 8 }}>Tier Ladder</div>
      {groupList.map(grp => {
        const unlocked = grp.minTier <= currentTier
        const isCurrent = grp.id === activeTierGroup
        const isOpen = tierExpanded === grp.id || (isCurrent && tierExpanded === null)
        return (
          <div key={grp.id} style={{ marginBottom: 3 }} ref={el => { tierRefs.current[grp.id] = el }}>
            <button
              onClick={() => {
                const opening = !isOpen
                setTierExpanded(opening ? grp.id : -1)
                if (opening) setTimeout(() => tierRefs.current[grp.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, border: `1px solid ${isCurrent ? 'rgba(26,90,60,.2)' : 'rgba(0,0,0,.08)'}`, background: isCurrent ? 'rgba(26,90,60,.05)' : unlocked ? '#fff' : 'rgba(0,0,0,.02)', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ fontFamily: 'var(--m)', fontSize: 11.5, color: unlocked ? '#182e22' : '#b0bab4', fontWeight: isCurrent ? 600 : 400 }}>
                {unlocked ? '' : '🔒 '}Tier {grp.id} · {grp.name} <span style={{ color: '#9aaa8a', fontWeight: 400 }}>#{grp.minTier}–{grp.maxTier}</span>
              </div>
              <span style={{ color: '#7aaa8a', fontSize: 11, fontWeight: 600 }}>{isOpen ? '–' : '›'}</span>
            </button>
            {isOpen && unlocked && (
              <div style={{ paddingLeft: 4, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {grp.species.map(s => {
                  const isCur = s.tier === currentTier
                  const isDone = s.tier < currentTier
                  const isLocked = s.tier > currentTier
                  const threshH = Math.round((s.height_ft || 0) * 60)
                  const threshW = Math.round((s.width_ft || 0) * 180)
                  const hPct = threshH > 0 ? Math.min(100, (hXP / threshH) * 100) : 100
                  const wPct = threshW > 0 ? Math.min(100, (wXP / threshW) * 100) : 100
                  return (
                    <div key={s.tier} style={{ padding: '6px 10px', borderRadius: 4, background: isCur ? 'rgba(26,90,60,.07)' : 'transparent', opacity: isLocked ? 0.4 : 1, borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isCur ? 5 : 2 }}>
                        <span style={{ fontSize: 13, width: 15, textAlign: 'center' }}>{isLocked ? '🔒' : s.emoji}</span>
                        <span style={{ fontFamily: 'Figtree,sans-serif', fontSize: 13, color: isCur ? '#182e22' : '#4a6a50', flex: 1, fontWeight: isCur ? 500 : 400 }}>{s.name}</span>
                        {isDone && <span style={{ fontSize: 11, color: '#2d7a52' }}>✓</span>}
                        {isCur && <span style={{ fontSize: 11, color: '#1a5a3c', fontWeight: 600 }}>►</span>}
                      </div>
                      {isCur && (
                        <>
                          <div style={{ marginBottom: 3 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                              <span style={{ fontFamily: 'var(--m)', fontSize: 9, color: '#7aaa8a' }}>H · {hXP.toLocaleString()} / {threshH.toLocaleString()}</span>
                              <span style={{ fontFamily: 'var(--m)', fontSize: 9, color: '#4a9e6b', fontWeight: 600 }}>{hPct.toFixed(0)}%</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,.08)' }}>
                              <div style={{ height: '100%', borderRadius: 2, background: '#4a9e6b', width: `${hPct.toFixed(1)}%`, transition: 'width .4s' }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                              <span style={{ fontFamily: 'var(--m)', fontSize: 9, color: '#7aaa8a' }}>W · {wXP.toLocaleString()} / {threshW.toLocaleString()}</span>
                              <span style={{ fontFamily: 'var(--m)', fontSize: 9, color: '#1a5fa8', fontWeight: 600 }}>{wPct.toFixed(0)}%</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,.08)' }}>
                              <div style={{ height: '100%', borderRadius: 2, background: '#1a5fa8', width: `${wPct.toFixed(1)}%`, transition: 'width .4s' }} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ManageTree({ onRunReeval, onRunSeed }) {
  const [open, setOpen] = useState(false)
  const [ctx, setCtx] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedResult, setSeedResult] = useState(null)
  const [attachments, setAttachments] = useState([])

  async function handleReeval() {
    setLoading(true); setResult(null)
    const r = await onRunReeval(ctx, attachments)
    setResult(r)
    setLoading(false)
  }

  async function handleSeed() {
    setSeedLoading(true); setSeedResult(null)
    const r = await onRunSeed(ctx, attachments)
    setSeedResult(r)
    setSeedLoading(false)
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - attachments.length)
    e.target.value = ''
    if (!files.length) return
    const newAtts = files.map(f => ({ id: Math.random().toString(36).slice(2), name: f.name, status: 'extracting' }))
    setAttachments(p => [...p, ...newAtts])
    files.forEach(async (file, i) => {
      try {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/onboarding/extract-outline', { method: 'POST', body: fd })
        const json = await res.json()
        setAttachments(p => p.map(a => a.id === newAtts[i].id ? { ...a, status: 'done', text: json.text } : a))
      } catch {
        setAttachments(p => p.map(a => a.id === newAtts[i].id ? { ...a, status: 'error' } : a))
      }
    })
  }

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
      <button onClick={() => { setOpen(o => !o); setResult(null) }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontFamily: 'var(--m)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: '#7aaa8a' }}>Manage tree</span>
        <span style={{ color: '#7aaa8a', fontSize: 11 }}>{open ? '▾' : '›'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#7aaa8a', marginBottom: 5, lineHeight: 1.5 }}>Add career history, certifications, or projects the COO should know when ranking you.</div>
          <textarea value={ctx} onChange={e => setCtx(e.target.value)} rows={4} placeholder="e.g. 10 years in ML engineering, shipped 3 production models…" style={{ width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, color: '#182e22', fontSize: 12, padding: '6px 8px', fontFamily: 'Figtree,sans-serif', resize: 'vertical', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 5, cursor: attachments.length >= 3 ? 'not-allowed' : 'pointer', border: '1px dashed rgba(122,170,138,.5)', fontSize: 11.5, color: '#7aaa8a', fontFamily: 'var(--m)', background: 'rgba(45,122,82,.03)', opacity: attachments.length >= 3 ? .4 : 1 }}>
              📎 Attach
              <input type="file" multiple accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,image/*" style={{ display: 'none' }} onChange={handleFileSelect} disabled={attachments.length >= 3} />
            </label>
            <span style={{ fontFamily: 'var(--m)', fontSize: 10.5, color: '#7aaa8a' }}>{attachments.length > 0 ? `${attachments.length}/3 files` : 'up to 3'}</span>
          </div>
          {result && !result.error && !result.skipped && (
            <div style={{ padding: '7px 9px', background: 'rgba(26,90,60,.06)', border: '1px solid rgba(26,90,60,.15)', borderRadius: 6, fontFamily: 'var(--m)', fontSize: 11.5, color: '#3a5c47', lineHeight: 1.5, marginTop: 6 }}>
              <strong style={{ color: '#1a5a3c' }}>Tier {result.tier} — {result.catalog_row?.emoji} {result.catalog_row?.name}</strong><br />{result.reason}
            </div>
          )}
          {result?.error && <div style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#8a2828', marginTop: 5 }}>{result.error}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button onClick={handleReeval} disabled={loading} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid rgba(26,90,60,.25)', background: 'rgba(26,90,60,.08)', color: '#1a5a3c', fontFamily: 'var(--m)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', opacity: loading ? .6 : 1 }}>{loading ? 'Evaluating…' : 'Re-evaluate tier'}</button>
            <button onClick={() => { setOpen(false); setCtx(''); setResult(null); setAttachments([]) }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,.1)', background: 'none', color: '#7aaa8a', fontFamily: 'var(--m)', fontSize: 11.5, cursor: 'pointer' }}>Cancel</button>
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,.07)' }}>
            <div style={{ fontFamily: 'var(--m)', fontSize: 10.5, color: '#7aaa8a', marginBottom: 5 }}>Rebuild tree from career outline</div>
            <button onClick={handleSeed} disabled={seedLoading} style={{ width: '100%', padding: '5px 0', borderRadius: 6, border: '1px solid rgba(0,0,0,.08)', background: '#fff', color: '#3a5c47', fontFamily: 'var(--m)', fontSize: 11, cursor: 'pointer', opacity: seedLoading ? .6 : 1 }}>{seedLoading ? 'Re-seeding…' : '↺ Re-seed branches, roots & relationships'}</button>
            {seedResult && <div style={{ marginTop: 5, fontFamily: 'var(--m)', fontSize: 10, color: seedResult.ok ? '#3a7d44' : '#b94a3a', lineHeight: 1.4 }}>{seedResult.msg}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TreeSidePanel({ treeData, gran, onGranChange, onRunReeval, onRunSeed }) {
  const sp = treeData?.species
  const cat = treeData?.current_catalog_row
  const next = treeData?.next_milestone
  const currentTier = sp?.current_tier || 1
  const hXP = sp?.height_xp || 0
  const wXP = sp?.width_xp || 0
  const streak = sp?.current_streak || 0
  const longestStreak = sp?.longest_streak || 0
  const streakMult = Math.round(Math.min(2.5, 1.0 + streak * 0.05) * 100) / 100
  const nextMilestoneStreak = streak < 3 ? 3 : streak < 7 ? 7 : streak < 14 ? 14 : streak < 21 ? 21 : streak < 30 ? 30 : null
  const nextMilestoneBonus = nextMilestoneStreak ? Math.round(Math.min(2.5, 1.0 + nextMilestoneStreak * 0.05) * 100) / 100 : null
  const nextH = next ? Math.round(next.height_ft * 60) : Math.max(hXP * 1.5, 100)
  const nextW = next ? Math.round(next.width_ft * 180) : Math.max(wXP * 1.5, 100)

  if (!sp) return null

  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgba(0,0,0,.09)', background: 'rgba(250,249,246,.98)', display: 'flex', flexDirection: 'column', overflowY: 'auto', fontSize: 14 }}>
      {/* Species header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <span style={{ fontFamily: 'var(--m)', fontSize: 11, fontWeight: 700, color: '#182e22', letterSpacing: '.1em', textTransform: 'uppercase' }}>LEVEL {currentTier}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#4a9e6b', display: 'inline-block' }} />
        </div>
        <div style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#7aaa8a', marginBottom: 7 }}>{cat?.group_name || '—'}</div>
        <div style={{ fontFamily: 'Instrument Serif,Georgia,serif', fontSize: 22, fontWeight: 600, color: '#182e22', marginBottom: 2, lineHeight: 1.2 }}>{cat?.emoji || sp?.species_emoji || '🌿'} {cat?.name || sp?.species_name || 'Seedling'}</div>
        {cat?.height_ft && <div style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#7aaa8a', marginBottom: 8 }}>{cat.height_ft} ft height · {cat.width_ft} ft wide</div>}
        {cat?.fact && <div style={{ fontFamily: 'Instrument Serif,Georgia,serif', fontSize: 13, fontStyle: 'italic', color: '#3a5c47', lineHeight: 1.55, marginBottom: 3 }}>{cat.fact}</div>}
        {cat?.exemplar && <div style={{ fontFamily: 'Instrument Serif,Georgia,serif', fontSize: 12, fontStyle: 'italic', color: '#7aaa8a', lineHeight: 1.4 }}>"{cat.exemplar}"</div>}
      </div>

      {/* Arborist score */}
      <ArboristScore treeData={treeData} />

      {/* XP progress toward next tier */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ fontFamily: 'var(--m)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: '#7aaa8a', marginBottom: 10 }}>Progress</div>
        {[['Height XP · mastery', hXP, nextH, '#4a9e6b'], ['Width XP · impact', wXP, nextW, '#1a5fa8']].map(([label, val, max, col]) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#3a5c47' }}>{label}</span>
              <span style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#182e22', fontWeight: 500 }}>{val.toLocaleString()} / {max.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: col, width: `${Math.min(100, (val / Math.max(max, 1)) * 100).toFixed(1)}%`, transition: 'width .4s' }} />
            </div>
          </div>
        ))}
        {next && <div style={{ fontFamily: 'var(--m)', fontSize: 10.5, color: '#7aaa8a', marginTop: 2 }}>Next: {next.emoji} {next.name} #{next.tier} · +{(nextH - hXP).toLocaleString()} H · +{(nextW - wXP).toLocaleString()} W</div>}
      </div>

      {/* Streak */}
      <div style={{ padding: '10px 14px 10px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 15 }}>🔥</span>
            <span style={{ fontFamily: 'var(--m)', fontSize: 11, fontWeight: 600, color: streak >= 7 ? '#b85c00' : '#3a5c47' }}>{streak} day streak</span>
          </div>
          <span style={{ fontFamily: 'var(--m)', fontSize: 11, color: '#1a5a3c', fontWeight: 600 }}>{streakMult}×</span>
        </div>
        {streak > 0 && (
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,.07)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#b85c00,#e8a030)', width: `${Math.min(100, (streak / 30) * 100)}%`, transition: 'width .4s' }} />
          </div>
        )}
        <div style={{ fontFamily: 'var(--m)', fontSize: 10, color: '#7aaa8a' }}>
          {streak === 0 ? 'Complete a task to start your streak' :
            nextMilestoneStreak ? `${nextMilestoneStreak - streak} more days → ${nextMilestoneBonus}× bonus` : `Max bonus reached! 2.5× XP on every task`}
          {longestStreak > streak && longestStreak > 0 && <span style={{ marginLeft: 6, opacity: .6 }}>· best: {longestStreak}</span>}
        </div>
      </div>

      {/* Tier ladder with per-species XP bars */}
      <TierLadder treeData={treeData} />

      {/* Manage tree */}
      <ManageTree onRunReeval={onRunReeval} onRunSeed={onRunSeed} />

      {/* Granularity footer */}
      <div style={{ padding: '10px 14px 10px', background: 'rgba(245,244,240,.98)', borderTop: '1px solid rgba(0,0,0,.07)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['year', 'month', 'week'].map(g => (
            <button key={g} onClick={() => onGranChange(g)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: `1px solid ${gran === g ? 'rgba(26,90,60,.25)' : 'rgba(0,0,0,.1)'}`, background: gran === g ? 'rgba(26,90,60,.07)' : '#fff', fontFamily: 'var(--m)', fontSize: 11.5, color: gran === g ? '#1a5a3c' : '#7aaa8a', cursor: 'pointer', textTransform: 'capitalize', fontWeight: gran === g ? 600 : 400 }}>{g}</button>
          ))}
        </div>
        <div style={{ fontFamily: 'Instrument Serif,Georgia,serif', fontSize: 11, fontStyle: 'italic', color: '#9aaa8a', marginTop: 7, textAlign: 'center' }}>🌱 roots & legacy below ground</div>
      </div>
    </div>
  )
}
