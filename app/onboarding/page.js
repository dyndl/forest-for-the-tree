'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['welcome', 'roadmap', 'areas', 'outline', 'schedule', 'oura', 'relationships', 'done']

// ── Suggested life area starting points (user can edit/remove/add freely) ────
const AREA_SUGGESTIONS = [
  { key: 'deep_work',     label: 'Deep Work',         emoji: '🧠' },
  { key: 'health',        label: 'Health & Fitness',   emoji: '⚡' },
  { key: 'learning',      label: 'Learning',           emoji: '📚' },
  { key: 'relationships', label: 'Relationships',      emoji: '🤝' },
  { key: 'creativity',    label: 'Creativity',         emoji: '🎨' },
  { key: 'finance',       label: 'Finance',            emoji: '💰' },
  { key: 'admin',         label: 'Admin & Errands',    emoji: '📋' },
  { key: 'side_project',  label: 'Side Project',       emoji: '🚀' },
]

const ADHD_PATTERNS = [
  'avoidance', 'context-switching', 'underestimating-time',
  'hyperfocus', 'task-initiation', 'decision-fatigue', 'perfectionism',
]

const INTEGRATION_TIERS = [
  {
    id: 'zero',
    label: 'Zero integrations',
    icon: '🖥️',
    desc: 'Local only — no external accounts needed. Context saved to a local file.',
    features: ['Local task management', 'Manual schedule building', 'File-based context'],
  },
  {
    id: 'google',
    label: 'Google',
    icon: '🔵',
    desc: 'Google Calendar, Gmail, Tasks, Contacts, and Drive.',
    features: ['Auto schedule from Calendar', 'Gmail scanning', 'Google Tasks sync', 'Drive context storage'],
    recommended: true,
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    icon: '🟦',
    desc: 'Outlook Calendar, Teams, and OneDrive.',
    features: ['Auto schedule from Outlook', 'Teams notifications', 'OneDrive context storage'],
  },
]

const ADDON_OPTIONS = [
  { id: 'oura',   label: 'Oura Ring',      icon: '💍', cost: 'Free w/ Oura membership', desc: 'Readiness + sleep scores shape your daily cognitive load.' },
  { id: 'whisper', label: 'Voice memos',   icon: '🎙️', cost: '~$0.006/min',             desc: 'Transcribe voice notes via OpenAI Whisper.' },
]


// ── Shared styles ─────────────────────────────────────────────────────────────
const glassCard = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.9)',
  borderRadius: 20,
  padding: '28px 24px',
  width: '100%',
  maxWidth: 400,
  boxShadow: '0 20px 60px rgba(20,60,35,0.2)',
}
const serif = { fontFamily: 'Instrument Serif, Georgia, serif' }
const mono  = { fontFamily: 'JetBrains Mono, monospace' }

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(255,255,255,0.55)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#182e22',
  fontSize: 13,
  fontFamily: 'Figtree, sans-serif',
  outline: 'none',
  marginTop: 4,
  boxSizing: 'border-box',
}
const btnPrimary = {
  width: '100%',
  background: '#1a5a3c',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 0',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Figtree, sans-serif',
  marginTop: 16,
}
const btnGhost = {
  width: '100%',
  background: 'transparent',
  color: '#7aaa8a',
  border: 'none',
  borderRadius: 8,
  padding: '8px 0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Figtree, sans-serif',
  marginTop: 6,
}
const label9 = {
  ...mono,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#7aaa8a',
  display: 'block',
  marginBottom: 3,
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none',
        background: on ? '#1a5a3c' : 'rgba(122,170,138,0.3)',
        cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left .2s',
      }} />
    </button>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function ProgressDots({ step }) {
  const visible = STEPS.slice(0, -1)
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
      {visible.map((s, i) => (
        <div key={s} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i <= visible.indexOf(step) ? '#1a5a3c' : 'rgba(26,90,60,0.2)',
          transition: 'background .3s',
        }} />
      ))}
    </div>
  )
}

