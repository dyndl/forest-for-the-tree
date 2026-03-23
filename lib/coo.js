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

  const priorityCategories = ['interview', 'action_required', 'job_application', 'linkedin']
  const sortedEmails = [
    ...emails.filter(e => priorityCategories.includes(e.category)),
    ...emails.filter(e => !priorityCategories.includes(e.category)),
  ].slice(0, 8)
  const emailSummary = sortedEmails.length > 0
    ? sortedEmails.map(e => `• [${e.category || 'inbox'}] ${e.subject} (from: ${e.from})`).join('\n')
    : 'No urgent emails'

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

  const raw = await callClaude(prompt, buildCooSystem(userContext?.adhd_aware ?? false), 2500)
  return parseJSON(raw)
}

// ── COO BOOT — personalised background proposals ──────────────────────────────
export async function generateBootProposals({ userCtx, inboxStats, calendarCount, contactCount, hasOura }) {
  const lifeAreas = (userCtx?.life_areas || []).map(a => a.label).join(', ') || 'not yet defined'
  const roadmap   = userCtx?.roadmap || ''
  const outline   = (userCtx?.outline || '').slice(0, 600)
  const hasGmail  = (inboxStats?.total || 0) > 0

  const prompt = `You are a new user's COO performing first-boot setup. Based on the scan results below, generate 3-5 personalised background task proposals.

SCAN RESULTS:
${hasGmail
  ? `- Gmail: ${inboxStats.unread} unread, ${inboxStats.subscriptions} subscription emails, ${inboxStats.total} total in inbox`
  : '- Gmail: not connected or empty'}
- Calendar: ${calendarCount} events in next 14 days
- Contacts: ${contactCount} contacts
- Oura Ring: ${hasOura ? 'connected' : 'not connected'}

USER CONTEXT:
- Life areas: ${lifeAreas}
- 4-week goal: ${roadmap}
- Outline: ${outline}

Rules:
- Only propose inbox/Gmail tasks if Gmail is connected (total > 0)
- Label proposals should reference the user's actual life areas by name
- Propose unsubscribe only if subscriptions > 50
- Reference real numbers from the scan in the rationale
- Each rationale: 1-2 sentences, plain English

Respond ONLY with JSON array (no fences):
[
  {
    "id": "snake_case_id",
    "icon": "single emoji",
    "title": "action title ≤8 words",
    "rationale": "1-2 sentences specific to scan data",
    "eta": "~X min",
    "category": "inbox | calendar | contacts | system"
  }
]`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware || false), 900)
  return parseJSON(raw) || []
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

  const raw = await callClaude(prompt, buildCooSystem(false), 300)
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

  const raw = await callClaude(prompt, buildCooSystem(false), 400)
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

ROADMAP: ${roadmap || 'No roadmap set yet'}

