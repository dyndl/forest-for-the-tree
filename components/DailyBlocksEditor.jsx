'use client'
import { useState } from 'react'

const mono = { fontFamily: 'JetBrains Mono, monospace' }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABEL = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' }
const DAY_FULL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri']
const ALL_DAYS = [...DAYS]

const FLEX = [
  {
    value: 'strict',
    label: 'Strict',
    desc: 'Never schedule tasks here',
    color: '#8a2828',
    bg: 'rgba(138,40,40,0.09)',
    border: 'rgba(138,40,40,0.35)',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    desc: 'Prefer to avoid, may shift',
    color: '#1a5a3c',
    bg: 'rgba(26,90,60,0.09)',
    border: 'rgba(26,90,60,0.35)',
  },
  {
    value: 'aspiring',
    label: 'Aspiring',
    desc: 'Building toward this pattern',
    color: '#7a5a00',
    bg: 'rgba(122,90,0,0.09)',
    border: 'rgba(122,90,0,0.35)',
  },
]

const PRESETS = {
  early: [
    { id: 'e_sleep',     label: 'Sleep',             emoji: '💤', start: '21:30', end: '05:30', days: ALL_DAYS,  flexibility: 'strict',   category: 'sleep',   note: '' },
    { id: 'e_morning',   label: 'Wake & Get Ready',  emoji: '🌅', start: '05:30', end: '07:00', days: WEEKDAYS,  flexibility: 'flexible', category: 'morning', note: '' },
    { id: 'e_breakfast', label: 'Breakfast',         emoji: '🍳', start: '07:00', end: '07:30', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'e_work',      label: 'Work',              emoji: '🧠', start: '08:00', end: '16:00', days: WEEKDAYS,  flexibility: 'strict',   category: 'work',    note: '' },
    { id: 'e_lunch',     label: 'Lunch',             emoji: '🥗', start: '12:00', end: '12:45', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'e_dinner',    label: 'Dinner',            emoji: '🍽️', start: '17:30', end: '18:30', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'e_evening',   label: 'Wind Down',         emoji: '🌙', start: '20:00', end: '21:30', days: ALL_DAYS,  flexibility: 'aspiring', category: 'routine', note: '' },
  ],
  standard: [
    { id: 's_sleep',     label: 'Sleep',             emoji: '💤', start: '23:00', end: '07:00', days: ALL_DAYS,  flexibility: 'strict',   category: 'sleep',   note: '' },
    { id: 's_morning',   label: 'Wake & Get Ready',  emoji: '🌅', start: '07:00', end: '08:30', days: WEEKDAYS,  flexibility: 'flexible', category: 'morning', note: '' },
    { id: 's_breakfast', label: 'Breakfast',         emoji: '🍳', start: '08:30', end: '09:00', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 's_work',      label: 'Work',              emoji: '🧠', start: '09:00', end: '17:00', days: WEEKDAYS,  flexibility: 'strict',   category: 'work',    note: '' },
    { id: 's_lunch',     label: 'Lunch',             emoji: '🥗', start: '12:00', end: '12:45', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 's_dinner',    label: 'Dinner',            emoji: '🍽️', start: '18:30', end: '19:30', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 's_evening',   label: 'Wind Down',         emoji: '🌙', start: '21:30', end: '23:00', days: ALL_DAYS,  flexibility: 'aspiring', category: 'routine', note: '' },
  ],
  late: [
    { id: 'l_sleep',     label: 'Sleep',             emoji: '💤', start: '01:00', end: '09:00', days: ALL_DAYS,  flexibility: 'strict',   category: 'sleep',   note: '' },
    { id: 'l_morning',   label: 'Wake & Get Ready',  emoji: '🌅', start: '09:00', end: '10:30', days: WEEKDAYS,  flexibility: 'flexible', category: 'morning', note: '' },
    { id: 'l_breakfast', label: 'Breakfast',         emoji: '🍳', start: '10:30', end: '11:00', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'l_work',      label: 'Work',              emoji: '🧠', start: '11:00', end: '19:00', days: WEEKDAYS,  flexibility: 'strict',   category: 'work',    note: '' },
    { id: 'l_lunch',     label: 'Lunch',             emoji: '🥗', start: '13:30', end: '14:15', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'l_dinner',    label: 'Dinner',            emoji: '🍽️', start: '20:00', end: '21:00', days: ALL_DAYS,  flexibility: 'flexible', category: 'meal',    note: '' },
    { id: 'l_evening',   label: 'Wind Down',         emoji: '🌙', start: '23:00', end: '01:00', days: ALL_DAYS,  flexibility: 'aspiring', category: 'routine', note: '' },
  ],
}