// ══ STEP 1: WELCOME + INTEGRATION TIER ════════════════════════════════════════
function WelcomeStep({ data, onChange, onNext }) {
  const tier = data.integration_tier || 'google'
  const addons = data.addons || []
  const toggleAddon = (id) =>
    onChange('addons', addons.includes(id) ? addons.filter(a => a !== id) : [...addons, id])

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌲</div>
        <h1 style={{ ...serif, fontSize: 26, color: '#182e22', marginBottom: 6, fontStyle: 'italic' }}>
          Forest for the Trees
        </h1>
        <p style={{ ...mono, fontSize: 9, color: '#7aaa8a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Your autonomous life COO
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label9}>Choose your integration tier</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {INTEGRATION_TIERS.map(t => (
            <button key={t.id} onClick={() => onChange('integration_tier', t.id)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${tier === t.id ? '#1a5a3c' : 'rgba(122,170,138,0.25)'}`,
              background: tier === t.id ? 'rgba(26,90,60,0.07)' : 'transparent',
              transition: 'all .15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#182e22', fontFamily: 'Figtree, sans-serif' }}>
                  {t.label}
                </span>
                {t.recommended && (
                  <span style={{ ...mono, fontSize: 8, color: '#1a5a3c', background: 'rgba(26,90,60,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                    RECOMMENDED
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#7aaa8a', margin: 0, lineHeight: 1.5, fontFamily: 'Figtree, sans-serif' }}>
                {t.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={label9}>Optional add-ons</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {ADDON_OPTIONS.map(a => (
            <button key={a.id} onClick={() => toggleAddon(a.id)} style={{
              textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${addons.includes(a.id) ? '#0f6e56' : 'rgba(122,170,138,0.2)'}`,
              background: addons.includes(a.id) ? 'rgba(15,110,86,0.06)' : 'transparent',
              transition: 'all .15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#182e22', fontFamily: 'Figtree, sans-serif' }}>
                  {a.label}
                </span>
                <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginLeft: 'auto' }}>{a.cost}</span>
              </div>
              <p style={{ fontSize: 11, color: '#7aaa8a', margin: '3px 0 0 23px', lineHeight: 1.4, fontFamily: 'Figtree, sans-serif' }}>
                {a.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button style={btnPrimary} onClick={onNext}>Get started →</button>
    </div>
  )
}

// ══ STEP 2: ROADMAP ════════════════════════════════════════════════════════════
function RoadmapStep({ data, onChange, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        What are you working toward?
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 18, lineHeight: 1.6 }}>
        Your COO uses this as a north star — it shapes how tasks get prioritised every day. Be specific.
      </p>

      <div style={{ marginBottom: 14 }}>
        <label style={label9}>Primary goal (4-week horizon)</label>
        <input
          style={inputStyle}
          value={data.roadmap}
          onChange={e => onChange('roadmap', e.target.value)}
          placeholder="e.g. Ship v1 of my app, get to 10k monthly revenue, run a 5k…"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={label9}>Best focus hours</label>
        <select
          style={inputStyle}
          value={data.peak_hours}
          onChange={e => onChange('peak_hours', e.target.value)}
        >
          <option value="6-8am, 12-2pm">Early bird — 6–8am and 12–2pm</option>
          <option value="8-10am, 2-4pm">8–10am and 2–4pm</option>
          <option value="9-11am, 3-5pm">9–11am and 3–5pm</option>
          <option value="10am-12pm, 4-6pm">Late starter — 10am–12pm and 4–6pm</option>
          <option value="1-3pm, 8-10pm">Afternoon/evening — 1–3pm and 8–10pm</option>
          <option value="custom">Custom (set after setup in Settings)</option>
        </select>
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 3: LIFE AREAS ═════════════════════════════════════════════════════════
function AreasStep({ data, onChange, onNext, onBack }) {
  const areas = data.life_areas || []
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('✦')

  function toggleSuggestion(s) {
    const exists = areas.find(a => a.key === s.key)
    if (exists) {
      onChange('life_areas', areas.filter(a => a.key !== s.key))
    } else {
      onChange('life_areas', [...areas, { ...s, blocks: 8 }])
    }
  }

  function addCustom() {
    if (!newLabel.trim()) return
    const key = newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (areas.find(a => a.key === key)) return
    onChange('life_areas', [...areas, { key, label: newLabel.trim(), emoji: newEmoji, blocks: 8 }])
    setNewLabel('')
    setNewEmoji('✦')
  }

  function updateBlocks(key, val) {
    onChange('life_areas', areas.map(a => a.key === key ? { ...a, blocks: parseInt(val) || 0 } : a))
  }

  function removeArea(key) {
    onChange('life_areas', areas.filter(a => a.key !== key))
  }

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        What areas does your life run on?
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 14, lineHeight: 1.6 }}>
        Pick from suggestions or add your own. Set a weekly block budget for each (1 block = 15 min).
      </p>

      <label style={label9}>Quick-add suggestions</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, marginTop: 4 }}>
        {AREA_SUGGESTIONS.map(s => {
          const active = !!areas.find(a => a.key === s.key)
          return (
            <button key={s.key} onClick={() => toggleSuggestion(s)} style={{
              padding: '5px 10px', borderRadius: 5,
              border: `1px solid ${active ? '#0f6e56' : 'rgba(122,170,138,0.3)'}`,
              background: active ? 'rgba(15,110,86,0.1)' : 'transparent',
              color: active ? '#0f6e56' : '#7aaa8a',
              fontSize: 11, cursor: 'pointer', fontFamily: 'Figtree, sans-serif',
              transition: 'all .15s',
            }}>
              {s.emoji} {s.label}
            </button>
          )
        })}
      </div>

      {areas.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={label9}>Weekly block budget (×15 min each)</label>
          {areas.map(a => (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 14, width: 20, flexShrink: 0 }}>{a.emoji}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#3a5c47' }}>{a.label}</span>
              <input
                type="number" min={0} max={80}
                value={a.blocks}
                onChange={e => updateBlocks(a.key, e.target.value)}
                style={{ ...inputStyle, width: 56, textAlign: 'center', marginTop: 0 }}
              />
              <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', width: 20 }}>×15</span>
              <button onClick={() => removeArea(a.key)} style={{
                border: 'none', background: 'transparent',
                color: 'rgba(122,170,138,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '10px 12px', background: 'rgba(45,122,82,0.04)', borderRadius: 8, marginBottom: 14 }}>
        <label style={label9}>Add a custom area</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input
            style={{ ...inputStyle, width: 40, textAlign: 'center', marginTop: 0, padding: '9px 4px' }}
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            maxLength={2}
          />
          <input
            style={{ ...inputStyle, flex: 1, marginTop: 0 }}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Area name…"
            onKeyDown={e => e.key === 'Enter' && addCustom()}
          />
          <button onClick={addCustom} style={{
            background: '#1a5a3c', color: '#fff', border: 'none',
            borderRadius: 8, padding: '0 14px', fontSize: 18, cursor: 'pointer',
            fontFamily: 'Figtree, sans-serif', flexShrink: 0,
          }}>+</button>
        </div>
      </div>

      {areas.length === 0 && (
        <p style={{ fontSize: 11, color: '#b0c4b8', textAlign: 'center', marginBottom: 8 }}>
          Select at least one area to continue
        </p>
      )}

      <button
        style={{ ...btnPrimary, opacity: areas.length === 0 ? 0.5 : 1 }}
        onClick={onNext}
        disabled={areas.length === 0}
      >
        Continue →
      </button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}


// ══ STEP 4: OUTLINE — write or upload ══════════════════════════════════════════
function OutlineStep({ data, onChange, onNext, onBack }) {
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [previewAgents, setPreviewAgents] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/onboarding/extract-outline', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Upload failed'); return }
      onChange('outline', json.text)
    } catch { setError('Upload failed — check your connection') }
    finally { setUploading(false) }
  }

  async function generatePreview() {
    if (!data.outline?.trim()) { setError('Add some context first'); return }
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/onboarding/generate-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: data.outline,
          life_areas: data.life_areas || [],
          roadmap: data.roadmap || '',
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); return }
      setPreviewAgents(json.agents)
      onChange('pending_agents', json.agents)
    } catch { setError('Generation failed — check your connection') }
    finally { setGenerating(false) }
  }

  if (previewAgents) {
    return (
      <AgentPreview
        agents={previewAgents}
        onEdit={setPreviewAgents}
        onConfirm={(agents) => { onChange('pending_agents', agents); onNext() }}
        onBack={() => setPreviewAgents(null)}
      />
    )
  }

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        Tell the COO about your life
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6 }}>
        Write a free-form outline or drop a file. The more context you give, the more personalised your agents will be. You can include goals, patterns, constraints, projects — anything relevant.
      </p>

      <div style={{ marginBottom: 10 }}>
        <label style={label9}>Your context</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
          rows={7}
          value={data.outline || ''}
          onChange={e => onChange('outline', e.target.value)}
          placeholder={`e.g.

I'm building a SaaS product while freelancing part-time. My biggest challenge is context-switching between client work and my own product. I work best in the mornings. I tend to over-engineer things and delay shipping.

I want to get to 10 paying customers in 4 weeks. I also want to run 3x a week and not let fitness slide during crunch periods...`}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <label style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
          border: '1px dashed rgba(122,170,138,0.4)', fontSize: 12, color: '#7aaa8a',
          fontFamily: 'Figtree, sans-serif', background: 'rgba(45,122,82,0.03)',
        }}>
          {uploading ? 'Extracting…' : '📄 Drop or upload .txt / .md / .pdf'}
          <input type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
        </label>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>
          ⚠ {error}
        </div>
      )}

      <button
        style={{ ...btnPrimary, opacity: (!data.outline?.trim() || generating) ? 0.5 : 1 }}
        onClick={generatePreview}
        disabled={!data.outline?.trim() || generating}
      >
        {generating ? 'Generating your agents…' : 'Preview my agents →'}
      </button>
      <button style={btnGhost} onClick={onNext}>Skip — I'll set up agents later</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ── Agent preview sub-component ───────────────────────────────────────────────