Respond ONLY with JSON:
{
  "headline": "one-line honest summary of today",
  "wins": ["win 1", "win 2"],
  "patterns": ["any ADHD pattern or blocker noticed"],
  "tomorrow_top3": ["task 1", "task 2", "task 3"],
  "message": "2-3 sentence supportive retro note. Be honest about what slipped. End with one thing to feel good about."
}`

  const raw = await callClaude(prompt, buildCooSystem(false), 600)
  return parseJSON(raw) || { headline: 'Day complete.', wins: [], patterns: [], tomorrow_top3: [], message: 'Rest up.' }
}

// ── AGENT BRIEF (per-domain agent) ────────────────────────────────────────────
export async function runAgentBrief({ agent, tasks, isSilent = false }) {
  const tt = tasks.map(t => `[${t.q.toUpperCase()}] ${t.name} (${t.blocks}×15min, ${t.cat})${t.done ? ' ✓' : ''}`).join('\n') || 'No tasks'

  const suffix = isSilent
    ? `\n\nSilent background check. Today:\n${tt}\n\nIn 2-3 bullet points: any urgent flags? If none, respond with exactly: {"output":"All clear.","alert":"","urgent":false}`
    : `\n\nToday:\n${tt}\n\nGive a focused, actionable brief under 200 words. Bullet points only.`

  const prompt = (agent.customPrompt || agent.prompt) + suffix

  const raw = await callClaude(prompt, buildCooSystem(false), isSilent ? 300 : 1000)

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
ROADMAP: ${roadmap || 'No roadmap set yet'}

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

  const raw = await callClaude(prompt, buildCooSystem(false), 800)
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

  const raw = await callClaude(prompt, buildCooSystem(false), weeklyCheckin ? 800 : 300)
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

  const raw = await callClaude(prompt, buildCooSystem(false), 300)
  const parsed = parseJSON(raw)
  return parsed
}

// ── OURA-AWARE MORNING BRIEF ──────────────────────────────────────────────────
// Upgraded version that takes Oura context into account

export async function generateMorningBriefWithOura({ tasks, calendarEvents, emails, roadmap, ouraData, userContext, currentHour }) {
  const now = new Date()
  const hour = currentHour ?? now.getHours()

  // ── Time-horizon logic ────────────────────────────────────────────────────
  // After 2PM: the day is too far along — plan for tomorrow instead
  const planForTomorrow = hour >= 14
  const targetDate = new Date(now)
  if (planForTomorrow) targetDate.setDate(targetDate.getDate() + 1)
  const planDateKey = targetDate.toISOString().slice(0, 10)
  const planDateLabel = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // ── Weekend awareness ─────────────────────────────────────────────────────
  const targetDay = targetDate.getDay() // 0=Sun, 6=Sat
  const isWeekend = targetDay === 0 || targetDay === 6
  const weekendNote = isWeekend
    ? `\nWEEKEND: ${planDateLabel} is a ${targetDay === 6 ? 'Saturday' : 'Sunday'}. The week starts Monday — the user is NOT behind. Weekend progress is encouraged but entirely optional. Suggest only light, energising, or personally meaningful tasks. NO work obligations, no "catch up" framing. Protect rest and recovery.`
    : ''

  // Start time: don't schedule blocks that are already in the past
  const startHour = planForTomorrow ? 8 : Math.max(8, hour + 1)
  const fmt = h => `${h <= 12 ? h : h - 12}:00 ${h < 12 ? 'AM' : 'PM'}`
  const scheduleWindow = `${fmt(startHour)} to 8:00 PM`

  // Tonight guidance (only relevant when planning for tomorrow)
  const tonightGuidance = planForTomorrow
    ? hour >= 21
      ? '\nTONIGHT: It is late — do NOT suggest any tasks tonight. Rest is the priority.'
      : hour >= 17
        ? '\nTONIGHT: It is evening. Optionally add ONE very light task (≤30 min) before 9:30 PM — admin, light reading, quick review only. NO deep work. ADHD note: winding down matters more than squeezing in work.'
        : '\nTONIGHT: It is afternoon. You may optionally suggest ONE light task for this evening (before 9 PM) if it genuinely helps tomorrow — e.g. laying out materials, a quick email. Keep it ≤30 min. Not required.'
    : ''

  const taskList = tasks.filter(t => !t.done).map(t =>
    `ID:${t.id} | [${t.q.toUpperCase()}] ${t.name} | ${t.blocks}×15min | ${t.cat} | ${t.who}${t.notes ? ' | ' + t.notes : ''}`
  ).join('\n') || 'No open tasks'

  const eventList = calendarEvents.map(e =>
    `${e.start} — ${e.title}${e.location ? ' @ ' + e.location : ''}`
  ).join('\n') || `No events on ${planDateLabel}`

  const priorityCategories = ['interview', 'action_required', 'job_application', 'linkedin']
  const sortedEmails = [
    ...emails.filter(e => priorityCategories.includes(e.category)),
    ...emails.filter(e => !priorityCategories.includes(e.category)),
  ].slice(0, 8)
  const emailSummary = sortedEmails.length > 0
    ? sortedEmails.map(e => `• [${e.category || 'inbox'}] ${e.subject} (from: ${e.from})`).join('\n')
    : 'No urgent emails'

  const ouraContext = ouraData ? `
OURA RING DATA (this morning):
- Readiness score: ${ouraData.readiness?.score || 'N/A'}/100 → Energy level: ${ouraData.energy_level}
- Sleep score: ${ouraData.sleep?.score || 'N/A'}/100
- ${ouraData.readiness?.energy_note || ''}
- ${ouraData.sleep?.summary || ''}
` : 'No Oura data — use user-reported energy level'

  const userCtx = userContext || {}
  const peakHours = userCtx.peak_hours || '9-11am, 3-5pm'
  const knownPatterns = userCtx.adhd_patterns?.length > 0
    ? `Known ADHD patterns for this person: ${userCtx.adhd_patterns.join(', ')}`
    : ''
  const knownBlockers = userCtx.known_blockers?.length > 0
    ? `Known blockers: ${userCtx.known_blockers.join(', ')}`
    : ''
  const cooNotes = userCtx.coo_notes || ''

  const prompt = `Current time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
PLANNING FOR: ${planForTomorrow ? `Tomorrow — ${planDateLabel}` : `Today — ${planDateLabel}`}
${tonightGuidance}${weekendNote}

${ouraContext}

CALENDAR (${planDateLabel}):
${eventList}

URGENT EMAILS:
${emailSummary}

OPEN TASKS:
${taskList}