function fmt12(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function BlockRow({ block, onChange, onRemove }) {
  const flex = FLEX.find(f => f.value === block.flexibility) || FLEX[1]
  const crossMidnight = block.end && block.start && block.end <= block.start

  return (
    <div style={{ padding: '12px 0', borderBottom: '0.5px solid rgba(122,170,138,0.18)' }}>
      {/* Row 1: emoji + label + times */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={block.emoji || ''}
          onChange={e => onChange('emoji', e.target.value)}
          style={{ width: 34, textAlign: 'center', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 7, padding: '5px 2px', fontSize: 15, outline: 'none', flexShrink: 0 }}
          maxLength={2}
        />
        <input
          value={block.label || ''}
          onChange={e => onChange('label', e.target.value)}
          placeholder="Label (e.g. Deep Work, Gym)"
          style={{ flex: 1, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 7, padding: '5px 8px', fontSize: 12, fontFamily: 'Figtree, sans-serif', color: '#182e22', outline: 'none' }}
        />
        <input
          type="time"
          value={block.start || ''}
          onChange={e => onChange('start', e.target.value)}
          style={{ ...mono, width: 88, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 7, padding: '5px 6px', fontSize: 11, color: '#182e22', outline: 'none' }}
        />
        <span style={{ ...mono, fontSize: 10, color: '#7aaa8a' }}>→</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <input
            type="time"
            value={block.end || ''}
            onChange={e => onChange('end', e.target.value)}
            style={{ ...mono, width: 88, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 7, padding: '5px 6px', fontSize: 11, color: '#182e22', outline: 'none' }}
          />
          {crossMidnight && (
            <span style={{ ...mono, fontSize: 9, color: '#7a5a00' }}>next day</span>
          )}
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: 'none', color: '#8a2828', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0, lineHeight: 1 }}
          title="Remove block"
        >×</button>
      </div>

      {/* Row 2: day toggles */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginRight: 4 }}>Days</span>
        {DAYS.map(d => {
          const on = (block.days || []).includes(d)
          return (
            <button
              key={d}
              title={DAY_FULL[d]}
              onClick={() => {
                const cur = block.days || []
                onChange('days', on ? cur.filter(x => x !== d) : [...cur, d])
              }}
              style={{
                ...mono, width: 24, height: 24, borderRadius: 5, fontSize: 10, cursor: 'pointer',
                border: `1px solid ${on ? '#0f6e56' : 'rgba(122,170,138,0.3)'}`,
                background: on ? 'rgba(15,110,86,0.12)' : 'transparent',
                color: on ? '#0f6e56' : '#7aaa8a',
                transition: 'all .12s', padding: 0,
              }}
            >
              {DAY_LABEL[d]}
            </button>
          )
        })}
        <button
          onClick={() => onChange('days', (block.days || []).length === 7 ? [] : [...DAYS])}
          style={{ ...mono, fontSize: 9, color: '#7aaa8a', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 4, padding: '0 2px' }}
        >{(block.days || []).length === 7 ? 'none' : 'all'}</button>
      </div>

      {/* Row 3: flexibility pills */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginRight: 2 }}>Type</span>
        {FLEX.map(f => {
          const active = block.flexibility === f.value
          return (
            <button
              key={f.value}
              title={f.desc}
              onClick={() => onChange('flexibility', f.value)}
              style={{
                ...mono, fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${active ? f.border : 'rgba(122,170,138,0.25)'}`,
                background: active ? f.bg : 'transparent',
                color: active ? f.color : '#7aaa8a',
                transition: 'all .12s',
              }}
            >{f.label}</button>
          )
        })}
        {block.flexibility === 'aspiring' && (
          <input
            value={block.note || ''}
            onChange={e => onChange('note', e.target.value)}
            placeholder="Optional: context or goal..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(122,90,0,0.25)', borderRadius: 5, padding: '3px 7px', fontSize: 10.5, fontFamily: 'Figtree, sans-serif', color: '#182e22', outline: 'none' }}
          />
        )}
      </div>
    </div>
  )
}

export default function DailyBlocksEditor({ blocks = [], onChange, compact = false }) {
  const [expanded, setExpanded] = useState(false)

  const updateBlock = (id, field, val) =>
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: val } : b))

  const addBlock = () => onChange([...blocks, {
    id: crypto.randomUUID(),
    label: '', emoji: '⏰', start: '09:00', end: '10:00',
    days: [], flexibility: 'flexible', category: 'custom', note: '',
  }])

  const removeBlock = id => onChange(blocks.filter(b => b.id !== id))

  const applyPreset = key => onChange(PRESETS[key].map(b => ({ ...b, id: crypto.randomUUID() })))

  // ── Compact mode (onboarding) ─────────────────────────────────────────────
  if (compact && !expanded) {
    const presetCards = [
      { key: 'early', emoji: '🌄', label: 'Early Bird', sub: 'Up by 5:30, work 8–4' },
      { key: 'standard', emoji: '☀️', label: 'Standard', sub: 'Up by 7, work 9–5' },
      { key: 'late', emoji: '🌜', label: 'Night Owl', sub: 'Up by 9, work 11–7' },
    ]
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {presetCards.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(255,255,255,0.7)', fontFamily: 'Figtree, sans-serif',
                border: '1px solid rgba(255,255,255,0.8)',
                transition: 'all .15s', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>{p.emoji}</div>
              <div style={{ ...mono, fontSize: 10, color: '#1a5a3c', fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: '#7aaa8a', marginTop: 2 }}>{p.sub}</div>
            </button>
          ))}
        </div>
        {blocks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {blocks.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '0.5px solid rgba(122,170,138,0.15)' }}>
                <span style={{ fontSize: 14 }}>{b.emoji}</span>
                <span style={{ fontSize: 11.5, color: '#182e22', flex: 1 }}>{b.label}</span>
                <span style={{ ...mono, fontSize: 10, color: '#7aaa8a' }}>{fmt12(b.start)}–{fmt12(b.end)}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setExpanded(true)}
          style={{ ...mono, background: 'transparent', border: 'none', color: '#7aaa8a', fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          {blocks.length > 0 ? '✏️ Customize blocks' : '+ Build manually'}
        </button>
      </div>
    )
  }

  // ── Full editor mode ──────────────────────────────────────────────────────
  return (
    <div>
      {compact && (
        <button
          onClick={() => setExpanded(false)}
          style={{ ...mono, background: 'transparent', border: 'none', color: '#7aaa8a', fontSize: 10, cursor: 'pointer', padding: '0 0 10px', display: 'block', textDecoration: 'underline' }}
        >← Back to presets</button>
      )}

      {blocks.length === 0 ? (
        <p style={{ fontSize: 11.5, color: '#7aaa8a', marginBottom: 10, lineHeight: 1.5 }}>
          No blocks yet. Add one below or{' '}
          {['Early Bird', 'Standard', 'Night Owl'].map((label, i) => {
            const key = ['early', 'standard', 'late'][i]
            return (
              <span key={key}>
                <button onClick={() => applyPreset(key)} style={{ background: 'transparent', border: 'none', color: '#1a5a3c', cursor: 'pointer', padding: 0, fontSize: 11.5, fontFamily: 'Figtree, sans-serif', textDecoration: 'underline' }}>{label}</button>
                {i < 2 ? ' / ' : ''}
              </span>
            )
          })}{' '}preset.
        </p>
      ) : (
        <div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {FLEX.map(f => (
              <span key={f.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: f.bg, border: `1px solid ${f.border}`, display: 'inline-block' }} />
                <span style={{ ...mono, fontSize: 9, color: f.color }}>{f.label} — {f.desc}</span>
              </span>
            ))}
          </div>
          {blocks.map(b => (
            <BlockRow
              key={b.id}
              block={b}
              onChange={(field, val) => updateBlock(b.id, field, val)}
              onRemove={() => removeBlock(b.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={addBlock}
        style={{ marginTop: 10, background: 'transparent', border: '1px dashed rgba(122,170,138,0.5)', borderRadius: 6, padding: '5px 12px', color: '#7aaa8a', fontSize: 11, cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}
      >+ Add block</button>
    </div>
  )
}
