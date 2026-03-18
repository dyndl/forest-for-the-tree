// ── COO AGENT CORE ────────────────────────────────────────────────────────────
// All Claude API calls go through here

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function callClaude(prompt, systemPrompt, maxTokens = 1500) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.map(c => c.text || '').join('') || ''
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}

function buildCooSystem(adhdAware = false) {
  const base = `You are the COO of this person's life — an executive function coach and scheduler.
You are direct, warm, and never judgmental.
- The plan must be realistic, not aspirational
- When in doubt, do less better rather than more poorly
You always respond in the exact JSON format requested. No preamble, no markdown fences.`

  const adhdAddendum = `
You are also ADHD-aware. You know that:
- Task initiation is hard — break everything into ≤30 min chunks
- Context switching is costly — protect focus blocks fiercely
- Dopamine matters — celebrate small wins explicitly`

  return adhdAware ? base + adhdAddendum : base
}

// Legacy constant kept for backwards compatibility — prefer buildCooSystem()
const COO_SYSTEM = buildCooSystem(false)

// ── MORNING BRIEF ────────────────────────────────────────────────────────────
export async function generateMorningBrief({ tasks, calendarEvents, emails, roadmap, userContext }) {
  const taskList = tasks.filter(t => !t.done).map(t =>
    `ID:${t.id} | [${t.q.toUpperCase()}] ${t.name} | ${t.blocks}×15min | ${t.cat} | ${t.who}${t.notes ? ' | ' + t.notes : ''}`
  ).join('\n') || 'No tasks yet'

  const eventList = calendarEvents.map(e =>
    `${e.start} — ${e.title}${e.location ? ' @ ' + e.location : ''}`
  ).join('\n') || 'No events today'

  const emailSummary = emails.slice(0, 5).map(e =>
    `• ${e.subject} (from: ${e.from})`
  ).join('\n') || 'No urgent emails'

  const prompt = `Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

CALENDAR TODAY:
${eventList}

URGENT EMAILS:
${emailSummary}

TASKS TO SCHEDULE:
${taskList}

4-WEEK ROADMAP GOAL: ${roadmap || 'No roadmap set yet'}

USER CONTEXT: ${userContext || 'Energy unknown'}

Build a complete time-blocked schedule from 8:00 AM to 8:00 PM.
Rules:
- Peak focus windows: Deep work / high-priority tasks only
- Protect calendar events — work around them
- 15-min break after every 90 min of focus
- Lunch 12:00-12:45
- Lower-priority tasks in low-energy windows
- Eliminate tasks: list them but do NOT schedule them
- Each block max 4 units (60 min) — then break

Respond ONLY with this JSON:
{
  "coo_message": "2-3 sentence warm COO morning note. Name the biggest risk today. Name one thing you are proud of from yesterday if tasks show any done.",
  "energy_read": "low|medium|high",
  "top_3_mits": ["MIT 1", "MIT 2", "MIT 3"],
  "eliminated": ["task names to skip today"],
  "slots": [
    {
      "time": "8:00 AM",
      "duration_blocks": 2,
      "type": "task|break|lunch|free|event",
      "task_id": "task id or null",
      "label": "short display label",
      "quadrant": "do|schedule|delegate|eliminate|null",
      "category": "user-defined life area key or null",
      "note": "1 short COO coaching note or empty string"
    }
  ]
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 2500)
  return parseJSON(raw)
}

// ── IMPACT ASSESSMENT (after veto) ───────────────────────────────────────────
export async function assessVetoImpact({ vetoedSlot, remainingSlots, tasks }) {
  const remaining = remainingSlots.filter(s => s.taskId && s.state !== 'vetoed')
    .map(s => `${s.time}: ${s.label} [${s.state}]`).join('\n') || 'Nothing left scheduled'

  const prompt = `The user vetoed this block:
Task: "${vetoedSlot.label}" at ${vetoedSlot.time} (${vetoedSlot.blocks * 15} min, ${vetoedSlot.quadrant})

Remaining schedule:
${remaining}

Respond ONLY with JSON:
{
  "impact": "1 sentence: what breaks or slips because of this veto",
  "suggestion": "1 sentence: best reschedule option with specific time",
  "severity": "low|medium|high"
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 300)
  return parseJSON(raw) || { impact: 'Block removed.', suggestion: 'Reschedule tomorrow.', severity: 'low' }
}

