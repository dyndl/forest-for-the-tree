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

function StatusDot({ ok, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#0f6e56' : '#b85c00', flexShrink: 0, display: 'inline-block' }} />
      <span style={{ ...mono, fontSize: 10, color: ok ? '#0f6e56' : '#b85c00' }}>{label}</span>
    </span>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <div style={{ ...mono, fontSize: 10, color: '#fff', background: '#1a5a3c', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
      <div style={{ fontSize: 12, color: '#3a5c47', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.74)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.88)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.3)' }}>
        <span style={{ ...mono, fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#7aaa8a' }}>{title}</span>
      </div>
      <div style={{ padding: '14px' }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)' }}>
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
  // integrations
  const [integrations, setIntegrations] = useState(null)
  const [voiceTest, setVoiceTest] = useState(null)
  const [voiceTesting, setVoiceTesting] = useState(false)
  const [linkingAccount, setLinkingAccount] = useState(false)
  const [linkLabel, setLinkLabel] = useState('Work')
  const [ouraRefreshing, setOuraRefreshing] = useState(false)
  // re-onboard
  const [fullReset, setFullReset] = useState(false)
  const [resetConfirming, setResetConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings))
    fetch('/api/oura').then(r => r.json()).then(d => setOura(d))
    fetch('/api/integrations').then(r => r.json()).then(d => setIntegrations(d))
    // Show link success/error from OAuth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('link') === 'success') {
      fetch('/api/integrations').then(r => r.json()).then(d => setIntegrations(d))
      window.history.replaceState({}, '', '/settings')
    }
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

  async function testVoice() {
    setVoiceTesting(true); setVoiceTest(null)
    const r = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test_voice' }) })
    const d = await r.json()
    setVoiceTest(d); setVoiceTesting(false)
  }

  async function refreshOura() {
    setOuraRefreshing(true)
    const r = await fetch('/api/oura?refresh=true')
    const d = await r.json()
    setOura(d); setOuraRefreshing(false)
  }

  async function linkAccount() {
    setLinkingAccount(true)
    const r = await fetch(`/api/auth/link-account?label=${encodeURIComponent(linkLabel || 'Work')}`)
    const { url } = await r.json()
    if (url) window.location.href = url
    else setLinkingAccount(false)
  }

  async function unlinkAccount(email) {
    await fetch('/api/auth/link-account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setIntegrations(i => ({ ...i, linked_accounts: (i?.linked_accounts || []).filter(a => a.email !== email) }))
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

  async function handleReOnboard() {
    if (!fullReset) {
      window.location.href = '/onboarding?refresh=true'
      return
    }
    if (!resetConfirming) {
      setResetConfirming(true)
      return
    }
    setResetting(true)
    await fetch('/api/settings', { method: 'DELETE' })
    window.location.href = '/onboarding'
  }

  if (!settings) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#7aaa8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
      Loading settings…
    </div>
  )

  // Root div: NO className="scroll" — the parent .scroll in page.js handles overflow.
  // Padding comes from the parent .scroll's CSS (14px 16px).
  return (
    <div style={{ width: '100%' }}>

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
              <input value={a.label || ''} onChange={e => setLifeArea(i, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="Label (e.g. Health, Career, Learning)" />
              <input value={a.key || ''} onChange={e => setLifeArea(i, 'key', e.target.value)} style={{ ...inputStyle, width: 80, marginTop: 0 }} placeholder="key" />
              <button onClick={() => removeLifeArea(i)} style={{ background: 'transparent', border: 'none', color: '#8a2828', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>×</button>
            </div>
          ))}
          <p style={{ fontSize: 10, color: '#7aaa8a', marginTop: 4, lineHeight: 1.4 }}>Key = short identifier used by the COO (e.g. <span style={mono}>health</span>, <span style={mono}>career</span>). Set weekly hours targets below.</p>
          <button onClick={addLifeArea} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed rgba(122,170,138,0.5)', borderRadius: 6, padding: '5px 12px', color: '#7aaa8a', fontSize: 11, cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>+ Add area</button>
        </div>
      </Section>

      <Section title="Rhythm & energy">
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 2 }}>Rhythm notes</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={settings.rhythm_notes || ''} onChange={e => set('rhythm_notes', e.target.value)} placeholder="e.g. Slow start before 9am, crash after 2pm, can't focus after big meals…" />
        </div>
        <Toggle label="ADHD-aware mode" value={!!settings.adhd_aware} onChange={v => set('adhd_aware', v)} />
        <p style={{ fontSize: 10.5, color: '#7aaa8a', marginTop: 6, lineHeight: 1.5 }}>Breaks tasks into ≤30 min chunks, protects focus context, names ADHD patterns explicitly.</p>
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

      <Section title="ADHD patterns">
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

      <Section title="Weekly Time Budget">
        {(settings.life_areas || []).length === 0
          ? <p style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5 }}>Define your life areas above first — they'll appear here so you can set a weekly blocks target for each one.</p>
          : <>
              {(settings.life_areas || []).filter(a => a.key).map(a => {
                const blk = settings.weekly_time_budget?.[a.key] || 0
                return (
                  <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, width: 20 }}>{a.emoji || '◦'}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#3a5c47' }}>{a.label}</span>
                    <input type="number" min={0} max={80} value={blk} onChange={e => setBudget(a.key, e.target.value)} style={{ ...inputStyle, width: 72, textAlign: 'center', marginTop: 0 }} />
                    <span style={{ ...mono, fontSize: 11, color: '#3a5c47', width: 24, flexShrink: 0, fontWeight: 600 }}>blk</span>
                    <span style={{ ...mono, fontSize: 11, color: '#2d6644', width: 52, flexShrink: 0, fontWeight: 500 }}>= {(blk * 15 / 60).toFixed(1)}h/wk</span>
                  </div>
                )
              })}
              <p style={{ fontSize: 10, color: '#7aaa8a', marginTop: 6, lineHeight: 1.5 }}>1 block = 15 min · COO breaks: 5 min micro, 10 min short, 15 min full · The COO uses these targets to balance your schedule across areas.</p>
            </>
        }
      </Section>

      <Section title="Notifications">
        {[
          { key: 'morning_brief',     label: 'Morning brief',    timeKey: 'morning_brief_time',     defaultTime: '07:30' },
          { key: 'midday_checkin',    label: 'Midday check-in',  timeKey: 'midday_checkin_time',    defaultTime: '12:00' },
          { key: 'afternoon_checkin', label: 'Afternoon pulse',  timeKey: 'afternoon_checkin_time', defaultTime: '16:00' },
          { key: 'evening_retro',     label: 'Evening retro',    timeKey: 'evening_retro_time',     defaultTime: '19:00' },
        ].map(({ key, label, timeKey, defaultTime }) => {
          const enabled = settings.notification_prefs?.[key] !== false
          const time = settings.notification_prefs?.[timeKey] || defaultTime
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)' }}>
              <span style={{ fontSize: 12, color: '#3a5c47', flex: 1 }}>{label}</span>
              <input
                type="time"
                value={time}
                onChange={e => setNotif(timeKey, e.target.value)}
                disabled={!enabled}
                style={{ ...inputStyle, width: 90, marginTop: 0, padding: '4px 7px', fontSize: 12, opacity: enabled ? 1 : 0.4, cursor: enabled ? 'auto' : 'not-allowed' }}
              />
              <button onClick={() => setNotif(key, !enabled)} style={{ marginLeft: 8, width: 36, height: 20, borderRadius: 10, border: 'none', background: enabled ? '#1a5a3c' : 'rgba(122,170,138,0.3)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: enabled ? 19 : 3, transition: 'left .2s' }} />
              </button>
            </div>
          )
        })}
        <Toggle label="Urgent agent alerts" value={settings.notification_prefs?.urgent_alerts !== false} onChange={v => setNotif('urgent_alerts', v)} />
        <Toggle label="Birthday alerts (14-day advance)" value={settings.notification_prefs?.birthday_alerts !== false} onChange={v => setNotif('birthday_alerts', v)} />
        <Toggle label="Sunday weekly review" value={settings.notification_prefs?.weekly_review !== false} onChange={v => setNotif('weekly_review', v)} />
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
        <a href="/tree" style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#1a5a3c', textDecoration: 'none' }}>
          Open Life tree — gallery, past tiers, shuffle →
        </a>
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

      {/* ── INTEGRATIONS STATUS ── */}
      <Section title="Connected integrations">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {/* Google */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔵</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#182e22' }}>Google</div>
                <div style={{ ...mono, fontSize: 9, color: '#7aaa8a' }}>Calendar · Gmail · Tasks · Contacts</div>
              </div>
            </div>
            <StatusDot ok={integrations?.google_connected} label={integrations?.google_connected ? 'Connected' : 'Not connected'} />
          </div>
          {/* Oura */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💍</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#182e22' }}>Oura Ring</div>
                {oura?.connected && oura?.data?.readiness && (
                  <div style={{ ...mono, fontSize: 9, color: '#7aaa8a' }}>Readiness {oura.data.readiness.score}/100 · Sleep {oura.data.sleep?.score || '—'}/100</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {oura?.connected && (
                <button onClick={refreshOura} disabled={ouraRefreshing} style={{ ...mono, fontSize: 9, color: '#1a5a3c', background: 'transparent', border: '1px solid rgba(26,90,60,0.3)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', opacity: ouraRefreshing ? 0.5 : 1 }}>
                  {ouraRefreshing ? '…' : 'Refresh'}
                </button>
              )}
              <StatusDot ok={oura?.connected} label={oura?.connected ? 'Connected' : 'Not connected'} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── LINKED ACCOUNTS ── */}
      <Section title="Linked accounts">
        <p style={{ fontSize: 11.5, color: '#3a5c47', marginBottom: 12, lineHeight: 1.6 }}>
          Add a work or secondary Google account so the COO can read that calendar when scheduling your day.
        </p>
        {/* Existing linked accounts */}
        {(integrations?.linked_accounts || []).map(a => (
          <div key={a.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(15,110,86,0.06)', border: '1px solid rgba(15,110,86,0.15)', borderRadius: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#182e22' }}>{a.name || a.email}</div>
              <div style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 1 }}>{a.email} · {a.label || 'Secondary'}</div>
              <div style={{ ...mono, fontSize: 9, color: '#0f6e56', marginTop: 1 }}>📅 Calendar {a.use_calendar ? 'on' : 'off'}</div>
            </div>
            <button onClick={() => unlinkAccount(a.email)} style={{ background: 'transparent', border: '1px solid rgba(138,40,40,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#8a2828', cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
              Remove
            </button>
          </div>
        ))}
        {/* Add account */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            placeholder="Label (e.g. Work)"
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          />
          <button onClick={linkAccount} disabled={linkingAccount} style={{ flexShrink: 0, background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', opacity: linkingAccount ? 0.6 : 1 }}>
            {linkingAccount ? '…' : '+ Add account'}
          </button>
        </div>
        <p style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 7, lineHeight: 1.5 }}>
          You'll be prompted to sign in with the account to add. Only Calendar access is requested.
        </p>
      </Section>

      {/* ── GOOGLE VOICE VOICEMAIL ── */}
      <Section title="Google Voice — voicemail to COO">
        <p style={{ fontSize: 12, color: '#3a5c47', marginBottom: 14, lineHeight: 1.65 }}>
          Set up Google Voice so missed calls are transcribed and emailed to Gmail — the COO reads them automatically as tasks.
        </p>
        <Step n="1">
          Go to <a href="https://voice.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1a5a3c', fontWeight: 600 }}>voice.google.com</a> and sign in with the same Google account you use here. Claim a free phone number.
        </Step>
        <Step n="2">
          In Google Voice, open <strong>Settings → Calls</strong> and enable <strong>"Forward calls to Google Voice"</strong>. Then go to <strong>Settings → Messages & Voicemail</strong> and turn on <strong>"Get voicemail via email"</strong>.
        </Step>
        <Step n="3">
          On your phone, enable call forwarding to your Google Voice number. Dial:<br />
          <span style={{ ...mono, fontSize: 11, background: 'rgba(26,90,60,0.08)', padding: '2px 6px', borderRadius: 4, color: '#182e22' }}>*71 + [your GV number]</span>
          &nbsp;(AT&T/T-Mobile). Verizon users: <span style={{ ...mono, fontSize: 11 }}>*71</span> then the number.
        </Step>
        <Step n="4">
          Leave yourself a test voicemail, then click <strong>Confirm below</strong> to verify it flowed through to Gmail.
        </Step>

        {voiceTest && (
          <div style={{ padding: '10px 12px', background: voiceTest.active ? 'rgba(15,110,86,0.07)' : 'rgba(184,92,0,0.07)', border: `1px solid ${voiceTest.active ? 'rgba(15,110,86,0.2)' : 'rgba(184,92,0,0.2)'}`, borderRadius: 8, marginBottom: 10 }}>
            {voiceTest.active ? (
              <>
                <div style={{ ...mono, fontSize: 10, color: '#0f6e56', fontWeight: 600, marginBottom: 3 }}>✓ Google Voice voicemails detected in Gmail</div>
                {voiceTest.latest && <div style={{ fontSize: 11.5, color: '#3a5c47' }}>Latest: "{voiceTest.latest}"</div>}
                <div style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 3 }}>{voiceTest.count} voicemail email{voiceTest.count !== 1 ? 's' : ''} found in last 30 days</div>
              </>
            ) : (
              <>
                <div style={{ ...mono, fontSize: 10, color: '#b85c00', fontWeight: 600, marginBottom: 3 }}>No Google Voice emails found yet</div>
                <div style={{ fontSize: 11.5, color: '#3a5c47' }}>Make sure you've left a test voicemail and that "Get voicemail via email" is on in Google Voice settings.</div>
              </>
            )}
          </div>
        )}

        <button onClick={testVoice} disabled={voiceTesting} style={{ background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 18px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', opacity: voiceTesting ? 0.6 : 1 }}>
          {voiceTesting ? 'Checking Gmail…' : 'Confirm Google Voice is working'}
        </button>
      </Section>

      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(45,122,82,0.12)', border: '1px solid rgba(45,122,82,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#1a5a3c', flexShrink: 0 }}>
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#182e22' }}>{session?.user?.name}</div>
            <div style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 1 }}>{session?.user?.email}</div>
          </div>
        </div>
      </Section>

      {/* ── RE-ONBOARD ── */}
      <Section title="Re-onboard">
        <p style={{ fontSize: 12, color: '#3a5c47', marginBottom: 14, lineHeight: 1.65 }}>
          Re-run the onboarding wizard. Your current settings, career outline, life areas, and COO context are pre-filled so you only update what's changed.
        </p>

        {/* Full reset toggle */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: `1px solid ${fullReset ? 'rgba(138,40,40,0.35)' : 'rgba(122,170,138,0.3)'}`, background: fullReset ? 'rgba(138,40,40,0.04)' : 'transparent', marginBottom: 12, transition: 'all .15s' }}>
          <input type="checkbox" checked={fullReset} onChange={e => { setFullReset(e.target.checked); setResetConfirming(false) }} style={{ marginTop: 2, accentColor: '#8a2828', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: fullReset ? '#8a2828' : '#182e22' }}>Full reset — wipe all data and start fresh</div>
            <div style={{ fontSize: 11, color: '#7aaa8a', marginTop: 3, lineHeight: 1.5 }}>Deletes tasks, schedule history, agents, and life tree. Integrations (Google, Oura) stay connected.</div>
          </div>
        </label>

        {/* Confirmation warning */}
        {resetConfirming && (
          <div style={{ padding: '11px 13px', background: 'rgba(138,40,40,0.07)', border: '1px solid rgba(138,40,40,0.25)', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8a2828', marginBottom: 4 }}>⚠ This cannot be undone</div>
            <div style={{ fontSize: 11.5, color: '#8a2828', lineHeight: 1.55, marginBottom: 10 }}>All tasks, schedules, agents, and life tree data will be permanently deleted. Your Google and Oura connections will remain.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setResetConfirming(false); setFullReset(false) }} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: '1px solid rgba(122,170,138,0.35)', background: 'transparent', color: '#7aaa8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleReOnboard} disabled={resetting} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: '#8a2828', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', opacity: resetting ? 0.6 : 1 }}>
                {resetting ? 'Resetting…' : 'Confirm reset →'}
              </button>
            </div>
          </div>
        )}

        {!resetConfirming && (
          <button onClick={handleReOnboard} style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: `1px solid ${fullReset ? 'rgba(138,40,40,0.4)' : 'rgba(26,90,60,0.3)'}`, background: fullReset ? 'rgba(138,40,40,0.08)' : 'rgba(26,90,60,0.07)', color: fullReset ? '#8a2828' : '#1a5a3c', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', transition: 'all .15s' }}>
            {fullReset ? '⚠ Reset & re-onboard →' : '↺ Update my profile →'}
          </button>
        )}
      </Section>

      {/* Save button */}
      <div style={{ paddingBottom: 28 }}>
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#1a5a3c', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Figtree, sans-serif', transition: 'opacity .15s', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
