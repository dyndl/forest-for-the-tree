'use client'

// ── Shared style tokens ────────────────────────────────────────────────────────
const mono   = { fontFamily: 'JetBrains Mono, monospace' }
const serif  = { fontFamily: 'Instrument Serif, Georgia, serif' }
const body   = { fontFamily: 'Figtree, sans-serif', fontSize: 13, color: '#3a5c47', lineHeight: 1.7 }

const card = {
  background: 'rgba(255,255,255,0.74)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.88)',
  borderRadius: 14,
  padding: '18px 20px',
  marginBottom: 12,
}

const sectionLabel = {
  ...mono,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#7aaa8a',
  marginBottom: 8,
  display: 'block',
}

const h2 = {
  ...serif,
  fontSize: 20,
  color: '#182e22',
  marginBottom: 10,
  lineHeight: 1.25,
}

const bullet = {
  ...body,
  display: 'block',
  paddingLeft: 14,
  position: 'relative',
  marginBottom: 5,
}

const kv = (color = '#1a5a3c') => ({
  ...mono,
  color,
  fontSize: 12,
  fontWeight: 500,
})

// ── TreeSVG (same as login / main app) ─────────────────────────────────────────
function TreeSVG() {
  return (
    <svg
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="55"  cy="605" rx="68" ry="86" fill="#1a3a2a" opacity=".92"/>
      <ellipse cx="55"  cy="528" rx="52" ry="66" fill="#2d5a3d" opacity=".88"/>
      <ellipse cx="55"  cy="465" rx="37" ry="52" fill="#3d7a52" opacity=".82"/>
      <rect    x="47"   y="593"  width="14" height="105" fill="#152d1e" opacity=".9"/>
      <ellipse cx="168" cy="632" rx="56" ry="72" fill="#1a3a2a" opacity=".88"/>
      <ellipse cx="168" cy="570" rx="43" ry="57" fill="#2d5a3d" opacity=".82"/>
      <ellipse cx="168" cy="516" rx="31" ry="43" fill="#4a9e6b" opacity=".76"/>
      <rect    x="161"  y="620"  width="12" height="82" fill="#152d1e" opacity=".88"/>
      <ellipse cx="875" cy="612" rx="72" ry="90" fill="#1a3a2a" opacity=".92"/>
      <ellipse cx="875" cy="532" rx="55" ry="70" fill="#2d5a3d" opacity=".88"/>
      <ellipse cx="875" cy="465" rx="39" ry="56" fill="#3d7a52" opacity=".82"/>
      <rect    x="867"  y="600"  width="14" height="105" fill="#152d1e" opacity=".9"/>
      <ellipse cx="962" cy="642" rx="52" ry="67" fill="#1a3a2a" opacity=".88"/>
      <ellipse cx="962" cy="584" rx="40" ry="52" fill="#2d5a3d" opacity=".82"/>
      <rect    x="956"  y="632"  width="12" height="68" fill="#152d1e" opacity=".88"/>
      <ellipse cx="500" cy="682" rx="43" ry="56" fill="#1a3a2a" opacity=".72"/>
      <ellipse cx="500" cy="636" rx="34" ry="44" fill="#2d5a3d" opacity=".67"/>
      <ellipse cx="312" cy="662" rx="40" ry="52" fill="#1a3a2a" opacity=".74"/>
      <ellipse cx="312" cy="620" rx="31" ry="41" fill="#2d5a3d" opacity=".70"/>
      <circle  cx="115" cy="105" r="72"           fill="#a8d9b8" opacity=".11"/>
      <circle  cx="755" cy="65"  r="88"           fill="#c8e6d4" opacity=".09"/>
    </svg>
  )
}

// ── Bullet helper ──────────────────────────────────────────────────────────────
function Li({ children }) {
  return (
    <span style={bullet}>
      <span style={{ position: 'absolute', left: 0, color: '#4a9e6b' }}>•</span>
      {children}
    </span>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ borderTop: '1px solid rgba(26,90,60,0.09)', margin: '12px 0' }} />
}