// ── CHECK-IN (midday / 4pm) ────────────────────────────────────────────────
export async function generateCheckin({ type, tasks, schedule, userMessage }) {
  const done = tasks.filter(t => t.done).map(t => t.name).join(', ') || 'nothing yet'
  const pending = tasks.filter(t => !t.done).map(t => t.name).join(', ') || 'none'
  const accepted = schedule?.slots?.filter(s => s.state === 'accepted').length || 0
  const vetoed = schedule?.slots?.filter(s => s.state === 'vetoed').length || 0

  const prompt = `Check-in type: ${type} (${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})

Done today: ${done}
Still pending: ${pending}
Schedule: ${accepted} accepted, ${vetoed} vetoed
User message: "${userMessage || 'none'}"

Respond ONLY with JSON:
{
  "message": "2-3 sentence warm, direct COO response. Acknowledge what got done. If drifting, name it without judgment. Give one clear next action.",
  "next_action": "the single most important thing to do in the next 30 minutes",
  "reschedule_needed": true|false,
  "adhd_flag": "string if you detect a pattern like avoidance/context-switching, else empty string"
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 400)
  return parseJSON(raw) || { message: 'Keep going — you got this.', next_action: 'Check your top task.', reschedule_needed: false, adhd_flag: '' }
}

// ── EVENING RETRO ─────────────────────────────────────────────────────────────
export async function generateEveningRetro({ tasks, schedule, roadmap }) {
  const done = tasks.filter(t => t.done)
  const pending = tasks.filter(t => !t.done)
  const totalMin = done.reduce((s, t) => s + t.blocks * 15, 0)

  const prompt = `Evening retro — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

DONE (${done.length} tasks, ${totalMin} min):
${done.map(t => `✓ ${t.name} [${t.q}]`).join('\n') || 'None'}

NOT DONE (${pending.length} tasks):
${pending.map(t => `○ ${t.name} [${t.q}]`).join('\n') || 'None'}

ROADMAP: ${roadmap || 'Land a DS/ML role'}

Respond ONLY with JSON:
{
  "headline": "one-line honest summary of today",
  "wins": ["win 1", "win 2"],
  "patterns": ["any ADHD pattern or blocker noticed"],
  "tomorrow_top3": ["task 1", "task 2", "task 3"],
  "message": "2-3 sentence supportive retro note. Be honest about what slipped. End with one thing to feel good about."
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 600)
  return parseJSON(raw) || { headline: 'Day complete.', wins: [], patterns: [], tomorrow_top3: [], message: 'Rest up.' }
}

// ── AGENT BRIEF (per-domain agent) ────────────────────────────────────────────
export async function runAgentBrief({ agent, tasks, isSilent = false }) {
  const tt = tasks.map(t => `[${t.q.toUpperCase()}] ${t.name} (${t.blocks}×15min, ${t.cat})${t.done ? ' ✓' : ''}`).join('\n') || 'No tasks'

  const suffix = isSilent
    ? `\n\nSilent background check. Today:\n${tt}\n\nIn 2-3 bullet points: any urgent flags? If none, respond with exactly: {"output":"All clear.","alert":"","urgent":false}`
    : `\n\nToday:\n${tt}\n\nGive a focused, actionable brief under 200 words. Bullet points only.`

  const prompt = (agent.customPrompt || agent.prompt) + suffix

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), isSilent ? 300 : 1000)

  if (isSilent) {
    const parsed = parseJSON(raw)
    if (parsed) return parsed
    const urgent = ['urgent', 'critical', 'overdue', 'missed', 'risk'].some(k => raw.toLowerCase().includes(k))
    return { output: raw, alert: urgent ? raw.split('\n')[0] : '', urgent }
  }

  const alertKw = ['urgent', 'critical', 'overdue', 'missed', 'warning', 'risk']
  const lower = raw.toLowerCase()
  const alert = alertKw.some(k => lower.includes(k))
    ? raw.split('\n').find(l => alertKw.some(k => l.toLowerCase().includes(k))) || ''
    : ''

  return { output: raw, alert, urgent: !!alert }
}

