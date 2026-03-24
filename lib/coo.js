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
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error(`Claude API error ${res.status}:`, errText)
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`)
  }
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

  const reason = vetoedSlot.veto_reason || ''

  const prompt = `The user vetoed this scheduled block:
Task: "${vetoedSlot.label}" at ${vetoedSlot.time} (${vetoedSlot.quadrant})
${reason ? `User's reason: "${reason}"` : 'No reason given.'}

Remaining schedule:
${remaining}

CRITICAL: Read the user's reason carefully before responding. Let the reason completely shape your response.
- If the reason shows the task is no longer relevant (rejected application, cancelled meeting, resolved issue, etc.) → impact should acknowledge that and severity should be low/none
- If the reason shows timing/energy issue → suggest a specific reschedule
- If the reason shows a blocker → call it out clearly
- Never suggest rescheduling something the user has told you is now pointless

Respond ONLY with JSON:
{
  "impact": "1-2 sentences directly addressing the user's reason — show you actually read it",
  "suggestion": "1 sentence: concrete next action or 'No action needed' if task is no longer relevant",
  "severity": "low|medium|high"
}`

  const raw = await callClaude(prompt, buildCooSystem(false), 400)
  return parseJSON(raw) || { impact: 'Block removed.', suggestion: 'No action needed.', severity: 'low' }
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
export async function generateEveningRetro({ tasks, schedule, roadmap, incompleteTasks = [] }) {
  const done = tasks.filter(t => t.done)
  const incomplete = incompleteTasks.length > 0 ? incompleteTasks : tasks.filter(t => !t.done && t.status !== 'wont_do')
  const totalMin = done.reduce((s, t) => s + t.blocks * 15, 0)
  const doneList = done.map(t => `✓ ${t.name} (${t.blocks * 15}min)`).join('\n') || 'Nothing completed today'
  const incompleteList = incomplete.map(t => `• [${t.q}] ${t.name} — ${t.blocks * 15}min, ${t.cat}`).join('\n') || 'All tasks completed!'

  // Detect recurring-looking blocks in today's schedule
  const recurringLike = (schedule?.slots || [])
    .filter(s => s.label && /\b(call|standup|block|meeting|sync|weekly|daily)\b/i.test(s.label))
    .map(s => `"${s.label}" at ${s.time}`)
    .slice(0, 3)
  const calendarCtx = recurringLike.length
    ? `RECURRING-LOOKING BLOCKS ON TODAY'S SCHEDULE: ${recurringLike.join(', ')}`
    : ''

  const prompt = `Evening COO retro — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}

COMPLETED (${done.length} tasks, ${totalMin} min invested):
${doneList}

NOT FINISHED (${incomplete.length} tasks):
${incompleteList}

4-WEEK ROADMAP: ${roadmap || 'not set'}
${calendarCtx}

Your job:
1. Give an honest, specific retro — name what actually got in the way (not generic)
2. For EACH incomplete task, decide: tomorrow | this_week | drop — with a brief reason
3. If recurring blocks were noticed, ask ONE pointed question about whether the user still needs them (be specific about which block)
4. Propose tomorrow's TOP 3 focus areas based on what rolled over + what's most strategic

Respond ONLY with JSON (no fences):
{
  "headline": "honest 1-line day summary",
  "wins": ["specific win 1", "specific win 2"],
  "message": "3-4 sentence warm but honest retro. Be specific about what got in the way. End with what tomorrow is for.",
  "incomplete_decisions": [{"task": "task name", "action": "tomorrow|this_week|drop", "reason": "one short reason"}],
  "calendar_question": "ONE specific question about a recurring block (e.g. 'Monday afternoon call has been on your calendar weekly — is this still recurring or was it one-off?'), or empty string if no blocks noticed",
  "tomorrow_focus": ["top priority 1", "priority 2", "priority 3"],
  "tomorrow_trigger": true
}`

  const raw = await callClaude(prompt, buildCooSystem(false), 900)
  return parseJSON(raw) || {
    headline: 'Day done.', wins: [], message: 'Time to rest and reset.',
    incomplete_decisions: [], calendar_question: '', tomorrow_focus: [], tomorrow_trigger: false,
  }
}