function AgentPreview({ agents, onEdit, onConfirm, onBack }) {
  function remove(id) { onEdit(agents.filter(a => a.id !== id)) }

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        Your agents
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 14, lineHeight: 1.6 }}>
        Generated from your outline. Remove any that don't fit — you can add more later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {agents.map(a => (
          <div key={a.id} style={{
            padding: '10px 12px', background: 'rgba(45,122,82,0.05)',
            border: '1px solid rgba(122,170,138,0.2)', borderRadius: 10,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#182e22', fontFamily: 'Figtree, sans-serif' }}>
                {a.name}
              </span>
              <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginLeft: 2 }}>{a.area}</span>
              <button onClick={() => remove(a.id)} style={{
                marginLeft: 'auto', border: 'none', background: 'transparent',
                color: 'rgba(122,170,138,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
              }}>×</button>
            </div>
            <p style={{ fontSize: 11, color: '#5a7a68', lineHeight: 1.5, margin: '0 0 4px 0', fontFamily: 'Figtree, sans-serif' }}>
              {a.prompt}
            </p>
            {a.rationale && (
              <p style={{ ...mono, fontSize: 9, color: '#7aaa8a', margin: 0, lineHeight: 1.4 }}>
                ↳ {a.rationale}
              </p>
            )}
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <p style={{ fontSize: 12, color: '#b0c4b8', textAlign: 'center', marginBottom: 12 }}>
          All agents removed — you can add custom ones later.
        </p>
      )}

      <button style={btnPrimary} onClick={() => onConfirm(agents)}>
        Confirm {agents.length > 0 ? `${agents.length} agent${agents.length > 1 ? 's' : ''}` : 'and continue'} →
      </button>
      <button style={btnGhost} onClick={onBack}>← Revise outline</button>
    </div>
  )
}

