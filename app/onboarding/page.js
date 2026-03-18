'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['welcome', 'roadmap', 'schedule', 'oura', 'relationships', 'done']

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
const mono = { fontFamily: 'JetBrains Mono, monospace' }
const sans = { fontFamily: 'Figtree, sans-serif' }

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

function ProgressDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
      {STEPS.slice(0, -1).map((s, i) => (
        <div key={s} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= STEPS.indexOf(step) ? '#1a5a3c' : 'rgba(26,90,60,0.2)', transition: 'background .3s' }} />
      ))}
    </div>
  )
}

// ── STEP: WELCOME ─────────────────────────────────────────────────────────────
function WelcomeStep({ onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🌲</div>
      <h1 style={{ ...serif, fontSize: 26, color: '#182e22', marginBottom: 6, fontStyle: 'italic' }}>Forest for the Trees</h1>
      <p style={{ ...mono, fontSize: 9, color: '#7aaa8a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>Your autonomous life COO</p>
      <p style={{ fontSize: 13, color: '#3a5c47', lineHeight: 1.7, marginBottom: 20 }}>
        I'll read your Calendar and Gmail each morning, build your day in 15-min blocks, and check in with you throughout the day — so you can focus on the work, not the managing.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[['📅', 'Reads your Calendar + Gmail daily'],['🧠', 'Builds ADHD-aware time-blocked schedules'],['💍', 'Uses your Oura Ring for energy-aware planning'],['🔔', 'Notifies you via Google Calendar (native iPhone alerts)'],['🤝', 'Tracks relationships + birthdays automatically']].map(([icon, text]) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8, fontSize: 12, color: '#3a5c47', textAlign: 'left' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>{text}
          </div>
        ))}
      </div>
      <button style={btnPrimary} onClick={onNext}>Get started →</button>
    </div>
  )
}

