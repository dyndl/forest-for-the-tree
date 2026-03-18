// ── OURA RING API ─────────────────────────────────────────────────────────────
// Oura v2 API — requires personal access token from cloud.ouraring.com/personal-access-tokens

const OURA_BASE = 'https://api.ouraring.com/v2'

async function ourFetch(endpoint, token) {
  const res = await fetch(`${OURA_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Oura API ${res.status}: ${await res.text()}`)
  return res.json()
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10)
}

// Daily readiness — the single most important number for ADHD scheduling
export async function getReadiness(token) {
  try {
    const data = await ourFetch(`/usercollection/daily_readiness?start_date=${yesterdayStr()}&end_date=${todayStr()}`, token)
    const latest = data.data?.[data.data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,                        // 0-100
      temperature_deviation: latest.temperature_deviation,
      hrv_balance_score: latest.contributors?.hrv_balance,
      recovery_index: latest.contributors?.recovery_index,
      resting_hr: latest.contributors?.resting_heart_rate,
      date: latest.day,
      // Map to energy level for COO
      energy_level: latest.score >= 85 ? 'high' : latest.score >= 60 ? 'medium' : 'low',
      energy_note: latest.score >= 85
        ? 'Oura readiness is high — schedule demanding cognitive work in peak windows'
        : latest.score >= 60
        ? 'Oura readiness is moderate — mix of deep work and lighter tasks recommended'
        : 'Oura readiness is low — protect energy, reduce cognitive load, prioritise recovery tasks',
    }
  } catch (err) {
    console.error('Oura readiness error:', err.message)
    return null
  }
}

// Sleep data
export async function getSleep(token) {
  try {
    const data = await ourFetch(`/usercollection/daily_sleep?start_date=${yesterdayStr()}&end_date=${todayStr()}`, token)
    const latest = data.data?.[data.data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,
      total_sleep_minutes: Math.round((latest.contributors?.total_sleep || 0)),
      efficiency: latest.contributors?.efficiency,
      rem_sleep: latest.contributors?.rem_sleep,
      deep_sleep: latest.contributors?.deep_sleep,
      latency: latest.contributors?.latency,
      date: latest.day,
      summary: latest.score >= 85
        ? `Good sleep (${latest.score}/100) — cognitive performance should be strong`
        : latest.score >= 60
        ? `Average sleep (${latest.score}/100) — consider a 20-min nap if possible`
        : `Poor sleep (${latest.score}/100) — COO will reduce cognitive load today`,
    }
  } catch (err) {
    console.error('Oura sleep error:', err.message)
    return null
  }
}

// Activity — steps, calories, activity score
export async function getActivity(token) {
  try {
    const data = await ourFetch(`/usercollection/daily_activity?start_date=${yesterdayStr()}&end_date=${todayStr()}`, token)
    const latest = data.data?.[data.data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,
      steps: latest.steps,
      active_calories: latest.active_calories,
      target_calories: latest.target_calories,
      met_daily_targets: latest.met_daily_targets,
      date: latest.day,
      steps_goal_met: latest.steps >= 8000,
    }
  } catch (err) {
    console.error('Oura activity error:', err.message)
    return null
  }
}

// Heart rate variability — last night
export async function getHRV(token) {
  try {
    const data = await ourFetch(`/usercollection/heartrate?start_datetime=${yesterdayStr()}T22:00:00&end_datetime=${todayStr()}T10:00:00`, token)
    const readings = data.data || []
    if (readings.length === 0) return null
    const avg = Math.round(readings.reduce((s, r) => s + r.bpm, 0) / readings.length)
    return { average_hrv: avg, readings_count: readings.length }
  } catch {
    return null
  }
}

// Full morning context — everything the COO needs
export async function getOuraMorningContext(token) {
  const [readiness, sleep, activity] = await Promise.all([
    getReadiness(token),
    getSleep(token),
    getActivity(token),
  ])

  if (!readiness && !sleep) return null

  return {
    readiness,
    sleep,
    activity,
    energy_level: readiness?.energy_level || 'medium',
    coo_context: [
      readiness ? `Readiness: ${readiness.score}/100 (${readiness.energy_level})` : null,
      sleep ? `Sleep: ${sleep.score}/100` : null,
      readiness?.energy_note || null,
      sleep?.summary || null,
    ].filter(Boolean).join('. '),
  }
}

// Validate token works
export async function validateOuraToken(token) {
  try {
    const data = await ourFetch('/usercollection/personal_info', token)
    return { valid: true, email: data.email, age: data.age }
  } catch {
    return { valid: false }
  }
}