// ── Game elements summary table ────────────────────────────────────────────────
const GAME_ELEMENTS = [
  { emoji: '🌳', name: 'The Tree',       desc: 'Your career and life journey, visualized' },
  { emoji: '🌿', name: 'Branches',       desc: 'Active life projects with a lifecycle state' },
  { emoji: '🍎', name: 'Fruits',         desc: 'Milestones and wins hanging from branches' },
  { emoji: '🌱', name: 'Roots',          desc: 'Core values and foundational habits' },
  { emoji: '🪨', name: 'Rings',          desc: 'Annual life chapters and yearly reflections' },
  { emoji: '💧', name: 'Relationships',  desc: 'Key people, with connection health tracking' },
  { emoji: '🌱', name: 'Legacies',       desc: 'Long-term contributions you\'re building toward' },
  { emoji: '📈', name: 'Height XP',      desc: 'Mastery — earned by deep, focused work' },
  { emoji: '🌐', name: 'Width XP',       desc: 'Impact — earned by breadth and relationship tasks' },
]

// ── XP streak table ────────────────────────────────────────────────────────────
const STREAK_MILESTONES = [
  { days: '1',   mult: '1.00×', label: 'Baseline' },
  { days: '3',   mult: '1.15×', label: 'Getting going' },
  { days: '7',   mult: '1.35×', label: 'One week' },
  { days: '14',  mult: '1.70×', label: 'Two weeks' },
  { days: '21',  mult: '2.05×', label: 'Three weeks' },
  { days: '30+', mult: '2.50×', label: 'Peak multiplier' },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>

      {/* Background gradient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)',
      }} />

      {/* Forest silhouette overlay */}
      <TreeSVG />

      {/* Scrollable content */}
      <div style={{
        position: 'relative', zIndex: 2,
        maxWidth: 680, margin: '0 auto',
        padding: '32px 16px 64px',
        minHeight: '100%',
      }}>

        {/* Back link */}
        <a href="/" style={{
          ...mono,
          fontSize: 11,
          color: '#2d7a52',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 28,
          opacity: 0.85,
        }}>
          ← Back to app
        </a>

        {/* Hero */}
        <div style={{ marginBottom: 28, paddingLeft: 2 }}>
          <h1 style={{
            ...serif,
            fontSize: 38,
            color: '#182e22',
            lineHeight: 1.1,
            marginBottom: 6,
            textShadow: '0 1px 3px rgba(255,255,255,0.4)',
          }}>
            Forest for the Tree
          </h1>
          <span style={{ ...mono, fontSize: 11, color: '#2d7a52', letterSpacing: '0.1em' }}>
            Life OS · v2
          </span>
        </div>

        {/* ── 1. What is this? ──────────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>What is this?</span>
          <p style={body}>
            Forest for the Tree is a personal life operating system built around an AI{' '}
            <span style={kv()}>Chief Operations Officer</span> — a COO who reads your Calendar,
            Gmail, and tasks each morning, then builds and manages your day in{' '}
            <span style={kv()}>15-minute blocks</span>. Every decision is ADHD-aware and
            informed by your <span style={kv()}>Oura Ring</span> readiness score, so your
            cognitive load matches your actual energy, not just the clock.
          </p>
          <Divider />
          <p style={body}>
            On top of the COO layer sits the{' '}
            <span style={{ ...serif, fontSize: 15, color: '#182e22' }}>Life Tree</span> — a
            gamification system that visualizes your career and life journey as a growing tree.
            Species evolution, XP, streaks, and visible wins keep you engaged over the long haul,
            not just the next sprint.
          </p>
        </div>

        {/* ── 2. The Life Tree ─────────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>The Life Tree</span>
          <h2 style={h2}>The core game</h2>

          {/* Game elements at a glance table */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 8 }}>
              Game elements at a glance
            </span>
            <div style={{
              background: 'rgba(26,90,60,0.04)',
              border: '1px solid rgba(26,90,60,0.1)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              {GAME_ELEMENTS.map((el, i) => (
                <div key={el.name} style={{
                  display: 'grid',
                  gridTemplateColumns: '26px 110px 1fr',
                  gap: '0 8px',
                  padding: '7px 12px',
                  borderBottom: i < GAME_ELEMENTS.length - 1 ? '1px solid rgba(26,90,60,0.07)' : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14 }}>{el.emoji}</span>
                  <span style={{ ...mono, fontSize: 10, color: '#1a5a3c', fontWeight: 500 }}>{el.name}</span>
                  <span style={{ fontFamily: 'Figtree, sans-serif', fontSize: 11, color: '#3a5c47' }}>{el.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Tiers & Species */}
          <p style={{ ...body, marginBottom: 8 }}>
            <span style={kv()}>Tiers &amp; Species</span> — You begin as a{' '}
            <span style={kv('#b85c00')}>Bonsai</span> (Tier 1) and evolve through increasingly
            complex species as your career and life mastery deepen. Your starting tier is set
            during onboarding by evaluating the context you provide about your background —
            the more detail you share, the more accurately you start. You can re-evaluate at
            any time as you grow.
          </p>

          {/* XP types */}
          <p style={{ ...body, marginBottom: 8 }}>
            <span style={kv()}>Height XP (Mastery)</span> is earned by completing deep, focused
            tasks. It measures how skilled and specialized you become in your craft.
          </p>
          <p style={{ ...body, marginBottom: 12 }}>
            <span style={kv()}>Width XP (Impact)</span> is earned by breadth and relationship
            tasks — meetings, collaborations, networking. It measures your reach and influence.
          </p>

          <Divider />

          {/* Branch states */}
          <span style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 8 }}>
            Branch states
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {[
              ['🍃', 'Growing',  '#0f6e56'],
              ['🍂', 'Stunted',  '#b85c00'],
              ['🌟', 'Done',     '#1a5a3c'],
              ['❄️', 'Dormant',  '#1a5fa8'],
              ['✂️', 'Pruned',   '#7aaa8a'],
            ].map(([emoji, label, color]) => (
              <span key={label} style={{
                ...mono, fontSize: 10,
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.88)',
                borderRadius: 6,
                padding: '3px 8px',
                color,
              }}>
                {emoji} {label}
              </span>
            ))}
          </div>
          <p style={{ ...body, marginTop: 8 }}>
            Each branch represents an active life project. Branches naturally transition between
            states as you work on them or step back — a branch isn't a failure when it goes
            dormant, it's honest accounting.
          </p>
        </div>

        {/* ── 3. Streaks & Bonuses ─────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>Streaks &amp; Bonuses</span>
          <h2 style={h2}>Compound your XP</h2>

          <p style={{ ...body, marginBottom: 12 }}>
            Complete at least one task every day to maintain your streak. Each day you stay
            consistent, your XP multiplier grows — up to{' '}
            <span style={kv('#b85c00')}>2.5× at 30 days</span>. The multiplier compounds
            automatically; just keep showing up.
          </p>

          {/* Streak table */}
          <div style={{
            background: 'rgba(26,90,60,0.04)',
            border: '1px solid rgba(26,90,60,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 60px 1fr',
              padding: '6px 12px',
              borderBottom: '1px solid rgba(26,90,60,0.1)',
              background: 'rgba(26,90,60,0.05)',
            }}>
              {['Days', 'Mult', 'Milestone'].map(h => (
                <span key={h} style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a' }}>{h}</span>
              ))}
            </div>
            {STREAK_MILESTONES.map((row, i) => (
              <div key={row.days} style={{
                display: 'grid',
                gridTemplateColumns: '60px 60px 1fr',
                padding: '6px 12px',
                borderBottom: i < STREAK_MILESTONES.length - 1 ? '1px solid rgba(26,90,60,0.06)' : 'none',
                alignItems: 'center',
              }}>
                <span style={{ ...mono, fontSize: 11, color: '#1a5a3c' }}>{row.days}</span>
                <span style={{ ...mono, fontSize: 11, color: row.days === '30+' ? '#b85c00' : '#2d7a52', fontWeight: row.days === '30+' ? 500 : 400 }}>{row.mult}</span>
                <span style={{ fontFamily: 'Figtree, sans-serif', fontSize: 11, color: '#3a5c47' }}>{row.label}</span>
              </div>
            ))}
          </div>

          <Li>Even one small task a day keeps your streak alive — quality over quantity, consistency over perfection</Li>
          <Li>Weekend progress is always optional — the week starts Monday and you are never behind on weekends</Li>
          <Li>The streak multiplier applies to both Height and Width XP equally</Li>
        </div>

        {/* ── 4. The COO ───────────────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>The COO</span>
          <h2 style={h2}>Your AI executive function coach</h2>

          <p style={{ ...body, marginBottom: 12 }}>
            Each morning the COO reads your <span style={kv()}>Calendar</span>,{' '}
            <span style={kv()}>Gmail</span>, and <span style={kv()}>Tasks</span>, then builds a
            time-blocked schedule tuned to your Oura Ring readiness score — lighter cognitive
            load on low-readiness days, harder pushes when you're at your best.
          </p>

          <Divider />

          <span style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 10 }}>
            How scheduling works
          </span>

          <Li>Tasks are prioritized using the <span style={kv()}>Eisenhower Matrix</span>: Do / Schedule / Delegate / Eliminate</Li>
          <Li>Each slot shows the task, time block, and COO reasoning — <span style={kv('#0f6e56')}>Accept ✓</span> or <span style={kv('#b85c00')}>Veto ✗</span> each block individually</Li>
          <Li>Vetoing a slot triggers a COO impact assessment so you understand the trade-off, not just the outcome</Li>
          <Li>The COO learns from your Accept/Veto pattern over time and adjusts future proposals</Li>

          <Divider />

          <span style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aaa8a', display: 'block', marginBottom: 10 }}>
            Check-ins &amp; timing
          </span>

          <Li>Midday, afternoon, and evening COO check-ins keep you on track through the day</Li>
          <Li><span style={kv()}>After 2 pm</span> the COO switches to planning tomorrow — no late-day scramble or guilt spiral</Li>
          <Li>On afternoon plans, the COO may suggest one optional light evening task (≤30 min) — it is never required</Li>
        </div>

        {/* ── 5. Agent Network ─────────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>Agent Network</span>
          <h2 style={h2}>Background intelligence, domain by domain</h2>

          <p style={{ ...body, marginBottom: 12 }}>
            Beyond the daily COO, a network of domain-specific AI agents runs continuous
            background checks on each area of your life — career, health, finance, relationships,
            and more. They surface patterns you'd miss in the day-to-day noise.
          </p>

          <Li>Agents flag urgent issues and brief you when you visit their panel</Li>
          <Li>Each agent has a tunable prompt — start from the default and edit it in your own voice over time</Li>
          <Li>Rate agents up (thumbs up) to increase their trust score and refine their behavior</Li>
          <Li>Agents run silently in the background; you can also trigger a manual run at any time</Li>
          <Li>The agent network grows as you add more context — the more it knows about you, the sharper the flags</Li>
        </div>

        {/* ── 6. Best practices ────────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>How to get the most out of it</span>
          <h2 style={h2}>Practical best practices</h2>

          <Li>Complete onboarding with a detailed career and life outline — the more context you give, the better your starting tier and the more personalized your COO from day one</Li>
          <Li>Connect your <span style={kv()}>Oura Ring</span> for energy-aware scheduling — this single integration makes the biggest difference to schedule quality</Li>
          <Li>Accept or Veto your daily schedule each morning — the COO learns from your pattern, so the feedback loop is the product</Li>
          <Li>Use <span style={kv()}>Re-evaluate tier</span> in the Life Tree panel whenever your career context meaningfully changes</Li>
          <Li>Keep tasks in the Eisenhower matrix; tasks marked <span style={kv('#b85c00')}>proposed</span> are COO suggestions — confirm or dismiss them, don't let them pile up</Li>
          <Li>Complete at least 1 task per day to protect your streak and compound XP bonuses over time</Li>
          <Li>Tune agent prompts over time — the defaults are solid starting points, but your own words produce noticeably better signals</Li>
          <Li>Use the evening check-in retro to close the day — this is where the COO learns your weekly patterns and improves next-week proposals</Li>
        </div>

        {/* ── 7. ADHD-aware design ─────────────────────────────────────────────── */}
        <div style={card}>
          <span style={sectionLabel}>ADHD-aware design</span>
          <h2 style={h2}>Built for ADHD brains</h2>

          <p style={{ ...body, marginBottom: 12 }}>
            Every default in this app was chosen with executive function in mind. The structure
            is designed to reduce the activation energy for starting — not to add another
            productivity framework to manage.
          </p>

          <Li>All scheduled blocks are ≤30 min or broken into explicit chunks with transition buffers between them</Li>
          <Li>Context switching is tracked and flagged by the COO — it won't back-to-back you across unrelated domains without a reason</Li>
          <Li>Streaks, XP, tier evolution, and visible wins create a <span style={kv()}>dopamine-aware feedback loop</span> that rewards showing up, not just shipping</Li>
          <Li>No "catch up" framing on weekends — rest cycles are protected by design, never punished</Li>
          <Li>Oura readiness gates cognitive load: the COO will not schedule deep work on low-readiness days, routing those blocks to lighter or admin tasks instead</Li>
          <Li>The Eisenhower matrix makes prioritization a visual, spatial decision — not a mental one</Li>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="/" style={{
            ...mono,
            fontSize: 10,
            color: '#2d7a52',
            textDecoration: 'none',
            opacity: 0.7,
          }}>
            ← Back to app
          </a>
          <div style={{ ...mono, fontSize: 9, color: '#7aaa8a', marginTop: 10, letterSpacing: '0.08em' }}>
            Forest for the Tree · v2
          </div>
        </div>

      </div>
    </div>
  )
}