// ══ STEP 5: SCHEDULE & PATTERNS ════════════════════════════════════════════════
function ScheduleStep({ data, onChange, onNext, onBack }) {
  const toggle = (p) => {
    const current = data.adhd_patterns || []
    onChange('adhd_patterns', current.includes(p)
      ? current.filter(x => x !== p)
      : [...current, p])
  }

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        Tailor the COO's approach
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 18, lineHeight: 1.6 }}>
        The more context the COO has, the better it plans.
      </p>

      {/* ADHD-aware toggle */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '12px 14px', background: 'rgba(45,122,82,0.06)', borderRadius: 10,
        marginBottom: 16, gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#182e22', marginBottom: 3 }}>
            ADHD-aware mode
          </div>
          <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5 }}>
            Breaks tasks into ≤30 min chunks, protects context switches, and names patterns without judgment.
          </div>
        </div>
        <Toggle on={!!data.adhd_aware} onChange={v => onChange('adhd_aware', v)} />
      </div>

      {data.adhd_aware && (
        <div style={{ marginBottom: 16 }}>
          <label style={label9}>Patterns you recognise in yourself</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {ADHD_PATTERNS.map(p => {
              const selected = (data.adhd_patterns || []).includes(p)
              return (
                <button key={p} onClick={() => toggle(p)} style={{
                  padding: '5px 10px', borderRadius: 5,
                  border: `1px solid ${selected ? '#0f6e56' : 'rgba(122,170,138,0.3)'}`,
                  background: selected ? 'rgba(15,110,86,0.1)' : 'transparent',
                  color: selected ? '#0f6e56' : '#7aaa8a',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                  transition: 'all .15s',
                }}>
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={label9}>Anything else the COO should know?</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical' }}
          rows={3}
          value={data.coo_notes || ''}
          onChange={e => onChange('coo_notes', e.target.value)}
          placeholder="e.g. I lose focus after lunch, I work best with music, I tend to avoid emails…"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={label9}>Notification preferences</label>
        {[
          ['morning_brief',     'Morning brief (8am)'],
          ['midday_checkin',    'Midday check-in (12pm)'],
          ['afternoon_checkin', 'Afternoon pulse (4pm)'],
          ['evening_retro',     'Evening retro (7pm)'],
          ['urgent_alerts',     'Urgent agent alerts (immediate)'],
          ['birthday_alerts',   'Birthday alerts'],
        ].map(([key, lbl]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)',
          }}>
            <span style={{ fontSize: 12, color: '#3a5c47' }}>{lbl}</span>
            <Toggle
              on={data.notification_prefs?.[key] !== false}
              onChange={v => onChange('notification_prefs', { ...data.notification_prefs, [key]: v })}
            />
          </div>
        ))}
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 5: OURA ══════════════════════════════════════════════════════════════
function OuraStep({ onNext, onBack, onSkip }) {
  const [token, setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]  = useState(null)
  const [error, setError]    = useState('')

  async function connect() {
    if (!token.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/oura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Connection failed'); setLoading(false); return }
      setResult(data)
    } catch { setError('Network error — check your connection') }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>💍</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Connect your Oura Ring
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        Optional. Your readiness score lets the COO protect your energy on low days and push you on strong ones.
      </p>

      {!result ? (
        <>
          <div style={{ padding: '10px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8, marginBottom: 14, fontSize: 11.5, color: '#3a5c47', lineHeight: 1.6 }}>
            <strong>Get your token:</strong><br />
            1. Go to <span style={{ ...mono, fontSize: 10 }}>cloud.ouraring.com</span><br />
            2. Profile → Personal Access Tokens<br />
            3. Create token → copy and paste below
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={label9}>Personal access token</label>
            <input
              style={inputStyle}
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your Oura token here…"
              onKeyDown={e => e.key === 'Enter' && connect()}
            />
          </div>
          {error && (
            <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>
              ⚠ {error}
            </div>
          )}
          <button style={btnPrimary} onClick={connect} disabled={loading || !token.trim()}>
            {loading ? 'Connecting…' : 'Connect Oura →'}
          </button>
          <button style={btnGhost} onClick={onSkip}>Skip for now</button>
        </>
      ) : (
        <>
          <div style={{ padding: '12px 14px', background: 'rgba(15,110,86,0.08)', border: '1px solid rgba(15,110,86,0.2)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f6e56', marginBottom: 6 }}>✓ Connected successfully</div>
            {result.data?.readiness && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 500, color: '#182e22' }}>{result.data.readiness.score}</div>
                  <div style={{ fontSize: 9, color: '#7aaa8a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>readiness</div>
                </div>
                {result.data.sleep && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 22, fontWeight: 500, color: '#182e22' }}>{result.data.sleep.score}</div>
                    <div style={{ fontSize: 9, color: '#7aaa8a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>sleep</div>
                  </div>
                )}
                <div style={{ flex: 1, fontSize: 11, color: '#3a5c47', lineHeight: 1.5, paddingLeft: 8 }}>
                  {result.data.readiness.energy_note}
                </div>
              </div>
            )}
          </div>
          <button style={btnPrimary} onClick={onNext}>Continue →</button>
        </>
      )}
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 6: RELATIONSHIPS ══════════════════════════════════════════════════════
function RelationshipsStep({ onNext, onBack }) {
  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🤝</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Relationship intelligence
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        The COO reads your Google Contacts to track touchpoints and birthdays. No messages — just names, birthdays, and when you last connected.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[
          ['Birthday tracking',    '14-day advance warning → Google Calendar alert fires on your phone'],
          ['Overdue touchpoints',  "Flags people you haven't connected with based on your tier settings"],
          ['Weekly Sunday review', 'COO gives you a prioritised list of who to reach out to this week'],
          ['Mark as contacted',    'Tap "Reached out" → updates their last-contact date automatically'],
        ].map(([title, desc]) => (
          <div key={title} style={{ padding: '9px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#182e22', marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', background: 'rgba(26,95,168,0.07)', border: '1px solid rgba(26,95,168,0.15)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#144a85', lineHeight: 1.6 }}>
        <strong>One setup step:</strong> In Google Contacts, add a custom field to your important people:<br />
        Key: <span style={{ ...mono, fontSize: 10 }}>relationship_tier</span> → Value: <span style={{ ...mono, fontSize: 10 }}>close</span>, <span style={{ ...mono, fontSize: 10 }}>friend</span>, or <span style={{ ...mono, fontSize: 10 }}>acquaintance</span><br />
        The COO ignores untagged contacts.
      </div>

      <button style={btnPrimary} onClick={onNext}>Got it →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 7: DONE ══════════════════════════════════════════════════════════════
function DoneStep({ onFinish, saving }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌲</div>
      <h2 style={{ ...serif, fontSize: 22, color: '#182e22', marginBottom: 8, fontStyle: 'italic' }}>
        You're all set
      </h2>
      <p style={{ fontSize: 13, color: '#3a5c47', lineHeight: 1.7, marginBottom: 20 }}>
        Your COO will build your first schedule tomorrow morning at 7:30 am using your Calendar, Gmail, and Oura data. You'll get a Google Calendar notification when it's ready.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          '7:30am — COO reads your world and builds your day',
          'Open the app → Matrix shows your tasks as bubbles',
          'Schedule tab → Accept or veto each block',
          'Tap bubbles to mark tasks complete',
          'Check-ins at 12pm, 4pm, and 7pm',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 12px', background: 'rgba(45,122,82,0.05)', borderRadius: 7, textAlign: 'left' }}>
            <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', paddingTop: 2, flexShrink: 0 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 12, color: '#3a5c47', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
      <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={onFinish} disabled={saving}>
        {saving ? 'Saving…' : 'Open Forest for the Trees →'}
      </button>
    </div>
  )
}

// ══ MAIN CONTROLLER ════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router  = useRouter()
  const [step, setStep]     = useState('welcome')
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    integration_tier: 'google',
    addons:           [],
    roadmap:          '',
    peak_hours:       '9-11am, 3-5pm',
    adhd_aware:       false,
    adhd_patterns:    [],
    coo_notes:        '',
    notification_prefs: {
      morning_brief:     true,
      midday_checkin:    true,
      afternoon_checkin: true,
      evening_retro:     true,
      urgent_alerts:     true,
      birthday_alerts:   true,
    },
    life_areas:     [],
    outline:        '',
    pending_agents: [],
  })

  const set  = (key, val) => setFormData(f => ({ ...f, [key]: val }))
  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1])
  const back = () => setStep(STEPS[STEPS.indexOf(step) - 1])

  async function finish() {
    setSaving(true)
    const weekly_time_budget = Object.fromEntries(
      formData.life_areas.map(a => [a.key, a.blocks * 15])
    )
    try {
      // Save settings
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_tier:   formData.integration_tier,
          addons:             formData.addons,
          roadmap:            formData.roadmap,
          peak_hours:         formData.peak_hours,
          adhd_aware:         formData.adhd_aware,
          adhd_patterns:      formData.adhd_patterns,
          coo_notes:          formData.coo_notes,
          outline:            formData.outline,
          notification_prefs: formData.notification_prefs,
          life_areas:         formData.life_areas,
          weekly_time_budget,
          onboarding_complete: true,
        }),
      })
      // Save generated agents (if any confirmed)
      if (formData.pending_agents?.length > 0) {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agents: formData.pending_agents, replace_defaults: true }),
        })
      }
    } finally {
      router.push('/')
    }
    setSaving(false)
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16, overflowY: 'auto' }}>
        <div style={glassCard}>
          {step !== 'welcome' && step !== 'done' && <ProgressDots step={step} />}
          {step === 'welcome'       && <WelcomeStep data={formData} onChange={set} onNext={next} />}
          {step === 'roadmap'       && <RoadmapStep       data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'areas'         && <AreasStep         data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'outline'       && <OutlineStep      data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'schedule'      && <ScheduleStep      data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'oura'          && <OuraStep          onNext={next} onBack={back} onSkip={next} />}
          {step === 'relationships' && <RelationshipsStep onNext={next} onBack={back} />}
          {step === 'done'          && <DoneStep          onFinish={finish} saving={saving} />}
        </div>
      </div>
    </>
  )
}
