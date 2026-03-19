'use client'

/**
 * TreeView — living trunk timeline (Forest for the Trees).
 * Loads data via GET /api/tree (NextAuth + service role), not browser Supabase.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

const SW = 4
const TOP = 50
const NOW = new Date().getFullYear()
const REL_H = 88
const ROOT_H = 260
const GRAN_PX = { year: 20, month: 5.5, week: 1.4 }
const SVG_ALPHA = 0.65

const spineColor = (tierNum) => {
  if (tierNum <= 10) return '#6a8a48'
  if (tierNum <= 20) return '#b0a888'
  if (tierNum <= 32) return '#607058'
  if (tierNum <= 45) return '#584830'
  if (tierNum <= 55) return '#4e3418'
  return '#7a3020'
}

const STATE_MAP = {
  growing: { tip: '🍃', mid: '🍃', label: 'Growing' },
  stunted: { tip: '🍂', mid: '🍂', label: 'Stunted' },
  done: { tip: '🌟', mid: '🍃', label: 'Done' },
  dormant: { tip: '❄️', mid: '🍂', label: 'Dormant' },
  pruned: { tip: '✂️', mid: null, label: 'Pruned' },
  'storm-fell': { tip: '💨', mid: null, label: 'Felled' },
  fractured: { tip: '⚡', mid: null, label: 'Fractured' },
  blighted: { tip: '🍂', mid: null, label: 'Blighted' },
  atrophied: { tip: '🩶', mid: null, label: 'Atrophied' },
  severed: { tip: '✂️', mid: null, label: 'Severed' },
}

const yOf = (yr, birthYear, yh) => TOP + (NOW + 1 - yr) * yh
const GY = (birthYear, yh) => yOf(birthYear, birthYear, yh) + yh * 2.2
const RZ = (birthYear, yh) => GY(birthYear, yh) + REL_H
const TH = (birthYear, yh) => RZ(birthYear, yh) + ROOT_H

const em = (emoji, x, y, size = 15) =>
  `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${size}" ` +
  `text-anchor="middle" dominant-baseline="middle" ` +
  `font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>`

function bPath(sy, side, sYr, eYr, cx, yh) {
  const dur = (eYr || NOW + 0.5) - sYr
  const hR = Math.min(dur * yh * 2.2 + 26, 158)
  const vR = Math.min(Math.max(0, dur - 0.5) * yh * 1.75, 145)
  const sx = cx + side * SW
  const ex = cx + side * hR
  const ey = sy - vR
  return {
    sx,
    sy,
    c1x: sx + side * hR * 0.52,
    c1y: sy,
    c2x: cx + side * hR * 0.87,
    c2y: sy - vR * 0.83,
    ex,
    ey,
  }
}

function ptOnCurve(p, t) {
  const m = 1 - t
  return {
    x: m ** 3 * p.sx + 3 * m ** 2 * t * p.c1x + 3 * m * t ** 2 * p.c2x + t ** 3 * p.ex,
    y: m ** 3 * p.sy + 3 * m ** 2 * t * p.c1y + 3 * m * t ** 2 * p.c2y + t ** 3 * p.ey,
  }
}

const yT = (yr, s, e) => Math.min((yr - s) / ((e || NOW + 0.5) - s), 0.94)

function buildSVG({ VW, birthYear, gran, branches, roots, rings, relationships, legacies, speciesTier }) {
  const yh = GRAN_PX[gran]
  const cx = VW / 2
  const gy = GY(birthYear, yh)
  const rz = RZ(birthYear, yh)
  const th = TH(birthYear, yh)
  const sTop = SW * 0.5
  const sBot = SW * 1.8
  const spC = spineColor(speciesTier)
  const MARGIN = 22
  const MY = Math.max(...roots.map((r) => r.years_ago), 1)

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${th}" style="display:block;width:100%;height:${th}px">`
  s += `<defs><clipPath id="cp"><rect x="0" y="0" width="${VW}" height="${th}"/></clipPath></defs>`
  s += `<g clip-path="url(#cp)">`

  s += `<rect x="0" y="0" width="${VW}" height="${gy}" fill="rgba(0,0,0,.22)"/>`
  s += `<rect x="0" y="${gy.toFixed(1)}" width="${VW}" height="${REL_H}" fill="rgba(72,34,10,.75)"/>`
  s += `<text x="14" y="${(gy + 13).toFixed(1)}" font-size="9" fill="rgba(220,155,80,.5)" font-family="Georgia,serif" font-style="italic" letter-spacing=".05em">relationships</text>`
  s += `<rect x="0" y="${(gy - 7).toFixed(1)}" width="${VW}" height="10" fill="rgba(22,52,8,.9)"/>`
  s += `<line x1="0" y1="${rz.toFixed(1)}" x2="${VW}" y2="${rz.toFixed(1)}" stroke="rgba(100,45,8,.5)" stroke-width=".8" stroke-dasharray="4 7"/>`
  s += `<rect x="0" y="${rz.toFixed(1)}" width="${VW}" height="${ROOT_H}" fill="rgba(20,7,1,.93)"/>`
  s += `<text x="14" y="${(rz + 13).toFixed(1)}" font-size="9" fill="rgba(160,85,35,.42)" font-family="Georgia,serif" font-style="italic" letter-spacing=".05em">roots</text>`

  s += `<g opacity="${SVG_ALPHA}">`
  s += `<path d="M${(cx - sTop).toFixed(1)},${TOP} C${(cx - sTop).toFixed(1)},${TOP + 60} ${(cx - sBot).toFixed(1)},${gy - 90} ${(cx - sBot).toFixed(1)},${gy.toFixed(1)} L${(cx + sBot).toFixed(1)},${gy.toFixed(1)} C${(cx + sBot).toFixed(1)},${gy - 90} ${(cx + sTop).toFixed(1)},${TOP + 60} ${(cx + sTop).toFixed(1)},${TOP} Z" fill="${spC}"/>`
  s += `<rect x="${(cx - sBot * 0.9).toFixed(1)}" y="${(gy - 2).toFixed(1)}" width="${(sBot * 1.8).toFixed(1)}" height="${(REL_H + 6).toFixed(1)}" rx="2" fill="${spC}" opacity=".55"/>`
  s += `</g>`

  rings.forEach((r) => {
    const yy = yOf(r.year, birthYear, yh)
    if (yy >= gy || yy < TOP) return
    const frac = (gy - yy) / (gy - TOP)
    const wH = sTop + (sBot - sTop) * frac
    const rc =
      r.score >= 5 ? 'rgba(100,200,80,.65)' : r.score <= 2 ? 'rgba(0,0,0,.45)' : 'rgba(80,160,60,.5)'
    const rr = Math.max((r.ring_width / 18) * wH * 0.9, 0.35)
    s += `<line x1="${(cx - rr).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(cx + rr).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${rc}" stroke-width=".65"/>`
    if (gran === 'year') {
      const bw = Math.min(r.ring_width * 2, 32)
      s += `<rect x="${(cx - SW - 8 - bw).toFixed(1)}" y="${(yy - 1.8).toFixed(1)}" width="${bw}" height="3.2" rx="1.5" fill="rgba(80,180,60,.22)"/>`
    }
  })

  const labelYears = {
    year: [NOW, NOW - 3, NOW - 5, NOW - 7, NOW - 10, NOW - 15, NOW - 20, NOW - 25, NOW - 30],
    month: [NOW, NOW - 1, NOW - 2, NOW - 3, NOW - 5],
    week: [NOW, NOW - 1, NOW - 2],
  }[gran] || []

  rings.forEach((r) => {
    const yy = yOf(r.year, birthYear, yh)
    if (yy >= gy || yy < TOP) return
    if (labelYears.includes(r.year)) {
      s += `<text x="${(cx - SW - 11).toFixed(1)}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="rgba(255,255,255,.5)" font-family="Georgia,serif">${r.year}</text>`
    }
    if (r.chapter && gran === 'year') {
      s += `<text x="${(cx + SW + 11).toFixed(1)}" y="${(yy + 4).toFixed(1)}" text-anchor="start" font-size="12" fill="rgba(255,255,255,.55)" font-family="Georgia,serif" font-style="italic">${r.chapter}</text>`
    }
  })

  s += `<text x="${cx}" y="${TOP - 11}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,.6)" font-family="Georgia,serif" letter-spacing=".08em">Now</text>`

  const leftRels = relationships.filter((r) => r.side === 'left').slice(0, 2)
  const rightRels = relationships.filter((r) => r.side === 'right').slice(0, 2)
  const allRels = [
    ...leftRels.map((r, i) => ({ ...r, ox: MARGIN + 8 + i * 50, y: gy + 22 + i * 18 })),
    ...rightRels.map((r, i) => ({ ...r, ox: VW - MARGIN - 8 - i * 50, y: gy + 22 + i * 18 })),
  ]

  allRels.forEach((m) => {
    const isLeft = m.ox < cx
    const dormant = m.score <= 1
    const spineX = isLeft ? cx - sBot * 1.1 : cx + sBot * 1.1
    s += `<path d="M${spineX.toFixed(1)},${(gy + 6).toFixed(1)} Q${((m.ox + spineX) / 2).toFixed(1)},${(m.y - 6).toFixed(1)} ${m.ox.toFixed(1)},${m.y.toFixed(1)}" fill="none" stroke="rgba(100,165,235,${dormant ? 0.12 : 0.36})" stroke-width=".9" stroke-dasharray="2 3"/>`
    s += em('💧', m.ox, m.y, dormant ? 10 : 13)
    const lx = isLeft ? m.ox + 17 : m.ox - 17
    const ta = isLeft ? 'start' : 'end'
    s += `<text x="${lx.toFixed(1)}" y="${(m.y + 6).toFixed(1)}" text-anchor="${ta}" font-size="11" fill="rgba(120,175,235,${dormant ? 0.22 : 0.6})" font-family="Georgia,serif">${m.name}${dormant ? ' ❌' : ''}</text>`
  })

  branches.forEach((b) => {
    const sy = yOf(b.start_year, birthYear, yh)
    if (sy > gy) return
    const p = bPath(sy, b.side, b.start_year, b.end_year, cx, yh)
    const st = STATE_MAP[b.state] || STATE_MAP.growing
    const neg = ['pruned', 'storm-fell', 'blighted', 'fractured', 'atrophied', 'severed'].includes(b.state)
    const op = b.state === 'dormant' ? 0.18 : neg ? 0.42 : 0.72

    s += `<path d="M${p.sx},${p.sy} C${p.c1x.toFixed(1)},${p.c1y.toFixed(1)} ${p.c2x.toFixed(1)},${p.c2y.toFixed(1)} ${p.ex.toFixed(1)},${p.ey.toFixed(1)}" fill="none" stroke="${spC}" stroke-width="${1.3 + b.depth_factor * 0.25}" stroke-linecap="round" opacity="${op}"/>`

    if (st.mid) {
      const mid = ptOnCurve(p, 0.5)
      s += em(st.mid, mid.x, mid.y - 9, 13)
    }
    s += em(st.tip, p.ex, p.ey, 14)

    if (b.state === 'done') {
      s += `<ellipse cx="${p.ex.toFixed(1)}" cy="${p.ey.toFixed(1)}" rx="5" ry="4" fill="${spC}" stroke="rgba(255,255,255,.14)" stroke-width=".6"/>`
      s += em('🌟', p.ex + b.side * -18, p.ey - 2, 16)
    }

    const lPt = ptOnCurve(p, 0.82)
    s += `<text x="${(lPt.x + (b.side > 0 ? 13 : -13)).toFixed(1)}" y="${(lPt.y - 5).toFixed(1)}" text-anchor="${b.side > 0 ? 'start' : 'end'}" font-size="13" fill="rgba(255,255,255,${neg || b.state === 'dormant' ? 0.28 : 0.88})" font-family="Georgia,serif">${b.label}</text>`

    ;(b.fruits || []).forEach((f) => {
      const fp = ptOnCurve(p, yT(f.year, b.start_year, b.end_year))
      s += em(f.emoji, fp.x, fp.y, 15)
      s += `<text x="${(fp.x + (b.side > 0 ? 12 : -12)).toFixed(1)}" y="${(fp.y + 6).toFixed(1)}" text-anchor="${b.side > 0 ? 'start' : 'end'}" font-size="10" fill="rgba(255,255,220,.68)" font-family="Georgia,serif">${f.label}</text>`
    })
  })

  const rightLegs = legacies.filter((l) => l.side > 0)
  const leftLegs = legacies.filter((l) => l.side < 0)
  const STEP = 22

  rightLegs.forEach((l, i) => {
    const x = cx + SW * 2 + 12 + i * STEP
    s += `<line x1="${x}" y1="${(gy - 1).toFixed(1)}" x2="${x}" y2="${(gy - 11).toFixed(1)}" stroke="rgba(80,160,40,.5)" stroke-width=".8"/>`
    s += em('🌱', x, gy - 5, 14)
    s += `<text x="${x}" y="${(gy - 20).toFixed(1)}" text-anchor="middle" font-size="10" fill="rgba(140,220,100,.75)" font-family="Georgia,serif">${l.label}</text>`
  })
  leftLegs.forEach((l, i) => {
    const x = cx - SW * 2 - 12 - i * STEP
    s += `<line x1="${x}" y1="${(gy - 1).toFixed(1)}" x2="${x}" y2="${(gy - 11).toFixed(1)}" stroke="rgba(80,160,40,.5)" stroke-width=".8"/>`
    s += em('🌱', x, gy - 5, 14)
    s += `<text x="${x}" y="${(gy - 20).toFixed(1)}" text-anchor="middle" font-size="10" fill="rgba(140,220,100,.75)" font-family="Georgia,serif">${l.label}</text>`
  })

  const maxRL = ROOT_H * 0.82
  const minRL = 44
  roots.forEach((r) => {
    const L = minRL + (r.years_ago / MY) * (maxRL - minRL)
    const hR = Math.min(r.years_ago * 4 + 28, cx * 0.86)
    const sx = cx + r.side * sBot * 0.9
    const sy = rz
    const ex = cx + r.side * hR
    const ey = rz + Math.sin((r.angle * Math.PI) / 180) * L * 0.88
    const c1x = sx + r.side * hR * 0.45
    const c2x = cx + r.side * hR * 0.88
    const c2y = rz + Math.sin((r.angle * Math.PI) / 180) * L * 0.6

    s += `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} C${c1x.toFixed(1)},${sy.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${spC}" stroke-width="${1.1 + r.depth_factor * 0.22}" stroke-linecap="round" opacity=".65"/>`
    s += em('🥕', ex, ey, 13)

    const ta = r.side > 0 ? 'start' : 'end'
    const lx = ex + (r.side > 0 ? 9 : -9)
    s += `<text x="${lx}" y="${(ey - 3).toFixed(1)}" text-anchor="${ta}" font-size="12" fill="rgba(215,165,80,.85)" font-family="Georgia,serif">${r.label}</text>`
    s += `<text x="${lx}" y="${(ey + 11).toFixed(1)}" text-anchor="${ta}" font-size="10" fill="rgba(175,115,45,.5)" font-family="Georgia,serif" font-style="italic">${r.origin_year} · ${r.years_ago}y · +${Math.round(r.years_ago * r.score * 0.4)} XP</text>`
  })

  s += `</g></svg>`
  return s
}

const wrap = {
  outer: {
    position: 'relative',
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 'var(--r2)',
    border: '1px solid var(--gb2)',
    background: 'var(--glass)',
    backdropFilter: 'blur(16px)',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative',
    minWidth: 0,
    scrollbarWidth: 'thin',
  },
  zoomBtn: {
    width: 28,
    height: 28,
    fontSize: 13,
    background: 'rgba(0,0,0,.5)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
  },
  granBtn: (on) => ({
    fontSize: 10,
    padding: '3px 8px',
    borderRadius: 999,
    border: on ? '1px solid var(--gb2)' : '1px solid rgba(255,255,255,.2)',
    background: on ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.4)',
    color: on ? 'var(--txt)' : 'rgba(255,255,255,.85)',
    cursor: 'pointer',
    fontFamily: 'var(--m)',
    textTransform: 'capitalize',
  }),
}

export default function TreeView({ userId }) {
  const hostRef = useRef(null)
  const scrollRef = useRef(null)
  const roRef = useRef(null)

  const [gran, setGran] = useState('year')
  const [zoom, setZoom] = useState(1)
  const [speciesData, setSpeciesData] = useState(null)
  const [branches, setBranches] = useState([])
  const [roots, setRoots] = useState([])
  const [rings, setRings] = useState([])
  const [rels, setRels] = useState([])
  const [legacies, setLegacies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/tree', { credentials: 'include' })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || res.statusText)
        if (cancelled) return
        setSpeciesData(j.species)
        setBranches(j.branches || [])
        setRoots(j.roots || [])
        setRings(j.rings || [])
        setRels(j.relationships || [])
        setLegacies(j.legacies || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load tree')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const render = useCallback(() => {
    if (!hostRef.current || !speciesData) return
    const VW = scrollRef.current?.getBoundingClientRect().width || 520
    const svg = buildSVG({
      VW,
      birthYear: speciesData.birth_year,
      gran,
      branches,
      roots,
      rings,
      relationships: rels,
      legacies,
      speciesTier: speciesData.current_tier,
    })
    hostRef.current.innerHTML = svg
    hostRef.current.style.transform = `scale(${zoom})`
    hostRef.current.style.transformOrigin = 'top left'
  }, [gran, zoom, speciesData, branches, roots, rings, rels, legacies])

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    if (!scrollRef.current) return
    roRef.current = new ResizeObserver(render)
    roRef.current.observe(scrollRef.current)
    return () => roRef.current?.disconnect()
  }, [render])

  const dz = (f) => setZoom((z) => (f === 0 ? 1 : Math.max(0.4, Math.min(4, z * f))))

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: 12,
          color: 'var(--txt3)',
          fontFamily: 'var(--m)',
        }}
      >
        Growing your tree…
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          fontSize: 12,
          color: 'var(--danger)',
          fontFamily: 'var(--m)',
          lineHeight: 1.5,
        }}
      >
        {error}
        <div style={{ marginTop: 8, color: 'var(--txt3)', fontSize: 11 }}>
          Run the tree section of <code style={{ fontFamily: 'var(--m)' }}>supabase-schema.sql</code> if tables are missing.
        </div>
      </div>
    )
  }

  if (!speciesData) return null

  const speciesPhoto = speciesData.species_slug
    ? `/species/${speciesData.species_slug}.jpg`
    : '/species/bristlecone.jpg'

  return (
    <div style={wrap.outer}>
      <div ref={scrollRef} style={wrap.scroll}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            width: '100%',
            height: 680,
            backgroundImage: `url('${speciesPhoto}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 28%',
            marginBottom: -680,
            zIndex: 0,
          }}
        />
        <div ref={hostRef} style={{ zIndex: 1, position: 'relative', width: '100%', overflow: 'hidden' }} />
      </div>

      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4, zIndex: 10 }}>
        {[
          ['＋', () => dz(1.25)],
          ['－', () => dz(0.8)],
          ['↺', () => dz(0)],
        ].map(([label, fn]) => (
          <button key={label} type="button" onClick={fn} style={wrap.zoomBtn}>
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 32,
          right: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}
      >
        {['year', 'month', 'week'].map((g) => (
          <button key={g} type="button" onClick={() => setGran(g)} style={wrap.granBtn(gran === g)}>
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}

export function useTreeData(userId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/tree', { credentials: 'include' })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || res.statusText)
        if (cancelled) return
        setData({
          species: j.species,
          branches: j.branches || [],
          roots: j.roots || [],
          rings: j.rings || [],
          relationships: j.relationships || [],
          legacies: j.legacies || [],
        })
      } catch (e) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { data, loading, error }
}