// ── STEP: ROADMAP ─────────────────────────────────────────────────────────────
function RoadmapStep({ data, onChange, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>What are you working toward?</h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 18, lineHeight: 1.6 }}>The COO uses this as your north star. Be specific — it changes how tasks get prioritized every day.</p>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 3 }}>Primary goal (4-week horizon)</label>
        <input style={inputStyle} value={data.roadmap} onChange={e => onChange('roadmap', e.target.value)} placeholder="e.g. Land a Data Science role at a fintech company" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 3 }}>Best focus hours</label>
        <select style={inputStyle} value={data.peak_hours} onChange={e => onChange('peak_hours', e.target.value)}>
          <option value="8-10am, 2-4pm">8–10am and 2–4pm (classic ADHD)</option>
          <option value="9-11am, 3-5pm">9–11am and 3–5pm</option>
          <option value="6-9am, 1-3pm">Early bird — 6–9am and 1–3pm</option>
          <option value="10am-12pm, 4-7pm">Late starter — 10am–12pm and 4–7pm</option>
          <option value="custom">Custom (edit after setup)</option>
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 8 }}>Weekly time budget (15-min blocks)</label>
        {[['career', '🎯', 'Career & job search'],['interview', '🧠', 'Interview prep'],['learning', '📚', 'Learning'],['fitness', '⚡', 'Fitness'],['family', '🤝', 'Family & relationships']].map(([key, icon, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, width: 20 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#3a5c47' }}>{label}</span>
            <input type="number" min={0} max={80} value={data.weekly_budget?.[key] || 0} onChange={e => onChange('weekly_budget', { ...data.weekly_budget, [key]: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, width: 60, textAlign: 'center', marginTop: 0 }} />
            <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', width: 24 }}>×15</span>
          </div>
        ))}
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ── STEP: SCHEDULE PREFERENCES ────────────────────────────────────────────────
function ScheduleStep({ data, onChange, onNext, onBack }) {
  const patterns = ['avoidance', 'context-switching', 'underestimating-time', 'hyperfocus', 'task-initiation', 'decision-fatigue', 'perfectionism']
  const toggle = (p) => {
    const current = data.adhd_patterns || []
    onChange('adhd_patterns', current.includes(p) ? current.filter(x => x !== p) : [...current, p])
  }

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic' }}>Tell the COO about your patterns</h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 18, lineHeight: 1.6 }}>The COO will watch for these and name them when it sees them — without judgment.</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 8 }}>ADHD patterns you recognize in yourself</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {patterns.map(p => {
            const selected = (data.adhd_patterns || []).includes(p)
            return (
              <button key={p} onClick={() => toggle(p)} style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${selected ? '#0f6e56' : 'rgba(122,170,138,0.3)'}`, background: selected ? 'rgba(15,110,86,0.1)' : 'transparent', color: selected ? '#0f6e56' : '#7aaa8a', fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', transition: 'all .15s' }}>
                {p}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 3 }}>Anything else the COO should know about you?</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={data.coo_notes || ''} onChange={e => onChange('coo_notes', e.target.value)} placeholder="e.g. I lose focus after lunch, I work best with music, I tend to avoid emails..." />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 8 }}>Notification preferences</label>
        {[['morning_brief', 'Morning brief (8am)'],['midday_checkin', 'Midday check-in (12pm)'],['afternoon_checkin', 'Afternoon pulse (4pm)'],['evening_retro', 'Evening retro (7pm)'],['urgent_alerts', 'Urgent agent alerts (immediate)'],['birthday_alerts', 'Birthday alerts']].map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(122,170,138,0.2)' }}>
            <span style={{ fontSize: 12, color: '#3a5c47' }}>{label}</span>
            <button onClick={() => onChange('notification_prefs', { ...data.notification_prefs, [key]: !(data.notification_prefs?.[key] !== false) })} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: data.notification_prefs?.[key] !== false ? '#1a5a3c' : 'rgba(122,170,138,0.3)', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: data.notification_prefs?.[key] !== false ? 19 : 3, transition: 'left .2s' }} />
            </button>
          </div>
        ))}
      </div>

      <button style={btnPrimary} onClick={onNext}>Continue →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ── STEP: OURA ────────────────────────────────────────────────────────────────
function OuraStep({ onNext, onBack, onSkip }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function connect() {
    if (!token.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/oura', {
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
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>Connect your Oura Ring</h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>Your readiness score sets your energy level every morning — the COO uses it to protect you on low days and push you on strong ones.</p>

      {!result ? (
        <>
          <div style={{ padding: '10px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8, marginBottom: 14, fontSize: 11.5, color: '#3a5c47', lineHeight: 1.6 }}>
            <strong>Get your token:</strong><br />
            1. Go to <span style={{ ...mono, fontSize: 10 }}>cloud.ouraring.com</span><br />
            2. Profile → Personal Access Tokens<br />
            3. Create token → copy and paste below
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 3 }}>Personal access token</label>
            <input style={inputStyle} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your Oura token here…" onKeyDown={e => e.key === 'Enter' && connect()} />
          </div>
          {error && <div style={{ fontSize: 11, color: '#8a2828', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>⚠ {error}</div>}
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

// ── STEP: RELATIONSHIPS ───────────────────────────────────────────────────────
function RelationshipsStep({ onNext, onBack }) {
  return (
    <div>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🤝</div>
      <h2 style={{ ...serif, fontSize: 20, color: '#182e22', marginBottom: 4, fontStyle: 'italic', textAlign: 'center' }}>Relationship intelligence</h2>
      <p style={{ fontSize: 12, color: '#7aaa8a', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>The COO reads your Google Contacts to track touchpoints and birthdays. No texts or messages — just names, birthdays, and when you last connected.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[
          ['Birthday tracking', '14-day advance warning → Google Calendar alert fires on your phone'],
          ['Overdue touchpoints', 'Flags people you haven\'t connected with based on your tier settings'],
          ['Weekly Sunday review', 'COO gives you a prioritized list of who to reach out to this week'],
          ['Mark as contacted', 'Tap "Reached out" in the app → updates their last-contact date automatically'],
        ].map(([title, desc]) => (
          <div key={title} style={{ padding: '9px 12px', background: 'rgba(45,122,82,0.06)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#182e22', marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#7aaa8a', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', background: 'rgba(26,95,168,0.07)', border: '1px solid rgba(26,95,168,0.15)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#144a85', lineHeight: 1.6 }}>
        <strong>One setup step:</strong> In Google Contacts, add a custom field to your close people:<br />
        Key: <span style={{ ...mono, fontSize: 10 }}>relationship_tier</span> → Value: <span style={{ ...mono, fontSize: 10 }}>close</span>, <span style={{ ...mono, fontSize: 10 }}>friend</span>, or <span style={{ ...mono, fontSize: 10 }}>acquaintance</span><br />
        The COO ignores untagged contacts.
      </div>

      <button style={btnPrimary} onClick={onNext}>Got it →</button>
      <button style={btnGhost} onClick={onBack}>Back</button>
    </div>
  )
}

// ── STEP: DONE ────────────────────────────────────────────────────────────────
function DoneStep({ onFinish }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌲</div>
      <h2 style={{ ...serif, fontSize: 22, color: '#182e22', marginBottom: 8, fontStyle: 'italic' }}>You're all set</h2>
      <p style={{ fontSize: 13, color: '#3a5c47', lineHeight: 1.7, marginBottom: 20 }}>
        Your COO will build your first schedule tomorrow morning at 7:30am using your Calendar, Gmail, and Oura data. You'll get a Google Calendar notification when it's ready.
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
            <span style={{ ...mono, fontSize: 9, color: '#7aaa8a', paddingTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ fontSize: 12, color: '#3a5c47', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
      <button style={btnPrimary} onClick={onFinish}>Open Forest for the Trees →</button>
    </div>
  )
}

// ── MAIN ONBOARDING ───────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState('welcome')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    roadmap: 'Land a Data Science (ML) role within 4 weeks',
    peak_hours: '8-10am, 2-4pm',
    adhd_patterns: ['task-initiation', 'context-switching'],
    coo_notes: '',
    notification_prefs: { morning_brief: true, midday_checkin: true, afternoon_checkin: true, evening_retro: true, urgent_alerts: true, birthday_alerts: true },
    weekly_budget: { career: 20, interview: 16, learning: 12, fitness: 6, family: 4 },
  })

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }))
  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1])
  const back = () => setStep(STEPS[STEPS.indexOf(step) - 1])

  async function finish() {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap: formData.roadmap,
          peak_hours: formData.peak_hours,
          adhd_patterns: formData.adhd_patterns,
          coo_notes: formData.coo_notes,
          notification_prefs: formData.notification_prefs,
          weekly_time_budget: formData.weekly_budget,
          onboarding_complete: true,
        }),
      })
      router.push('/')
    } catch {
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
          {step === 'welcome'       && <WelcomeStep onNext={next} />}
          {step === 'roadmap'       && <RoadmapStep data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'schedule'      && <ScheduleStep data={formData} onChange={set} onNext={next} onBack={back} />}
          {step === 'oura'          && <OuraStep onNext={next} onBack={back} onSkip={next} />}
          {step === 'relationships' && <RelationshipsStep onNext={next} onBack={back} />}
          {step === 'done'          && <DoneStep onFinish={finish} />}
          {saving && <div style={{ textAlign: 'center', color: '#7aaa8a', fontSize: 11, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>Saving your preferences…</div>}
        </div>
      </div>
    </>
  )
}