// ── WEEKLY REVIEW ─────────────────────────────────────────────────────────────
export async function generateWeeklyReview({ weekTasks, roadmap }) {
  const byCategory = {}
  weekTasks.forEach(t => {
    if (!byCategory[t.cat]) byCategory[t.cat] = 0
    byCategory[t.cat] += t.blocks * 15
  })

  const prompt = `Weekly review — week ending ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

TIME BY CATEGORY (minutes):
${Object.entries(byCategory).map(([k, v]) => `${k}: ${v} min`).join('\n')}

TASKS DONE: ${weekTasks.filter(t => t.done).length} of ${weekTasks.length}
ROADMAP: ${roadmap || 'Land DS/ML role'}

Respond ONLY with JSON:
{
  "headline": "honest one-line week summary",
  "on_pace": true|false,
  "wins": ["win 1", "win 2", "win 3"],
  "bottlenecks": ["bottleneck with ADHD pattern named if applicable"],
  "next_week_focus": ["priority 1", "priority 2", "priority 3"],
  "time_budget": {"area_key": "blocks_per_week (user-defined life areas)"},
  "message": "3-4 sentence supportive but honest weekly reflection."
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 800)
  return parseJSON(raw)
}

// ── RELATIONSHIP PULSE ────────────────────────────────────────────────────────

export async function generateRelationshipBrief({ contacts, overdueContacts, upcomingBirthdays, userMessage, weeklyCheckin }) {
  const overdueList = overdueContacts.slice(0, 8).map(c =>
    `${c.name} (${c.tier}, ${c.daysSince} days since contact)`
  ).join('\n') || 'None overdue'

  const birthdayList = upcomingBirthdays.map(c =>
    `${c.name} — ${c.birthdayDate} (${c.daysUntil} days)`
  ).join('\n') || 'No upcoming birthdays in 14 days'

  const totalContacts = contacts.length

  const prompt = weeklyCheckin
    ? `Weekly relationship check-in. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

OVERDUE CONTACTS (by tier threshold — close: 7d, friend: 14d, acquaintance: 30d):
${overdueList}

UPCOMING BIRTHDAYS (next 14 days):
${birthdayList}

USER MESSAGE: "${userMessage || 'Weekly check-in'}"

TOTAL CONTACTS TRACKED: ${totalContacts}

Respond ONLY with JSON:
{
  "message": "2-3 sentence warm, direct relationship COO note. Name specific people. Be human.",
  "priority_touchpoints": [
    { "name": "person name", "action": "specific suggested action e.g. text, call, coffee", "reason": "why now — birthday / overdue / context", "urgency": "today|this_week|soon" }
  ],
  "birthday_alerts": ["Name — birthday on Date (N days)"],
  "pattern": "one honest observation about social patterns this week if any",
  "next_checkin": "one thing to do before next weekly review"
}`
    : `Relationship pulse check. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}

OVERDUE: ${overdueList}
BIRTHDAYS SOON: ${birthdayList}
USER NOTE: "${userMessage || ''}"

Respond ONLY with JSON:
{
  "message": "1-2 sentence warm note. Name one specific person to reach out to today.",
  "todays_touchpoint": { "name": "person", "action": "text / call / message", "reason": "why" },
  "birthday_alert": "name and date if anyone's birthday is in next 3 days, else empty string"
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), weeklyCheckin ? 800 : 300)
  return parseJSON(raw)
}

// ── COO MEMORY WRITE-BACK ─────────────────────────────────────────────────────
// Called after each evening retro — COO updates user_context with what it learned