// ── AGENT PLAN CONTRIBUTION ───────────────────────────────────────────────────
// Called before schedule generation — each agent submits domain task priorities
export async function runAgentPlanContrib({ agent, goals = [], tasks = [], roadmap = '', userCtx = {} }) {
  const activeGoals = goals.filter(g => g.status === 'active')
  // Prefer goals matching agent's area, fall back to all active goals
  const domainGoals = activeGoals.filter(g =>
    g.category === agent.area || agent.area?.includes(g.category) || g.category?.includes(agent.area)
  )
  const relevantGoals = (domainGoals.length ? domainGoals : activeGoals).slice(0, 4)
  const domainTasks = tasks.filter(t => !t.done && (t.cat === agent.area || t.cat?.includes(agent.area))).slice(0, 6)

  const goalList = relevantGoals.map(g =>
    `• ${g.emoji || ''} ${g.title}${g.target_date ? ` (target: ${g.target_date})` : ''}${g.milestones?.length ? ` — ${g.milestones.filter(m => m.done).length}/${g.milestones.length} milestones done` : ''}`
  ).join('\n') || 'No active goals in this area'

  const taskList = domainTasks.map(t =>
    `• [${t.q}] ${t.name} — ${t.blocks * 15}min (${t.date})`
  ).join('\n') || 'No existing tasks in this area'

  const prompt = `You are ${agent.name}. Your role: ${(agent.custom_prompt || agent.prompt || '').slice(0, 200)}

You are contributing to the COO's planning session for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.

ACTIVE GOALS IN YOUR DOMAIN:
${goalList}

OPEN TASKS ALREADY QUEUED:
${taskList}

4-WEEK ROADMAP: ${roadmap || 'not set'}

Respond with 2–4 bullet points specifying the 1–3 most valuable tasks to prioritize TODAY or THIS WEEK in your domain. For each task: name it concisely, estimate time in 15-min blocks, and explicitly connect it to a goal milestone. Flag any sequencing dependencies or blockers.`

  try {
    const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware ?? false), 450)
    return { area: agent.area, name: agent.name, icon: agent.icon || '◦', suggestions: raw.trim() }
  } catch {
    return null
  }
}

// ── GATHER AGENT CONTRIBUTIONS (parallel fan-out) ─────────────────────────────
export async function gatherAgentContributions({ agents = [], goals = [], tasks = [], roadmap = '', userCtx = {} }) {
  const activeGoals = goals.filter(g => g.status === 'active')
  if (!agents.length || !activeGoals.length) return ''

  const activeAgents = agents.filter(a => a.status !== 'disabled' && a.status !== 'thinking').slice(0, 8)
  if (!activeAgents.length) return ''

  const contribs = await Promise.all(
    activeAgents.map(a => runAgentPlanContrib({ agent: a, goals, tasks, roadmap, userCtx }))
  )

  const valid = contribs.filter(Boolean)
  if (!valid.length) return ''

  return `AGENT INTELLIGENCE — your domain specialists have weighed in. Incorporate these priorities into today's plan:\n\n${
    valid.map(c => `${c.icon} ${c.name} (${c.area}):\n${c.suggestions}`).join('\n\n')
  }`
}