4-WEEK ROADMAP: ${roadmap || userCtx.roadmap || 'No roadmap set yet'}
PEAK FOCUS HOURS: ${peakHours}
${knownPatterns}
${knownBlockers}
${cooNotes ? 'COO NOTES: ' + cooNotes : ''}

Build a complete time-blocked schedule from ${scheduleWindow} for ${planDateLabel}.
Rules:
- Use Oura readiness to calibrate intensity: low readiness = lighter cognitive load
- Peak focus windows (${peakHours}): Deep work / high-priority tasks ONLY
- Work around calendar events exactly — do not overlap
- 15-min break after every 90 min of focus
- Lunch 12:00-12:45
- Fitness in low-energy windows — if readiness is low, gentle movement only
- Eliminate tasks: list but do NOT schedule
- Max 60 min per block then break
- If readiness < 60, cap deep work blocks at 45 min max
- ADHD: never schedule back-to-back deep work without a transition buffer
- If tonightGuidance mentions a tonight task, include it as a slot with time "Tonight" and type "optional_tonight" at the END of the slots array
${planForTomorrow ? '- The coo_message should acknowledge it is now ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' and this plan is for tomorrow — be warm about the evening transition' : ''}

Respond ONLY with this JSON (no markdown, no preamble):
{
  "plan_date": "${planDateKey}",
  "coo_message": "2-3 sentence warm note. If planning for tomorrow: acknowledge current time, affirm that resting tonight is smart, preview tomorrow. If planning for today: name the day's biggest risk and end with encouragement.",
  "energy_read": "low|medium|high",
  "oura_note": "one sentence on how Oura data shaped the plan, or empty string",
  "top_3_mits": ["MIT 1", "MIT 2", "MIT 3"],
  "eliminated": ["task names to skip with one-word reason"],
  "slots": [
    {
      "time": "8:00 AM",
      "duration_blocks": 2,
      "type": "task|break|lunch|free|event|optional_tonight",
      "task_id": "task id or null",
      "label": "short display label",
      "quadrant": "do|schedule|delegate|eliminate|null",
      "category": "user-defined life area key or null",
      "note": "1 short COO coaching note or empty string"
    }
  ]
}`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? userContext?.adhd_aware ?? false), 2500)
  const parsed = parseJSON(raw)
  // Ensure plan_date is always set even if Claude omits it
  if (parsed && !parsed.plan_date) parsed.plan_date = planDateKey
  return parsed
}

// ── DAILY TASK PROPOSALS ──────────────────────────────────────────────────────
export async function generateTaskProposals({ emails = [], calendarEvents = [], tasks = [], roadmap = '', outline = '', lifeAreas = [], adhdAware = false }) {
  const emailCtx = emails.slice(0, 8).map(e => `• [${e.category || 'inbox'}] ${e.subject} — from ${e.from}`).join('\n') || 'No recent emails'
  const calCtx = calendarEvents.slice(0, 6).map(e => `${e.start} — ${e.title}`).join('\n') || 'No upcoming events'
  const existing = tasks.filter(t => !t.done).map(t => t.name).join(', ') || 'none'
  const areas = lifeAreas.map(a => `${a.emoji || ''} ${a.key} (${a.label})`).join(', ') || 'career, admin, learning'
  const areaKeys = lifeAreas.map(a => a.key).join(', ') || 'career, admin, learning, fitness, family, finance'

  const prompt = `You are this user's autonomous COO. Based on their current context, propose 4-8 concrete tasks they should work on today or this week.

RECENT EMAILS:
${emailCtx}

UPCOMING CALENDAR:
${calCtx}

ALREADY ON THEIR PLATE: ${existing}

4-WEEK GOAL: ${roadmap || 'not set'}
CAREER OUTLINE: ${outline.slice(0, 600)}
LIFE AREAS: ${areas}

Rules:
- Do NOT re-propose tasks already on their plate (listed above)
- Each task must be concrete and completable in ≤90 min
- cat must be one of: ${areaKeys}
- q="do" for urgent+important, "schedule" for important not urgent
- Reference the actual email subject, event, or goal in rationale — be specific
- "Apply to [Company] via LinkedIn" is better than "apply for jobs"
- blocks = 15-min units (1=15min, 2=30min, 4=60min)

Respond ONLY with a JSON array:
[{"id":"snake_case_id","name":"task ≤10 words","cat":"area_key","blocks":2,"q":"do","rationale":"1-2 sentences why now, referencing specific context"}]`

  try {
    const raw = await callClaude(prompt, buildCooSystem(adhdAware), 1200)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return Array.isArray(parsed) ? parsed.map(p => ({ ...p, source: 'coo_proposal' })) : []
  } catch {
    return []
  }
}
