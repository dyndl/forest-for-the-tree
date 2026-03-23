'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const mono = { fontFamily: 'JetBrains Mono, monospace' }

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(255,255,255,0.55)', borderRadius: 8,
  padding: '8px 11px', color: '#182e22', fontSize: 12.5,
  fontFamily: 'Figtree, sans-serif', outline: 'none', marginTop: 3,
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.74)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.88)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.3)' }}>
        <span style={{ ...mono, fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#7aaa8a' }}>{title}</span>
      </div>
      <div style={{ padding: '14px' }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)' }}>
      <span style={{ fontSize: 12, color: '#3a5c47' }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: value ? '#1a5a3c' : 'rgba(122,170,138,0.3)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left .2s' }} />
      </button>
    </div>
  )
}

export default function SettingsPanel() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState(null)
  const [oura, setOura] = useState(null)
  const [ouraToken, setOuraToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings))
    fetch('/api/oura').then(r => r.json()).then(d => setOura(d))
  }, [])

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))
  const setNotif = (key, val) => set('notification_prefs', { ...settings.notification_prefs, [key]: val })
  const setBudget = (key, val) => set('weekly_time_budget', { ...settings.weekly_time_budget, [key]: parseInt(val) || 0 })

  const setLifeArea = (idx, field, val) =>
    set('life_areas', (settings.life_areas || []).map((a, i) => i === idx ? { ...a, [field]: val } : a))
  const addLifeArea = () =>
    set('life_areas', [...(settings.life_areas || []), { key: '', label: '', emoji: '🎯', blocks: 4 }])
  const removeLifeArea = (idx) =>
    set('life_areas', (settings.life_areas || []).filter((_, i) => i !== idx))
  const addGoal = () => {
    if (!goalDraft.trim()) return
    set('financial_goals', [...(settings.financial_goals || []), goalDraft.trim()])
    setGoalDraft('')
  }
  const removeGoal = (idx) =>
    set('financial_goals', (settings.financial_goals || []).filter((_, i) => i !== idx))

  async function save() {
    setSaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function connectOura() {
    if (!ouraToken.trim()) return
    const res = await fetch('/api/oura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ouraToken.trim() }) })
    const data = await res.json()
    if (data.connected) { setOura(data); setOuraToken('') }
    else alert(data.error || 'Connection failed')
  }

  async function disconnectOura() {
    await fetch('/api/oura', { method: 'DELETE' })
    setOura({ connected: false })
  }

  if (!settings) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
      Loading settings…
    </div>
  )

  return (
    <div className="scroll" style={{ padding: '14px 16px' }}>

      <Section title="COO Profile">
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>4-week roadmap goal</label>
          <input style={inputStyle} value={settings.roadmap || ''} onChange={e => set('roadmap', e.target.value)} placeholder="What are you working toward?" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>Peak focus hours</label>
          <select style={inputStyle} value={settings.peak_hours || '9-11am, 3-5pm'} onChange={e => set('peak_hours', e.target.value)}>
            <option value="6-8am, 12-2pm">Early bird — 6–8am and 12–2pm</option>
            <option value="8-10am, 2-4pm">8–10am and 2–4pm</option>
            <option value="9-11am, 3-5pm">9–11am and 3–5pm</option>
            <option value="10am-12pm, 4-6pm">Late starter — 10am–12pm and 4–6pm</option>
            <option value="1-3pm, 8-10pm">Afternoon/evening — 1–3pm and 8–10pm</option>
            <option value="custom">Custom (edit below)</option>
          </select>
        </div>
        <div>
          <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>COO notes about you</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={settings.coo_notes || ''} onChange={e => set('coo_notes', e.target.value)} placeholder="Running notes the COO uses about your patterns, preferences, context…" />
        </div>
      </Section>

      <Section title="Career background">
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>Career outline</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={5} value={settings.outline || ''} onChange={e => set('outline', e.target.value)} placeholder="Paste your resume summary, LinkedIn About, or career history. The COO uses this for task proposals and life tree seeding." />
      </Section>

      <Section title="Life areas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(settings.life_areas || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={a.emoji || ''} onChange={e => setLifeArea(i, 'emoji', e.target.value)} style={{ ...inputStyle, width: 36, textAlign: 'center', padding: '6px 4px', marginTop: 0 }} maxLength={2} />
              <input value={a.label || ''} onChange={e => setLifeArea(i, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="Label" />
              <input type="number" min={1} max={20} value={a.blocks || 4} onChange={e => setLifeArea(i, 'blocks', parseInt(e.target.value) || 4)} style={{ ...inputStyle, width: 52, textAlign: 'center', marginTop: 0 }} />
              <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', width: 24, flexShrink: 0 }}>blk</span>
              <button onClick={() => removeLifeArea(i)} style={{ background: 'transparent', border: 'none', color: '#8a2828', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button onClick={addLifeArea} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed rgba(122,170,138,0.5)', borderRadius: 6, padding: '5px 12px', color: '#7aaa8a', fontSize: 11, cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>+ Add area</button>
        </div>
      </Section>

      <Section title="Rhythm & energy">
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>Rhythm notes</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={settings.rhythm_notes || ''} onChange={e => set('rhythm_notes', e.target.value)} placeholder="e.g. Slow start before 9am, crash after 2pm, can't focus after big meals…" />
        </div>
        <Toggle label="ADHD-aware mode" value={!!settings.adhd_aware} onChange={v => set('adhd_aware', v)} />
        <p style={{ fontSize: 10.5, color: '#7aaa8a', marginTop: 5, lineHeight: 1.5, margin: '5px 0 0' }}>Breaks tasks into ≤30 min chunks, protects focus context, names ADHD patterns explicitly.</p>
      </Section>

      <Section title="Financial goals">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(settings.financial_goals || []).map((g, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(15,110,86,0.08)', border: '1px solid rgba(15,110,86,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#0f6e56' }}>
              {g}
              <button onClick={() => removeGoal(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a2828', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, marginTop: 0, flex: 1 }} value={goalDraft} onChange={e => setGoalDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGoal()} placeholder="e.g. Save $10k emergency fund" />
          <button onClick={addGoal} disabled={!goalDraft.trim()} style={{ flexShrink: 0, background: 'rgba(26,90,60,0.1)', color: '#1a5a3c', border: '1px solid rgba(26,90,60,0.25)', borderRadius: 7, padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', opacity: goalDraft.trim() ? 1 : 0.5 }}>Add</button>
        </div>
      </Section>

      <Section title="Relationships">
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>Contact seeds</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={settings.relationship_seeds || ''} onChange={e => set('relationship_seeds', e.target.value)} placeholder="Names of people to keep in orbit — e.g. Mom, Jake (recruiter at Stripe), Dr. Patel" />
      </Section>

      <Section title="Integrations">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#3a5c47' }}>Tier</span>
          <span style={{ ...mono, fontSize: 11, color: '#182e22', fontWeight: 500 }}>{{ google: '🔵 Google', microsoft: '🟦 Microsoft', zero: '🖥️ Local only' }[settings.integration_tier] || settings.integration_tier || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#3a5c47' }}>Add-ons</span>
          <span style={{ ...mono, fontSize: 11, color: '#7aaa8a' }}>{(settings.addons || []).join(', ') || 'none'}</span>
        </div>
        <a href="/onboarding?refresh=true" style={{ fontSize: 11.5, color: '#1a5a3c', fontWeight: 500, textDecoration: 'none' }}>Re-run onboarding to change →</a>
      </Section>

      <Section title="Life tree background">
        <p style={{ fontSize: 11, color: '#7aaa8a', marginBottom: 12, lineHeight: 1.55 }}>
          Background photos use <span style={mono}>/public/species/{'{key}'}.jpg</span>. <strong style={{ color: '#3a5c47' }}>Rotate</strong> only shuffles variants for your <em>current</em> species.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {[
            { id: 'sticky', title: 'Fixed for this evolution', desc: 'Same default portrait until your tier unlocks the next species.' },
            { id: 'rotate_load', title: 'Rotate each visit', desc: 'Random pick from your gallery for this species only.' },
          ].map(opt => (
            <button key={opt.id} type="button" onClick={() => set('tree_bg_mode', opt.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1px solid ${(settings.tree_bg_mode || 'sticky') === opt.id ? '#1a5a3c' : 'rgba(122,170,138,0.35)'}`, background: (settings.tree_bg_mode || 'sticky') === opt.id ? 'rgba(26,90,60,0.08)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, color: '#182e22', fontSize: 12.5 }}>{opt.title}</div>
              <div style={{ fontSize: 11, color: '#7aaa8a', marginTop: 4, lineHeight: 1.45 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        <a href="/tree" style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#1a5a3c', textDecoration: 'none', padding: '8px 0' }}>
          Open Life tree — gallery, past tiers, shuffle →
        </a>
      </Section>

      <Section title="ADHD Patterns">
        <p style={{ fontSize: 11, color: '#7aaa8a', marginBottom: 10, lineHeight: 1.5 }}>The COO watches for these and names them in check-ins and retros.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['avoidance','context-switching','underestimating-time','hyperfocus','task-initiation','decision-fatigue','perfectionism','emotional-dysregulation'].map(p => {
            const selected = (settings.adhd_patterns || []).includes(p)
            return (
              <button key={p} onClick={() => { const cur = settings.adhd_patterns || []; set('adhd_patterns', selected ? cur.filter(x => x !== p) : [...cur, p]) }}
                style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${selected ? '#0f6e56' : 'rgba(122,170,138,0.3)'}`, background: selected ? 'rgba(15,110,86,0.1)' : 'transparent', color: selected ? '#0f6e56' : '#7aaa8a', fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', transition: 'all .15s' }}>
                {p}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Weekly Time Budget (15-min blocks)">
        {[['career','🎯','Career & job search'],['interview','🧠','Interview prep'],['learning','📚','Learning'],['fitness','⚡','Fitness'],['family','🤝','Relationships'],['finance','💰','Finance'],['admin','📋','Admin']].map(([key, icon, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, width: 20 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#3a5c47' }}>{label}</span>
            <input type="number" min={0} max={80} value={settings.weekly_time_budget?.[key] || 0} onChange={e => setBudget(key, e.target.value)} style={{ ...inputStyle, width: 60, textAlign: 'center', marginTop: 0 }} />
            <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', width: 30 }}>= {((settings.weekly_time_budget?.[key] || 0) * 15 / 60).toFixed(1)}h</span>
          </div>
        ))}
      </Section>

      <Section title="Notifications">
        {[['morning_brief','Morning brief (7:30am)'],['midday_checkin','Midday check-in (12pm)'],['afternoon_checkin','Afternoon pulse (4pm)'],['evening_retro','Evening retro (7pm)'],['urgent_alerts','Urgent agent alerts'],['birthday_alerts','Birthday alerts (14-day advance)'],['weekly_review','Sunday weekly review']].map(([key, label]) => (
          <Toggle key={key} label={label} value={settings.notification_prefs?.[key] !== false} onChange={v => setNotif(key, v)} />
        ))}
      </Section>

      <Section title="Oura Ring">
        {oura?.connected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0f6e56', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#0f6e56', fontWeight: 500 }}>Connected</span>
              {oura?.data?.readiness && <span style={{ ...mono, fontSize: 10, color: '#7aaa8a', marginLeft: 'auto' }}>Readiness: {oura.data.readiness.score}/100</span>}
            </div>
            {oura?.data?.readiness && (
              <div style={{ padding: '9px 11px', background: 'rgba(15,110,86,0.06)', border: '1px solid rgba(15,110,86,0.15)', borderRadius: 8, fontSize: 11.5, color: '#3a5c47', lineHeight: 1.6, marginBottom: 10 }}>
                {oura.data.readiness.energy_note}
              </div>
            )}
            <button onClick={disconnectOura} style={{ background: 'transparent', border: '1px solid rgba(138,40,40,0.3)', borderRadius: 7, padding: '6px 14px', fontSize: 11.5, color: '#8a2828', cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
              Disconnect Oura
            </button>
          </div>
        ) : (
          <div>
            <a href="/api/oura/auth?return_to=/settings" style={{ display: 'block', background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', textDecoration: 'none', textAlign: 'center', marginBottom: 12 }}>
              Connect Oura Ring with OAuth →
            </a>
            <p style={{ fontSize: 10.5, color: '#7aaa8a', marginBottom: 10, lineHeight: 1.6 }}>Or paste a personal access token from <span style={mono}>cloud.ouraring.com/personal-access-tokens</span></p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, marginTop: 0 }} type="password" value={ouraToken} onChange={e => setOuraToken(e.target.value)} placeholder="Paste personal access token…" />
              <button onClick={connectOura} disabled={!ouraToken.trim()} style={{ flexShrink: 0, background: 'rgba(26,90,60,0.1)', color: '#1a5a3c', border: '1px solid rgba(26,90,60,0.25)', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', opacity: ouraToken.trim() ? 1 : 0.5 }}>
                Save
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(45,122,82,0.12)', border: '1px solid rgba(45,122,82,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#1a5a3c', flexShrink: 0 }}>
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#182e22' }}>{session?.user?.name}</div>
            <div style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 1 }}>{session?.user?.email}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.6 }}>
          Connected: Google Calendar · Gmail · Tasks · Contacts{oura?.connected ? ' · Oura Ring' : ''}
        </div>
      </Section>

      <div style={{ paddingBottom: 24 }}>
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', transition: 'opacity .15s', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
