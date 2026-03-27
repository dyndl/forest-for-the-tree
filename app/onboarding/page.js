'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'

const STEPS = ['welcome', 'roadmap', 'areas', 'outline', 'schedule', 'oura', 'whisper', 'relationships', 'ai_connect', 'done']
const ADDON_STEPS = { oura: 'oura', whisper: 'whisper' } // deepgram has no setup step — app holds the key

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

const ADDON_CATEGORIES = [
  {
    label: 'Fitness',
    addons: [
      { id: 'oura',     icon: '💍', label: 'Oura Ring',        cost: 'Free w/ membership', desc: 'Readiness, sleep, and stress scores shape how your COO schedules each day.' },
    ],
  },
  {
    label: 'Voice',
    addons: [
      { id: 'deepgram', icon: '🎙️', label: 'Voice memos',      cost: 'Included free', recommended: true, desc: 'Capture thoughts by voice — up to 4 min per clip. Transcribed via Deepgram Nova-3, piped to your agents.' },
      { id: 'whisper',  icon: '🔊', label: 'Whisper (OpenAI)', cost: 'Your OpenAI key',               desc: 'Already on OpenAI? Use your own key. Clips capped at 1 min.' },
    ],
  },
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
function WelcomeStep({ data, onChange, onNext, onRestore, isRefresh }) {
  const tier = data.integration_tier || 'google'
  const addons = data.addons || []
  const toggleAddon = (id) =>
    onChange('addons', addons.includes(id) ? addons.filter(a => a !== id) : [...addons, id])
  const [hasBackup, setHasBackup] = useState(false)
  useEffect(() => {
    try { setHasBackup(!!localStorage.getItem(BACKUP_KEY)) } catch {}
  }, [])

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{isRefresh ? '🌳' : '🌲'}</div>
        <h1 style={{ ...serif, fontSize: 26, color: '#182e22', marginBottom: 6, fontStyle: 'italic' }}>
          {isRefresh ? 'Update your profile' : 'Forest for the Tree'}
        </h1>
        <p style={{ ...mono, fontSize: 9, color: '#7aaa8a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {isRefresh ? 'REFRESH YOUR COO' : 'Your autonomous life COO'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
          {ADDON_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7aaa8a', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', marginBottom: 5 }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cat.addons.map(a => (
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
                      {a.recommended && (
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#2d7a52', background: 'rgba(45,122,82,0.1)', borderRadius: 4, padding: '1px 5px', fontFamily: 'Figtree, sans-serif', letterSpacing: '0.04em' }}>
                          RECOMMENDED
                        </span>
                      )}
                      <span style={{ ...mono, fontSize: 9, color: a.cost === 'Included free' ? '#2d7a52' : '#7aaa8a', marginLeft: 'auto' }}>{a.cost}</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#7aaa8a', margin: '3px 0 0 23px', lineHeight: 1.4, fontFamily: 'Figtree, sans-serif' }}>
                      {a.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button style={btnPrimary} onClick={onNext}>Get started →</button>
      {hasBackup && (
        <button style={{ ...btnGhost, marginTop: 8, fontSize: 11, color: '#5a7a68' }} onClick={() => { onRestore(); setHasBackup(false) }}>
          ↩ Restore from last session
        </button>
      )}
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
        <p style={{ fontSize: 11, color: '#7aaa8a', marginTop: 6, lineHeight: 1.5, fontFamily: 'Figtree, sans-serif' }}>
          Don't worry about getting this perfect — you can update your goals and add more detail any time from your profile.
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={label9}>Energy profile — rough starting point</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 8 }}>
          {[
            { value: 'early',    label: '🌅 Early bird',     sub: 'Best before 10am' },
            { value: 'standard', label: '☀️ Standard',        sub: 'Best 9am–12pm' },
            { value: 'late',     label: '🌇 Late starter',    sub: 'Warms up after 10am' },
            { value: 'variable', label: '🌀 Variable',         sub: 'Day to day' },
          ].map(({ value, label, sub }) => {
            const sel = (data.peak_hours || 'standard') === value
            return (
              <button key={value} onClick={() => onChange('peak_hours', value)} style={{
                flex: '1 1 44%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${sel ? '#1a5a3c' : 'rgba(122,170,138,0.25)'}`,
                background: sel ? 'rgba(26,90,60,0.07)' : 'transparent', transition: 'all .15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#182e22', fontFamily: 'Figtree, sans-serif' }}>{label}</div>
                <div style={{ fontSize: 10, color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{sub}</div>
              </button>
            )
          })}
        </div>
        <textarea
          style={{ ...inputStyle, resize: 'none' }}
          rows={2}
          value={data.rhythm_notes || ''}
          onChange={e => onChange('rhythm_notes', e.target.value)}
          placeholder="Anything else about your rhythm? e.g. need 30 min to wake up, crash after lunch, work in bursts…"
        />
        <div style={{ fontSize: 10, color: '#9abba8', lineHeight: 1.5, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
          The COO uses this as a starting point and refines it through your daily check-ins and actions.
        </div>
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


const AGENT_QUIPS = [
  'Reading between the lines…',
  'Mapping your goals to the forest…',
  'Assembling your team of agents…',
  'Cross-referencing your patterns…',
  'Calibrating your COO…',
  'Thinking like your best self…',
  'Connecting the dots…',
  'Planting the seeds…',
  'Building your operating system…',
  'Almost there — good things take a moment…',
]

// ══ STEP 4: OUTLINE — write or upload ══════════════════════════════════════════
function OutlineStep({ data, onChange, onNext, onBack }) {
  const [attachments, setAttachments] = useState([]) // { id, name, status: 'extracting'|'done'|'error', text?, errorMsg? }
  const [generating, setGenerating] = useState(false)
  const [quipIdx, setQuipIdx] = useState(0)
  const [error, setError] = useState('')
  const [previewAgents, setPreviewAgents] = useState(null)

  useEffect(() => {
    if (!generating) return
    setQuipIdx(0)
    const t = setInterval(() => setQuipIdx(i => (i + 1) % AGENT_QUIPS.length), 2800)
    return () => clearInterval(t)
  }, [generating])

  const anyExtracting = attachments.some(a => a.status === 'extracting')
  const allDone = attachments.length > 0 && !anyExtracting
  const doneCount = attachments.filter(a => a.status === 'done').length

  function getFullContext() {
    const parts = [
      data.outline,
      ...attachments.filter(a => a.status === 'done').map(a => a.text),
    ].filter(Boolean)
    return parts.join('\n\n---\n\n')
  }

  const MAX_FILES = 5

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    if (!selected.length) return
    const remaining = MAX_FILES - attachments.length
    if (remaining <= 0) { setError(`Maximum ${MAX_FILES} files — remove one to add more`); return }
    const files = selected.slice(0, remaining)
    if (files.length < selected.length) setError(`Added ${files.length} of ${selected.length} — limit is ${MAX_FILES} files total`)
    else setError('')
    const newAttachments = files.map(file => ({
      id: Math.random().toString(36).slice(2) + Date.now(),
      name: file.name,
      status: 'extracting',
    }))
    setAttachments(prev => [...prev, ...newAttachments])
    files.forEach((file, i) => extractFile(file, newAttachments[i].id))
  }

  async function extractFile(file, id) {
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/onboarding/extract-outline', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'done', text: json.text } : a))
    } catch (err) {
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'error', errorMsg: err.message } : a))
    }
  }

  async function generatePreview() {
    const context = getFullContext()
    if (!context.trim()) { setError('Add some context first'); return }
    onChange('outline', context)
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/onboarding/generate-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: context,
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

  if (generating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 28 }}>
        {/* Progress ring */}
        <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(122,170,138,0.18)" strokeWidth={4} />
          <circle
            cx={32} cy={32} r={26} fill="none"
            stroke="#2d7a52" strokeWidth={4}
            strokeDasharray="163.4" strokeDashoffset="40"
            strokeLinecap="round"
            style={{ animation: 'spin 1.4s linear infinite', transformOrigin: '32px 32px' }}
          />
        </svg>
        {/* Rotating quip */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ ...serif, fontSize: 17, color: '#182e22', fontStyle: 'italic', marginBottom: 6, transition: 'opacity .3s' }}>
            {AGENT_QUIPS[quipIdx]}
          </p>
          <p style={{ fontSize: 11, color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace' }}>
            building your agents
          </p>
        </div>
      </div>
    )
  }

  const hasContext = !!(data.outline?.trim() || doneCount > 0)

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
        Tell the COO about your life
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6 }}>
        Write a free-form outline or drop files — or both. The more context you give, the more personalised your agents will be.
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

      {/* File upload button */}
      <div style={{ marginBottom: attachments.length ? 10 : 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8,
          cursor: attachments.length >= MAX_FILES ? 'not-allowed' : 'pointer',
          border: '1px dashed rgba(122,170,138,0.4)', fontSize: 12, color: '#7aaa8a',
          fontFamily: 'Figtree, sans-serif', background: 'rgba(45,122,82,0.03)',
          opacity: attachments.length >= MAX_FILES ? 0.4 : 1,
        }}>
          📎 Attach files
          <input type="file" multiple accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.gif,image/*" style={{ display: 'none' }} onChange={handleFileSelect} disabled={attachments.length >= MAX_FILES} />
        </label>
        <span style={{ fontSize: 10, color: 'rgba(122,170,138,0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
          {attachments.length > 0 ? `${attachments.length} / ${MAX_FILES} files` : `up to ${MAX_FILES} · .txt .md .pdf image`}
        </span>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', borderRadius: 8,
              background: a.status === 'error' ? 'rgba(138,40,40,0.06)' : 'rgba(45,90,61,0.06)',
              border: `1px solid ${a.status === 'error' ? 'rgba(138,40,40,0.15)' : 'rgba(122,170,138,0.2)'}`,
            }}>
              {/* Status indicator */}
              {a.status === 'extracting' && <div className="spin" style={{ flexShrink: 0 }} />}
              {a.status === 'done' && (
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#2d7a52', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={8} height={6} viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {a.status === 'error' && (
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#8a2828', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: '#fff', fontWeight: 700 }}>!</div>
              )}
              <span style={{ fontSize: 12, color: '#2d4a35', fontFamily: 'Figtree, sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
              </span>
              <span style={{ fontSize: 10, color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                {a.status === 'extracting' ? 'reading…' : a.status === 'done' ? 'ready' : a.errorMsg || 'failed'}
              </span>
              <button
                onClick={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'rgba(122,170,138,0.5)', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                title="Remove"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* "All done" banner */}
      {allDone && doneCount > 0 && !generating && (
        <div style={{
          marginBottom: 14, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(45,90,61,0.08)', border: '1px solid rgba(45,122,61,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: '#2d4a35', fontFamily: 'Figtree, sans-serif' }}>
            {doneCount === 1 ? '1 file processed' : `${doneCount} files processed`} — ready to build your agents?
          </span>
          <button
            style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12, marginBottom: 0, whiteSpace: 'nowrap' }}
            onClick={generatePreview}
          >
            Build agents →
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>
          ⚠ {error}
        </div>
      )}

      {/* Primary CTA — shown when not waiting on all-done banner */}
      {(!allDone || doneCount === 0) && (
        <button
          style={{ ...btnPrimary, opacity: (!hasContext || generating) ? 0.5 : 1 }}
          onClick={generatePreview}
          disabled={!hasContext || generating || anyExtracting}
        >
          {anyExtracting ? 'Extracting files…' : 'Preview my agents →'}
        </button>
      )}
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: agents.length > 2 ? 'repeat(2, 1fr)' : '1fr',
        gap: 8,
        maxHeight: 380,
        overflowY: 'auto',
        marginBottom: 16,
        paddingRight: 2,
      }}>
        {agents.map(a => (
          <div key={a.id} style={{
            padding: '10px 12px', background: 'rgba(45,122,82,0.05)',
            border: '1px solid rgba(122,170,138,0.2)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#182e22', fontFamily: 'Figtree, sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
              </span>
              <button onClick={() => remove(a.id)} style={{
                border: 'none', background: 'transparent', flexShrink: 0,
                color: 'rgba(122,170,138,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
              }}>×</button>
            </div>
            <p style={{ fontSize: 10, color: '#5a7a68', lineHeight: 1.5, margin: 0, fontFamily: 'Figtree, sans-serif' }}>
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
        <label style={label9}>Check-in schedule</label>

        {/* Timed check-ins — toggle + time picker */}
        {[
          { key: 'morning_brief',     timeKey: 'morning_brief_time',     label: 'Morning brief',    def: '07:30' },
          { key: 'midday_checkin',    timeKey: 'midday_checkin_time',    label: 'Midday check-in',  def: '12:00' },
          { key: 'afternoon_checkin', timeKey: 'afternoon_checkin_time', label: 'Afternoon pulse',  def: '16:00' },
          { key: 'evening_retro',     timeKey: 'evening_retro_time',     label: 'Evening retro',    def: '19:00' },
        ].map(({ key, timeKey, label, def }) => {
          const on = data.notification_prefs?.[key] !== false
          const time = data.notification_prefs?.[timeKey] || def
          const setPrefs = patch => onChange('notification_prefs', { ...data.notification_prefs, ...patch })
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: on ? '#3a5c47' : '#9ab8a8', flex: 1, transition: 'color .2s' }}>{label}</span>
              {on && (
                <input
                  type="time"
                  value={time}
                  onChange={e => setPrefs({ [timeKey]: e.target.value })}
                  style={{
                    ...mono, fontSize: 11, color: '#1a5a3c', background: 'rgba(45,122,82,0.06)',
                    border: '1px solid rgba(122,170,138,0.25)', borderRadius: 5,
                    padding: '2px 6px', cursor: 'pointer', outline: 'none',
                  }}
                />
              )}
              <Toggle on={on} onChange={v => setPrefs({ [key]: v })} />
            </div>
          )
        })}

        {/* Nudge if 2+ core check-ins disabled */}
        {[
          data.notification_prefs?.morning_brief,
          data.notification_prefs?.midday_checkin,
          data.notification_prefs?.afternoon_checkin,
          data.notification_prefs?.evening_retro,
        ].filter(v => v === false).length >= 2 && (
          <div style={{ fontSize: 11, color: '#8a5a28', marginTop: 8, padding: '7px 10px', background: 'rgba(138,90,40,0.07)', borderRadius: 7, lineHeight: 1.5 }}>
            Fewer anchor points means the COO has less to work with. That's fine — just worth knowing.
          </div>
        )}

        {/* Non-timed alerts */}
        <div style={{ marginTop: 6 }}>
          {[
            ['urgent_alerts',  'Urgent agent alerts (immediate)'],
            ['birthday_alerts','Birthday alerts'],
          ].map(([key, lbl]) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)',
            }}>
              <span style={{ fontSize: 12, color: '#3a5c47' }}>{lbl}</span>
              <Toggle
                on={data.notification_prefs?.[key] !== false}
                onChange={v => onChange('notification_prefs', { ...data.notification_prefs, [key]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 5: OURA ══════════════════════════════════════════════════════════════
function OuraStep({ onNext, onBack, onSkip, initialStatus }) {
  // initialStatus comes from ?oura= URL param after OAuth redirect
  const [status, setStatus] = useState(initialStatus || null) // null | 'connected' | 'denied' | 'error'
  const [ouraData, setOuraData] = useState(null)

  // If we just came back from OAuth, fetch the stored data
  useEffect(() => {
    if (initialStatus === 'connected') {
      fetch('/api/oura').then(r => r.json()).then(d => {
        if (d.connected && d.data) setOuraData(d.data)
      }).catch(() => {})
    }
  }, [initialStatus])

  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>💍</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Connect your Oura Ring
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        Optional. Your readiness score lets the COO protect your energy on low days and push harder on strong ones.
      </p>

      {status !== 'connected' ? (
        <>
          {/* What you get */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {[
              ['Readiness score', 'COO protects your energy on low days'],
              ['Sleep quality',   'Adjust cognitive load based on last night'],
              ['Activity data',   'Factor movement into your scheduling'],
            ].map(([label, desc]) => (
              <div key={label} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(45,122,82,0.05)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2d4a35', fontFamily: 'Figtree, sans-serif', width: 100, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 11, color: '#5a7a68', fontFamily: 'Figtree, sans-serif' }}>{desc}</span>
              </div>
            ))}
          </div>

          {status === 'denied' && (
            <div style={{ fontSize: 11, color: '#8a5a28', marginBottom: 12, padding: '8px 12px', background: 'rgba(138,90,40,0.07)', borderRadius: 8 }}>
              Authorisation cancelled — you can connect Oura later from your profile.
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 12, padding: '8px 12px', background: 'rgba(138,40,40,0.07)', borderRadius: 8 }}>
              Something went wrong. Try again or skip for now.
            </div>
          )}

          {/* Single OAuth button — no API keys for user to find */}
          <a
            href="/api/oura/auth?return_to=/onboarding"
            style={{
              ...btnPrimary,
              display: 'block', textAlign: 'center', textDecoration: 'none',
              marginBottom: 8,
            }}
          >
            Connect with Oura →
          </a>
          <button style={btnGhost} onClick={onSkip}>Skip for now</button>
          <button style={btnGhost} onClick={onBack}>Back</button>
        </>
      ) : (
        <>
          <div style={{ padding: '12px 14px', background: 'rgba(15,110,86,0.08)', border: '1px solid rgba(15,110,86,0.2)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f6e56', marginBottom: ouraData ? 8 : 0 }}>✓ Oura connected</div>
            {ouraData?.readiness && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 500, color: '#182e22' }}>{ouraData.readiness.score}</div>
                  <div style={{ fontSize: 9, color: '#7aaa8a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>readiness</div>
                </div>
                {ouraData.sleep && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 22, fontWeight: 500, color: '#182e22' }}>{ouraData.sleep.score}</div>
                    <div style={{ fontSize: 9, color: '#7aaa8a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>sleep</div>
                  </div>
                )}
                <div style={{ flex: 1, fontSize: 11, color: '#3a5c47', lineHeight: 1.5, paddingLeft: 8 }}>
                  {ouraData.readiness.energy_note}
                </div>
              </div>
            )}
          </div>
          <button style={btnPrimary} onClick={onNext}>Continue →</button>
          <button style={btnGhost} onClick={onBack}>Back</button>
        </>
      )}
    </div>
  )
}

// ══ STEP 6b: WHISPER ═══════════════════════════════════════════════════════════
function WhisperStep({ onNext, onBack, onSkip }) {
  const [key, setKey]     = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]  = useState(false)
  const [error, setError]  = useState('')

  async function save() {
    if (!key.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openai_api_key: key.trim() }),
      })
      if (!res.ok) { setError('Failed to save key'); setLoading(false); return }
      setSaved(true)
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🎙️</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Voice memos via Whisper
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        Optional. Transcribes voice notes via OpenAI Whisper (~$0.006/min).
      </p>

      {!saved ? (
        <>
          <div style={{ padding: '10px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8, marginBottom: 14, fontSize: 11.5, color: '#3a5c47', lineHeight: 1.6 }}>
            <strong>Get your key:</strong><br />
            1. Go to <span style={{ ...mono, fontSize: 10 }}>platform.openai.com/api-keys</span><br />
            2. Create a new secret key → copy and paste below
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={label9}>OpenAI API key</label>
            <input
              style={inputStyle}
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-..."
              onKeyDown={e => e.key === 'Enter' && save()}
            />
          </div>
          {error && <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>⚠ {error}</div>}
          <button style={btnPrimary} onClick={save} disabled={loading || !key.trim()}>
            {loading ? 'Saving…' : 'Save key →'}
          </button>
          <button style={btnGhost} onClick={onSkip}>Skip for now</button>
        </>
      ) : (
        <>
          <div style={{ padding: '12px 14px', background: 'rgba(15,110,86,0.08)', border: '1px solid rgba(15,110,86,0.2)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f6e56' }}>✓ Key saved — voice memos enabled</div>
          </div>
          <button style={btnPrimary} onClick={onNext}>Continue →</button>
        </>
      )}
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 6d: AI CONNECT ═════════════════════════════════════════════════════════
function AiConnectStep({ data, onChange, onNext, onBack }) {
  const [geminiDraft, setGeminiDraft] = useState(data.gemini_api_key || '')
  const [anthropicDraft, setAnthropicDraft] = useState(data.anthropic_api_key || '')

  function handleNext() {
    if (geminiDraft.trim()) onChange('gemini_api_key', geminiDraft.trim())
    if (anthropicDraft.trim()) onChange('anthropic_api_key', anthropicDraft.trim())
    onNext()
  }

  const hasKey = geminiDraft.trim() || anthropicDraft.trim()
  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>✨</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Upgrade your AI
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        Your Forest is already running with the built-in AI. Add a free key for sharper, more personalised plans — or skip and add one later in Settings.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {/* Gemini */}
        <div style={{ padding: '12px 14px', background: 'rgba(26,90,60,0.05)', border: '1px solid rgba(26,90,60,0.12)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#182e22' }}>🔵 Gemini (Google)</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#0f6e56', background: 'rgba(15,110,86,0.1)', padding: '2px 7px', borderRadius: 10 }}>Free · no card</span>
          </div>
          <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5, marginBottom: 8 }}>
            Get a free key at aistudio.google.com — no credit card required.
          </div>
          <input
            value={geminiDraft}
            onChange={e => setGeminiDraft(e.target.value)}
            placeholder="AIza… (paste key here)"
            type="password"
            style={{ ...inputStyle, marginTop: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
          />
        </div>

        {/* Anthropic */}
        <div style={{ padding: '12px 14px', background: 'rgba(26,90,60,0.05)', border: '1px solid rgba(26,90,60,0.12)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#182e22' }}>🟣 Claude (Anthropic)</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#5a3a9a', background: 'rgba(90,58,154,0.1)', padding: '2px 7px', borderRadius: 10 }}>Premium</span>
          </div>
          <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5, marginBottom: 8 }}>
            Already on Anthropic? Use your own key for the highest quality plans.
          </div>
          <input
            value={anthropicDraft}
            onChange={e => setAnthropicDraft(e.target.value)}
            placeholder="sk-ant-… (paste key here)"
            type="password"
            style={{ ...inputStyle, marginTop: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
          />
        </div>
      </div>

      <button style={btnPrimary} onClick={handleNext}>
        {hasKey ? 'Save & continue →' : 'Maybe later →'}
      </button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 6c: RELATIONSHIPS ══════════════════════════════════════════════════════
function RelationshipsStep({ data, onChange, onNext, onBack }) {
  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🤝</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Relationship intelligence
      </h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
        No contact engineering needed. Your COO picks up names from your outline and conversations, then asks about a few people at a time.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          ['Inferred from context',  'I spot names in your notes and check in: "How close are you with [Name]?" — just tap Close, Friend, Acquaintance, or Skip.'],
          ['Birthday tracking',      '14-day advance warning — a Google Calendar alert fires on your phone.'],
          ['Overdue touchpoints',    "Surfaces people you haven't connected with, weighted by closeness."],
          ['Weekly Sunday nudge',    'A short prioritised list of who to reach out to — no guessing required.'],
        ].map(([title, desc]) => (
          <div key={title} style={{ padding: '9px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#182e22', marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label9}>Anyone specific to start with? (optional)</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical' }}
          rows={2}
          value={data.relationship_seeds || ''}
          onChange={e => onChange('relationship_seeds', e.target.value)}
          placeholder="e.g. my sister Sarah, manager David, old friend Marcus…"
        />
        <div style={{ fontSize: 10, color: '#9ab8a8', marginTop: 4, lineHeight: 1.5 }}>
          Your COO will ask about these first. Everyone else surfaces naturally over time.
        </div>
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ══ STEP 7: DONE — COO boot briefing ══════════════════════════════════════════
const SCAN_LABELS = [
  'Connecting to Gmail…',
  'Scanning Calendar…',
  'Reading Contacts…',
  'Checking Oura Ring…',
  'Building your plan…',
]

function DoneStep({ onFinish, saving, saveError }) {
  const [phase, setPhase]       = useState('scanning')   // 'scanning' | 'ready'
  const [briefing, setBriefing] = useState(null)
  const [approved, setApproved] = useState({})
  const [scanIdx, setScanIdx]   = useState(0)

  useEffect(() => {
    // Animate scan labels while waiting for the API
    const ticker = setInterval(() => setScanIdx(i => Math.min(i + 1, SCAN_LABELS.length - 1)), 1100)

    fetch('/api/coo/init')
      .then(r => r.json())
      .then(d => {
        clearInterval(ticker)
        setBriefing(d)
        // Approve all proposals by default
        const a = {}
        for (const p of (d.background_proposals || [])) a[p.id] = true
        setApproved(a)
        setPhase('ready')
      })
      .catch(() => { clearInterval(ticker); setPhase('ready') })

    return () => clearInterval(ticker)
  }, [])

  function handleFinish() {
    const approvedIds = Object.entries(approved).filter(([, v]) => v).map(([id]) => id)
    onFinish({ background_proposals: approvedIds })
  }

  // ── Scanning phase ──────────────────────────────────────────────────────────
  if (phase === 'scanning') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🌲</div>
        <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>
          Taking stock of your world…
        </h2>
        <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 18, lineHeight: 1.6 }}>
          Your COO is scanning what's available before giving you a plan.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
          {SCAN_LABELS.map((label, i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: i < scanIdx ? 'rgba(15,110,86,0.07)' : i === scanIdx ? 'rgba(45,122,82,0.04)' : 'transparent',
              opacity: i <= scanIdx ? 1 : 0.3,
              transition: 'all .5s',
            }}>
              <span style={{ width: 16, fontSize: 11, color: i < scanIdx ? '#0f6e56' : '#9ab8a8', flexShrink: 0 }}>
                {i < scanIdx ? '✓' : i === scanIdx ? '⟳' : '○'}
              </span>
              <span style={{ ...mono, fontSize: 11, color: i < scanIdx ? '#0f6e56' : '#3a5c47', textAlign: 'left' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ ...mono, fontSize: 10, color: '#b0c4b8' }}>
          This only happens once
        </div>
      </div>
    )
  }

  // ── Ready phase — COO briefing ──────────────────────────────────────────────
  return (
    <div>
      <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>🌲</div>
      <h2 style={{ ...serif, fontSize: 19, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>
        Your COO has the picture
      </h2>

      {/* Connected resources */}
      {briefing?.resources?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...label9, marginBottom: 5 }}>Connected</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {briefing.resources.map(r => (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '7px 10px', background: 'rgba(15,110,86,0.06)', borderRadius: 7,
              }}>
                <span style={{ fontSize: 11, color: '#0f6e56', flexShrink: 0, paddingTop: 1 }}>✓</span>
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#182e22', marginRight: 6 }}>{r.name}</span>
                  <span style={{ fontSize: 10.5, color: '#7aaa8a' }}>{r.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ETA + schedule steps */}
      <div style={{
        padding: '10px 12px', background: 'rgba(26,95,168,0.07)',
        border: '1px solid rgba(26,95,168,0.12)', borderRadius: 8, marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#144a85', marginBottom: 6 }}>
          🕐 {briefing?.eta || 'First brief ready tomorrow at 7:30am'}
        </div>
        {(briefing?.schedule_steps || []).map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ ...mono, fontSize: 9, color: '#144a85', paddingTop: 2, flexShrink: 0 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 11, color: '#3d6087', lineHeight: 1.5 }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Background proposals */}
      {(briefing?.background_proposals || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...label9, marginBottom: 5 }}>Background tasks I'd like to start</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {briefing.background_proposals.map(p => (
              <div key={p.id} style={{
                padding: '9px 10px', borderRadius: 8,
                background: approved[p.id] ? 'rgba(15,110,86,0.07)' : 'rgba(180,180,180,0.05)',
                border: `1px solid ${approved[p.id] ? 'rgba(15,110,86,0.2)' : 'rgba(180,180,180,0.2)'}`,
                transition: 'all .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#182e22', marginBottom: 3 }}>
                      {p.icon} {p.title}
                      {p.eta && (
                        <span style={{ ...mono, fontSize: 9, color: '#9ab8a8', marginLeft: 7, fontWeight: 400 }}>
                          {p.eta}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#5a7a68', lineHeight: 1.5 }}>{p.rationale}</div>
                  </div>
                  <Toggle
                    on={!!approved[p.id]}
                    onChange={v => setApproved(a => ({ ...a, [p.id]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9ab8a8', marginTop: 5, lineHeight: 1.5 }}>
            Toggle off anything you'd prefer I leave alone. Change anytime from settings.
          </div>
        </div>
      )}

      {saveError && (
        <div style={{ fontSize: 11, color: '#8a2828', padding: '8px 12px', background: 'rgba(138,40,40,0.07)', borderRadius: 8, marginBottom: 10 }}>
          Something went wrong saving your settings. Your data is safe — tap below to try again.
        </div>
      )}
      <button
        style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
        onClick={handleFinish}
        disabled={saving}
      >
        {saving ? 'Saving…' : saveError ? 'Retry →' : "Let's go →"}
      </button>
    </div>
  )
}

const DRAFT_KEY   = 'fftt_onboarding'
const BACKUP_KEY  = 'fftt_onboarding_backup'

const DEFAULT_FORM = {
  integration_tier: 'google',
  addons:           [],
  roadmap:          '',
  peak_hours:       'standard',
  rhythm_notes:     '',
  adhd_aware:       false,
  adhd_patterns:    [],
  coo_notes:        '',
  notification_prefs: {
    morning_brief:           true,  morning_brief_time:    '07:30',
    midday_checkin:          true,  midday_checkin_time:   '12:00',
    afternoon_checkin:       true,  afternoon_checkin_time:'16:00',
    evening_retro:           true,  evening_retro_time:    '19:00',
    urgent_alerts:           true,
    birthday_alerts:         true,
  },
  life_areas:          [],
  outline:             '',
  pending_agents:      [],
  relationship_seeds:  '',
}

// ══ MAIN CONTROLLER ════════════════════════════════════════════════════════════
function OnboardingPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isRefresh = searchParams.get('refresh') === 'true'
  const [step, setStep]               = useState('welcome')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [formData, setFormData]       = useState(DEFAULT_FORM)
  const [restored, setRestored]       = useState(false) // gate: don't save until restore is done
  const [ouraStatus, setOuraStatus]   = useState(null)  // captured before URL param is cleared

  // On mount: restore draft from localStorage → fallback to Supabase → mark ready to save
  useEffect(() => {
    const ouraParam = searchParams.get('oura')
    // Capture before replaceState clears the URL — OuraStep may not render until after
    if (ouraParam) setOuraStatus(ouraParam)

    async function restore() {
      // 1. Try localStorage first (most current — has live step position)
      try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
        if (saved?.formData) {
          setFormData(f => ({ ...f, ...saved.formData }))
          if (ouraParam) {
            setStep('oura')
            window.history.replaceState({}, '', '/onboarding')
          } else if (saved.step && saved.step !== 'welcome' && saved.step !== 'done') {
            setStep(saved.step)
          }
          setRestored(true)
          return
        }
      } catch { /* localStorage unavailable */ }

      // 2. Fallback: fetch saved settings from Supabase
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const { settings } = await res.json()
          // If already fully onboarded, send to app (skip in refresh mode)
          if (!isRefresh && settings?.onboarding_complete) {
            router.replace('/')
            return
          }
          // Pre-fill whatever was saved previously (any non-default value counts)
          const hasData = settings?.roadmap || settings?.outline || settings?.life_areas?.length
            || (settings?.peak_hours && settings.peak_hours !== 'standard')
            || settings?.addons?.length || settings?.rhythm_notes || settings?.coo_notes
          if (isRefresh || hasData) {
            setFormData(f => ({
              ...f,
              integration_tier:  settings.integration_tier  || f.integration_tier,
              addons:            settings.addons             || f.addons,
              roadmap:           settings.roadmap            || f.roadmap,
              peak_hours:        settings.peak_hours         || f.peak_hours,
              rhythm_notes:      settings.rhythm_notes       || f.rhythm_notes,
              adhd_aware:        settings.adhd_aware         ?? f.adhd_aware,
              adhd_patterns:     settings.adhd_patterns      || f.adhd_patterns,
              coo_notes:         settings.coo_notes          || f.coo_notes,
              outline:           settings.outline            || f.outline,
              life_areas:        settings.life_areas         || f.life_areas,
              notification_prefs:settings.notification_prefs || f.notification_prefs,
              relationship_seeds:settings.relationship_seeds || f.relationship_seeds,
            }))
          }
        }
      } catch { /* non-fatal — continue with defaults */ }

      if (ouraParam) {
        setStep('oura')
        window.history.replaceState({}, '', '/onboarding')
      }
      setRestored(true)
    }

    restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to localStorage — only after initial restore to avoid overwriting draft with defaults
  useEffect(() => {
    if (!restored || step === 'done') return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, formData })) } catch {}
  }, [step, formData, restored])

  // Persist to Supabase on each step advance — survives hot reloads and browser clears
  async function persistToServer(data) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_tier:   data.integration_tier,
          addons:             data.addons,
          roadmap:            data.roadmap,
          peak_hours:         data.peak_hours,
          rhythm_notes:       data.rhythm_notes,
          adhd_aware:         data.adhd_aware,
          adhd_patterns:      data.adhd_patterns,
          coo_notes:          data.coo_notes,
          outline:            data.outline,
          life_areas:         data.life_areas,
          notification_prefs: data.notification_prefs,
          relationship_seeds: data.relationship_seeds || '',
        }),
      })
    } catch { /* non-fatal */ }
  }

  async function startOver() {
    // Save snapshot before wiping so user can restore if they change their mind
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ formData, savedAt: new Date().toISOString() })) } catch {}
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    // Reset Supabase so restore effect doesn't repopulate the form on next login
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_FORM, onboarding_complete: false }),
    }).catch(() => {})
    signOut({ callbackUrl: '/' })
  }

  function restoreFromBackup() {
    try {
      const backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null')
      if (backup?.formData) {
        setFormData(f => ({ ...f, ...backup.formData }))
        localStorage.removeItem(BACKUP_KEY)
      }
    } catch {}
  }

  const set  = (key, val) => setFormData(f => ({ ...f, [key]: val }))
  const next = () => {
    persistToServer(formData) // fire-and-forget — localStorage is primary, this is backup
    let idx = STEPS.indexOf(step) + 1
    while (idx < STEPS.length && ADDON_STEPS[STEPS[idx]] && !formData.addons.includes(ADDON_STEPS[STEPS[idx]])) idx++
    setStep(STEPS[idx])
  }
  const back = () => {
    let idx = STEPS.indexOf(step) - 1
    while (idx >= 0 && ADDON_STEPS[STEPS[idx]] && !formData.addons.includes(ADDON_STEPS[STEPS[idx]])) idx--
    setStep(STEPS[idx])
  }

  async function finish(payload = {}) {
    setSaving(true)
    const weekly_time_budget = Object.fromEntries(
      formData.life_areas.map(a => [a.key, a.blocks * 15])
    )
    try {
      // Save settings — throw on non-OK so catch block fires instead of redirecting
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_tier:     formData.integration_tier,
          addons:               formData.addons,
          roadmap:              formData.roadmap,
          peak_hours:           formData.peak_hours,
          rhythm_notes:         formData.rhythm_notes,
          adhd_aware:           formData.adhd_aware,
          adhd_patterns:        formData.adhd_patterns,
          coo_notes:            formData.coo_notes,
          outline:              formData.outline,
          notification_prefs:   formData.notification_prefs,
          life_areas:           formData.life_areas,
          weekly_time_budget,
          relationship_seeds:   formData.relationship_seeds || '',
          background_proposals: payload.background_proposals || [],
          onboarding_complete:  true,
        }),
      })
      if (!res.ok) throw new Error(`Settings save failed: ${res.status}`)

      // Save generated agents (if any confirmed)
      if (formData.pending_agents?.length > 0) {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agents: formData.pending_agents, ...(isRefresh ? { merge_mode: true } : { replace_defaults: true }) }),
        })
      }

      // Evaluate starting Life Tree tier from career background (fire-and-forget)
      fetch('/api/tree/tier-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline:     formData.outline,
          roadmap:     formData.roadmap,
          life_areas:  formData.life_areas,
          ...(isRefresh && { force: true, only_increase: true }),
        }),
      }).catch(() => {})

      // Seed Life Tree branches/rings/roots/relationships/legacies from outline (fire-and-forget)
      fetch('/api/tree/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRefresh ? { force: true, outline: formData.outline } : {}),
      }).catch(() => {})

      // Only clear and redirect after confirmed save
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      router.push('/')
    } catch (err) {
      console.error('finish error:', err)
      setSaving(false)
      setSaveError(true)
      // Stay on done step — user can retry; data is still in localStorage
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16, overflowY: 'auto' }}>
        <div style={glassCard}>
          {step !== 'welcome' && step !== 'done' && <ProgressDots step={step} />}
          {step === 'welcome'       && <WelcomeStep data={formData} onChange={set} onNext={next} onRestore={restoreFromBackup} isRefresh={isRefresh} />}
          {step === 'roadmap'       && <RoadmapStep       data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'areas'         && <AreasStep         data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'outline'       && <OutlineStep      data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'schedule'      && <ScheduleStep      data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'oura'          && <OuraStep          onNext={next} onBack={back} onSkip={next} initialStatus={ouraStatus} />}
          {step === 'whisper'       && <WhisperStep       onNext={next} onBack={back} onSkip={next} />}
          {step === 'relationships' && <RelationshipsStep data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'ai_connect'   && <AiConnectStep    data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'done'          && <DoneStep          onFinish={finish} saving={saving} saveError={saveError} />}

          {/* Start over — shown on all steps except done, and not in refresh mode */}
          {step !== 'done' && !isRefresh && (
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(122,170,138,0.12)', textAlign: 'center' }}>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(122,170,138,0.5)', fontFamily: 'Figtree, sans-serif' }}
                >
                  Start over
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#5a7a68', fontFamily: 'Figtree, sans-serif' }}>Clear all progress?</span>
                  <button onClick={startOver} style={{ background: 'none', border: '1px solid rgba(138,40,40,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#8a2828', padding: '3px 10px', fontFamily: 'Figtree, sans-serif' }}>
                    Yes, start over
                  </button>
                  <button onClick={() => setConfirmReset(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#7aaa8a', fontFamily: 'Figtree, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function OnboardingPageWrapper() {
  return (
    <Suspense>
      <OnboardingPage />
    </Suspense>
  )
}
