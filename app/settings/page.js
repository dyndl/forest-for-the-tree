'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const mono = { fontFamily: 'JetBrains Mono, monospace' }
const serif = { fontFamily: 'Instrument Serif, Georgia, serif' }

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

export default function SettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState(null)
  const [oura, setOura] = useState(null)
  const [ouraToken, setOuraToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings))
    fetch('/api/oura').then(r => r.json()).then(d => setOura(d))
  }, [])

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))
  const setNotif = (key, val) => set('notification_prefs', { ...settings.notification_prefs, [key]: val })
  const setBudget = (key, val) => set('weekly_time_budget', { ...settings.weekly_time_budget, [key]: parseInt(val) || 0 })

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
    <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>

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
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={settings.coo_notes || ''} onChange={e => set('coo_notes', e.target.value)} placeholder="Running notes the COO uses about your patterns, preferences, context…" />
        </div>
      </Section>

      <Section title="ADHD Patterns">
        <p style={{ fontSize: 11, color: '#7aaa8a', marginBottom: 10, lineHeight: 1.5 }}>The COO watches for these and names them in check-ins and retros.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['avoidance','context-switching','underestimating-time','hyperfocus','task-initiation','decision-fatigue','perfectionism','emotional-dysregulation'].map(p => {
            const selected = (settings.adhd_patterns || []).includes(p)
            return (
              <button key={p} onClick={() => { const cur = settings.adhd_patterns || []; set('adhd_patterns', selected ? cur.filter(x=>x!==p) : [...cur,p]) }}
                style={{ padding:'5px 10px', borderRadius:5, border:`1px solid ${selected?'#0f6e56':'rgba(122,170,138,0.3)'}`, background:selected?'rgba(15,110,86,0.1)':'transparent', color:selected?'#0f6e56':'#7aaa8a', fontSize:11, cursor:'pointer', fontFamily:'JetBrains Mono, monospace', transition:'all .15s' }}>
                {p}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Weekly Time Budget (15-min blocks)">
        {[['career','🎯','Career & job search'],['interview','🧠','Interview prep'],['learning','📚','Learning'],['fitness','⚡','Fitness'],['family','🤝','Relationships'],['finance','💰','Finance'],['admin','📋','Admin']].map(([key,icon,label]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:14, width:20 }}>{icon}</span>
            <span style={{ flex:1, fontSize:12, color:'#3a5c47' }}>{label}</span>
            <input type="number" min={0} max={80} value={settings.weekly_time_budget?.[key]||0} onChange={e=>setBudget(key,e.target.value)} style={{ ...inputStyle, width:60, textAlign:'center', marginTop:0 }} />
            <span style={{ ...mono, fontSize:9, color:'#7aaa8a', width:30 }}>= {((settings.weekly_time_budget?.[key]||0)*15/60).toFixed(1)}h</span>
          </div>
        ))}
      </Section>

      <Section title="Notifications">
        {[['morning_brief','Morning brief (7:30am via Calendar)'],['midday_checkin','Midday check-in (12pm)'],['afternoon_checkin','Afternoon pulse (4pm)'],['evening_retro','Evening retro (7pm)'],['urgent_alerts','Urgent agent alerts (immediate)'],['birthday_alerts','Birthday alerts (14-day advance)'],['weekly_review','Sunday weekly review (9am)']].map(([key,label]) => (
          <Toggle key={key} label={label} value={settings.notification_prefs?.[key]!==false} onChange={v=>setNotif(key,v)} />
        ))}
      </Section>

      <Section title="Oura Ring">
        {oura?.connected ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#0f6e56', flexShrink:0 }} />
              <span style={{ fontSize:12, color:'#0f6e56', fontWeight:500 }}>Connected</span>
              {oura?.data?.readiness && (
                <span style={{ ...mono, fontSize:10, color:'#7aaa8a', marginLeft:'auto' }}>Readiness today: {oura.data.readiness.score}/100</span>
              )}
            </div>
            {oura?.data?.readiness && (
              <div style={{ padding:'9px 11px', background:'rgba(15,110,86,0.06)', border:'1px solid rgba(15,110,86,0.15)', borderRadius:8, fontSize:11.5, color:'#3a5c47', lineHeight:1.6, marginBottom:10 }}>
                {oura.data.readiness.energy_note}
              </div>
            )}
            <button onClick={disconnectOura} style={{ background:'transparent', border:'1px solid rgba(138,40,40,0.3)', borderRadius:7, padding:'6px 14px', fontSize:11.5, color:'#8a2828', cursor:'pointer', fontFamily:'Figtree, sans-serif' }}>
              Disconnect Oura
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:11.5, color:'#7aaa8a', marginBottom:10, lineHeight:1.6 }}>Connect your Oura Ring to auto-set energy level each morning. Get your token at <span style={mono}>cloud.ouraring.com/personal-access-tokens</span></p>
            <input style={inputStyle} type="password" value={ouraToken} onChange={e=>setOuraToken(e.target.value)} placeholder="Paste personal access token…" />
            <button onClick={connectOura} disabled={!ouraToken.trim()} style={{ marginTop:10, background:'#1a5a3c', color:'#fff', border:'none', borderRadius:7, padding:'8px 16px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'Figtree, sans-serif', opacity:ouraToken.trim()?1:0.5 }}>
              Connect Oura →
            </button>
          </div>
        )}
      </Section>

      <Section title="Account">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(45,122,82,0.12)', border:'1px solid rgba(45,122,82,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:500, color:'#1a5a3c', flexShrink:0 }}>
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'#182e22' }}>{session?.user?.name}</div>
            <div style={{ ...mono, fontSize:9, color:'#7aaa8a', marginTop:1 }}>{session?.user?.email}</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:'#7aaa8a', lineHeight:1.6 }}>
          Connected: Google Calendar · Gmail · Tasks · Contacts{oura?.connected?' · Oura Ring':''}
        </div>
      </Section>

      <div style={{ paddingBottom:20 }}>
        <button onClick={save} disabled={saving} style={{ width:'100%', background:'#1a5a3c', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Figtree, sans-serif', transition:'opacity .15s', opacity:saving?0.7:1 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