export async function extractAndStorePatterns({ retroResult, userId }) {
  if (!retroResult) return

  const prompt = `Based on this evening retro data, extract structured insights about this person.

Retro headline: "${retroResult.headline}"
Patterns noticed: ${JSON.stringify(retroResult.patterns || [])}
Wins: ${JSON.stringify(retroResult.wins || [])}
Tomorrow top 3: ${JSON.stringify(retroResult.tomorrow_top3 || [])}

Respond ONLY with JSON:
{
  "adhd_patterns": ["pattern names like: avoidance, context-switching, underestimating-time, hyperfocus, task-initiation"],
  "known_blockers": ["specific recurring blockers e.g. 'gets stuck on email', 'loses momentum after lunch'"],
  "coo_note": "one sentence the COO should remember about this person going forward"
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 300)
  const parsed = parseJSON(raw)
  return parsed
}

// ── OURA-AWARE MORNING BRIEF ──────────────────────────────────────────────────
// Upgraded version that takes Oura context into account

export async function generateMorningBriefWithOura({ tasks, calendarEvents, emails, roadmap, ouraData, userContext }) {
  const taskList = tasks.filter(t => !t.done).map(t =>
    `ID:${t.id} | [${t.q.toUpperCase()}] ${t.name} | ${t.blocks}×15min | ${t.cat} | ${t.who}${t.notes ? ' | ' + t.notes : ''}`
  ).join('\n') || 'No tasks yet'

  const eventList = calendarEvents.map(e =>
    `${e.start} — ${e.title}${e.location ? ' @ ' + e.location : ''}`
  ).join('\n') || 'No events today'

  const emailSummary = emails.slice(0, 5).map(e => `• ${e.subject} (from: ${e.from})`).join('\n') || 'No urgent emails'

  const ouraContext = ouraData ? `
OURA RING DATA (this morning):
- Readiness score: ${ouraData.readiness?.score || 'N/A'}/100 → Energy level: ${ouraData.energy_level}
- Sleep score: ${ouraData.sleep?.score || 'N/A'}/100
- ${ouraData.readiness?.energy_note || ''}
- ${ouraData.sleep?.summary || ''}
` : 'No Oura data available — use user-reported energy level'

  const userCtx = userContext || {}
  const peakHours = userCtx.peak_hours || '9-11am, 3-5pm'
  const knownPatterns = userCtx.adhd_patterns?.length > 0
    ? `Known ADHD patterns for this person: ${userCtx.adhd_patterns.join(', ')}`
    : ''
  const knownBlockers = userCtx.known_blockers?.length > 0
    ? `Known blockers: ${userCtx.known_blockers.join(', ')}`
    : ''
  const cooNotes = userCtx.coo_notes || ''

  const prompt = `Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

${ouraContext}

CALENDAR TODAY:
${eventList}

URGENT EMAILS:
${emailSummary}

TASKS TO SCHEDULE:
${taskList}

4-WEEK ROADMAP: ${roadmap || userCtx.roadmap || 'No roadmap set yet'}
PEAK FOCUS HOURS: ${peakHours}
${knownPatterns}
${knownBlockers}
${cooNotes ? 'COO NOTES: ' + cooNotes : ''}

Build a complete time-blocked schedule 8:00 AM to 8:00 PM.
Rules:
- Use Oura readiness to calibrate intensity: low readiness = lighter cognitive load, protect energy
- Peak focus windows (${peakHours}): Deep work / high-priority tasks ONLY
- Work around calendar events exactly — do not overlap
- 15-min break after every 90 min of focus
- Lunch 12:00-12:45
- Fitness in low-energy windows — but if readiness is low, make it gentle (walk vs gym)
- Eliminate tasks: list but do NOT schedule
- Max 60 min per block then break
- If readiness < 60, cap deep work blocks at 45 min max

Respond ONLY with this JSON (no markdown, no preamble):
{
  "coo_message": "2-3 sentence warm morning note referencing Oura data specifically if available. Name the day's biggest risk. End with one encouragement.",
  "energy_read": "low|medium|high",
  "oura_note": "one sentence on how Oura data shaped today's plan, or empty string",
  "top_3_mits": ["MIT 1", "MIT 2", "MIT 3"],
  "eliminated": ["task names to skip today with one-word reason"],
  "slots": [
    {
      "time": "8:00 AM",
      "duration_blocks": 2,
      "type": "task|break|lunch|free|event",
      "task_id": "task id or null",
      "label": "short display label",
      "quadrant": "do|schedule|delegate|eliminate|null",
      "category": "user-defined life area key or null",
      "note": "1 short COO coaching note or empty string"
    }
  ]
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 2500)
  return parseJSON(raw)
}