// ── AGENT BRIEF (per-domain agent) ────────────────────────────────────────────
export async function runAgentBrief({ agent, tasks, goals = [], isSilent = false }) {
  const tt = tasks.map(t => `[${t.q.toUpperCase()}] ${t.name} (${t.blocks}×15min, ${t.cat})${t.done ? ' ✓' : ''}`).join('\n') || 'No tasks'

  const domainGoals = goals.filter(g => g.status === 'active' &&
    (g.category === agent.area || agent.area?.includes(g.category) || g.category?.includes(agent.area)))
  const goalCtx = domainGoals.length > 0
    ? `\n\nACTIVE GOALS IN YOUR DOMAIN:\n${domainGoals.map(g => `• ${g.title}${g.target_date ? ` (by ${g.target_date})` : ''} — ${g.milestones?.filter(m => m.done).length || 0}/${g.milestones?.length || 0} milestones`).join('\n')}`
    : ''

  const suffix = isSilent
    ? `${goalCtx}\n\nSilent background check. Today:\n${tt}\n\nIn 2-3 bullet points: any urgent flags or goal drift? If none: {"output":"All clear.","alert":"","urgent":false}`
    : `${goalCtx}\n\nToday:\n${tt}\n\nGive a focused brief under 200 words. Reference goal progress where relevant. Bullet points only.`

  const prompt = (agent.custom_prompt || agent.prompt) + suffix

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

export async function generateMorningBriefWithOura({ tasks, calendarEvents, emails, roadmap, ouraData, userContext, currentHour, vetoHistory = '', agentContributions = '' }) {
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
  const timeBudget = userCtx.weekly_time_budget && Object.keys(userCtx.weekly_time_budget).length > 0
    ? `WEEKLY TIME TARGETS (15-min blocks/week per life area):\n${Object.entries(userCtx.weekly_time_budget).map(([k, v]) => `- ${k}: ${v} blocks (${(v * 15 / 60).toFixed(1)}h/wk)`).join('\n')}\nBalance today's schedule across areas. Don't over-index on one area.`
    : ''

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
${timeBudget}
${knownPatterns}
${knownBlockers}
${cooNotes ? 'COO NOTES: ' + cooNotes : ''}
${agentContributions ? '\n' + agentContributions : ''}
${vetoHistory ? '\n' + vetoHistory : ''}

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
- VETO LEARNING: do NOT re-propose any task or pattern that appears in the RECENT VETOES list above
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
      "note": "1 short COO coaching note or empty string",
      "source_ref": "mailto:sender@address if this slot is triggered by an email, https://url if from a calendar event link, else empty string"
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
- source_ref: if derived from an email, output "mailto:sender@address" using the exact From address; if from a URL in the email/calendar, output that URL; if from a goal only, output empty string

Respond ONLY with a JSON array:
[{"id":"snake_case_id","name":"task ≤10 words","cat":"area_key","blocks":2,"q":"do","rationale":"1-2 sentences why now, referencing specific context","source_ref":"mailto:sender@example.com or https://... or empty string"}]`

  try {
    const raw = await callClaude(prompt, buildCooSystem(adhdAware), 1200)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return Array.isArray(parsed) ? parsed.map(p => ({ ...p, source: 'coo_proposal' })) : []
  } catch {
    return []
  }
}

// ── GOAL STRUCTURER ───────────────────────────────────────────────────────────
export async function structureGoal({ title, description = '', target_date = null, userCtx = {} }) {
  const outline = (userCtx?.outline || '').slice(0, 500)
  const lifeAreas = (userCtx?.life_areas || []).map(a => a.label || a).join(', ') || 'not defined'
  const daysToTarget = target_date
    ? Math.round((new Date(target_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const prompt = `A user wants to set this goal: "${title}"
${description ? 'Details: ' + description : ''}
${daysToTarget != null ? `Target: ${target_date} (${daysToTarget} days from now)` : ''}

User context:
- Background: ${outline || 'not provided'}
- Life areas: ${lifeAreas}
- 4-week roadmap: ${userCtx?.roadmap || 'not set'}

Structure this goal for their personal COO system. Be specific to their context — not generic.

Respond ONLY with JSON (no fences):
{
  "emoji": "single emoji",
  "category": "career|learning|fitness|finance|family|admin",
  "coo_note": "2-3 sentences: how the COO will actively help track and drive this goal — be concrete about what it will monitor or propose",
  "milestones": [
    { "id": "m1", "label": "concrete milestone ≤8 words", "done": false }
  ],
  "metrics": [
    { "key": "snake_case", "label": "Metric name", "value": 0, "target": 10, "unit": "count|%" }
  ],
  "suggested_agents": [
    { "name": "Agent Name", "icon": "emoji", "area": "career|learning|fitness|finance|family|admin", "prompt": "You are a specialized COO agent focused on..." }
  ]
}

Rules:
- 3–6 milestones, sequential and concrete
- 1–4 metrics that are genuinely countable (no subjective scores)
- 0–2 suggested agents — only propose if an agent would meaningfully help; leave array empty if not
- If this is a job search goal, metrics should include applications, interviews, offers`

  const raw = await callClaude(prompt, buildCooSystem(userCtx?.adhd_aware || false), 900)
  return parseJSON(raw) || {}
}

// ── JOB APPLICATION PARSER ────────────────────────────────────────────────────
export async function parseJobApplications({ emails = [], existing = {} }) {
  const applications = existing.applications || []
  const leads = existing.leads || []

  const jobEmails = emails.filter(e => ['interview', 'job_application', 'linkedin', 'action_required'].includes(e.category))
  if (!jobEmails.length) {
    return { applications, leads, last_scanned: new Date().toISOString() }
  }

  const emailText = jobEmails.map(e =>
    `[${e.category}] From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${(e.snippet || '').slice(0, 200)}`
  ).join('\n\n')
  const existingApps = applications.map(a => `${a.company}/${a.role}(${a.status})`).join(', ') || 'none'

  const prompt = `Analyze these job-related emails and extract structured tracking data.

EMAILS:
${emailText.slice(0, 3000)}

ALREADY TRACKED: ${existingApps}

Extract:
1. applications — jobs actively in pipeline. Infer from ATS emails (Greenhouse, Lever, Workday), interview invites, rejection emails. Update status for already-tracked items if emails show progress.
2. leads — individual job postings from LinkedIn job alert emails NOT yet applied to.

Status values: applied | screening | interview | offer | rejected | closed

Respond ONLY with JSON (no fences):
{"applications":[{"id":"company_role_slug","company":"Company Name","role":"Job Title","status":"applied","date_applied":"YYYY-MM-DD or null","last_activity":"YYYY-MM-DD","source":"linkedin|ats|direct","notes":""}],"leads":[{"id":"company_role_slug","company":"Company Name","role":"Job Title","url":""}]}`

  try {
    const raw = await callClaude(prompt, buildCooSystem(false), 1200)
    const parsed = parseJSON(raw)
    if (!parsed) return { applications, leads, last_scanned: new Date().toISOString() }

    // Merge applications: new data wins for status, don't duplicate
    const merged = [...applications]
    for (const na of (parsed.applications || [])) {
      const idx = merged.findIndex(a => a.id === na.id ||
        (a.company?.toLowerCase() === na.company?.toLowerCase() && a.role?.toLowerCase() === na.role?.toLowerCase()))
      if (idx >= 0) merged[idx] = { ...merged[idx], ...na }
      else merged.push(na)
    }

    // Merge leads: skip if already an application, skip duplicates
    const appKeys = new Set(merged.map(a => `${a.company?.toLowerCase()}_${a.role?.toLowerCase()}`))
    const existLeadIds = new Set(leads.map(l => l.id))
    const freshLeads = [...leads]
    for (const lead of (parsed.leads || [])) {
      const key = `${lead.company?.toLowerCase()}_${lead.role?.toLowerCase()}`
      if (!appKeys.has(key) && !existLeadIds.has(lead.id)) freshLeads.push(lead)
    }

    return { applications: merged, leads: freshLeads.slice(0, 20), last_scanned: new Date().toISOString() }
  } catch {
    return { applications, leads, last_scanned: new Date().toISOString() }
  }
}

// ── AUTO-SEED GOALS FROM CONTEXT ─────────────────────────────────────────────
export async function proposeInitialGoals({ outline = '', roadmap = '', lifeAreas = [], emailContext = '', existingGoalCategories = [] }) {
  const areas = lifeAreas.filter(a => a.label).map(a => `${a.emoji || ''} ${a.label} (key: ${a.key || a.label.toLowerCase()})`).join('\n') || 'not defined'
  const skipAreas = existingGoalCategories.length ? `\nSkip these life areas — goals already exist: ${existingGoalCategories.join(', ')}` : ''

  const prompt = `Based on this person's profile, propose ONE strategic goal per life area listed below — covering EVERY life area, not just the ones with email evidence.

BACKGROUND / RESUME:
${outline.slice(0, 1000) || 'Not provided'}

4-WEEK ROADMAP: ${roadmap || 'Not set'}

LIFE AREAS TO COVER (propose one goal each):
${areas}
${skipAreas}

RECENT EMAIL SIGNALS:
${emailContext.slice(0, 600) || 'Not available'}

Rules:
- Cover EVERY life area listed — do not skip any
- For areas with no email context, infer a reasonable goal from the background
- Mix timeframes: some 4-week sprints, some 3–6 month objectives
- 3–4 concrete sequential milestones per goal
- 1–2 trackable metrics per goal (real numbers, not vibes)
- Suggest an agent only when automation would genuinely help (e.g. fitness tracker, job scanner, finance monitor)

Respond ONLY with JSON array (no fences):
[{
  "title": "concise goal title",
  "description": "1–2 sentences grounded in their context",
  "category": "career|fitness|finance|learning|family|admin|personal",
  "emoji": "single emoji",
  "milestones": [{"id":"m1","label":"milestone ≤8 words","done":false}],
  "metrics": [{"key":"snake_case","label":"Metric name","value":0,"target":10}],
  "suggested_agents": [
    {"name":"Agent Name","icon":"emoji","area":"fitness|career|finance|learning|family|admin","prompt":"You are a specialized COO agent focused on..."}
  ]
}]`

  const raw = await callClaude(prompt, buildCooSystem(false), 2400)
  return parseJSON(raw) || []
}

// ── FREE-FORM CHAT ────────────────────────────────────────────────────────────
export async function generateChatResponse({ userMessage, tasks, schedule, userCtx, emails = [], calendarEvents = [] }) {
  const done = tasks.filter(t => t.done).map(t => t.name).join(', ') || 'none'
  const pending = tasks.filter(t => !t.done).map(t => t.name).join(', ') || 'none'
  const roadmap = userCtx?.roadmap || 'not set'
  const lifeAreas = (userCtx?.life_areas || []).map(a => a.label).join(', ') || 'not defined'
  const goals = (userCtx?.goals || []).filter(g => g.status === 'active').map(g => g.title).join(', ') || 'none'
  const adhdAware = userCtx?.adhd_aware ?? false
  const accepted = schedule?.slots?.filter(s => s.state === 'accepted').length || 0
  const vetoed = schedule?.slots?.filter(s => s.state === 'vetoed').length || 0

  const emailCtx = emails.length > 0
    ? emails.slice(0, 8).map(e => `• [${e.category}] "${e.subject}" from ${e.from}${e.snippet ? ' — ' + e.snippet.slice(0, 80) : ''}`).join('\n')
    : 'No recent emails fetched'
  const calCtx = calendarEvents.length > 0
    ? calendarEvents.slice(0, 5).map(e => `• ${e.start} — ${e.title}`).join('\n')
    : 'No calendar events today'

  const prompt = `The user is asking their COO a direct question or sharing something. Answer helpfully as their COO.

TODAY'S CONTEXT:
- Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
- Done today: ${done}
- Still pending: ${pending}
- Schedule: ${accepted} accepted, ${vetoed} vetoed
- Roadmap: ${roadmap}
- Life areas: ${lifeAreas}
- Active goals: ${goals}

RECENT EMAILS (you have full access to these):
${emailCtx}

TODAY'S CALENDAR:
${calCtx}

USER: "${userMessage}"

Respond ONLY with JSON (no fences):
{
  "message": "Your COO response — direct, warm, max 4 sentences. Reference specific emails or events by name when relevant.",
  "reschedule_needed": false
}`

  const raw = await callClaude(prompt, buildCooSystem(adhdAware), 500)
  return parseJSON(raw) || { message: "I'm here. What do you need?", reschedule_needed: false }
}

// ── TASK NOTE ENRICHER ────────────────────────────────────────────────────────
// For manually-created tasks: generate a brief note with source evidence
// (email/calendar references) so parseLinks() can surface clickable origins.
export async function enrichTaskNotes({ taskName, emails = [], calendarEvents = [] }) {
  const emailCtx = emails.slice(0, 5).map(e => `[${e.from}] ${e.subject}`).join('\n') || 'none'
  const calCtx = calendarEvents.slice(0, 4).map(e => `${e.start} — ${e.title}`).join('\n') || 'none'

  const prompt = `The user just created a task: "${taskName}"

Recent emails:
${emailCtx}

Upcoming calendar events:
${calCtx}

If any email or calendar event is clearly related to this task, output a brief note (1-2 sentences) explaining the connection AND a source_ref (mailto:address or https://url). If nothing is clearly related, return empty strings.

Respond ONLY with JSON (no fences):
{"note":"brief context sentence or empty","source_ref":"mailto:... or https://... or empty"}`

  try {
    const raw = await callClaude(prompt, 'You are a concise task context assistant.', 200)
    return parseJSON(raw) || { note: '', source_ref: '' }
  } catch {
    return { note: '', source_ref: '' }
  }
}
