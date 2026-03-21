// ── OURA RING API ─────────────────────────────────────────────────────────────
// Oura v2 API — OAuth2. All available data is fetched and passed raw to the
// COO agent, which decides what to surface and when.

const OURA_BASE = 'https://api.ouraring.com/v2'

async function ourFetch(endpoint, token) {
  const res = await fetch(`${OURA_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Oura API ${res.status}: ${await res.text()}`)
  return res.json()
}

function today() { return new Date().toISOString().slice(0, 10) }
function yesterday() { return new Date(Date.now() - 86400000).toISOString().slice(0, 10) }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10) }

// ── Individual fetchers (all non-fatal) ───────────────────────────────────────

async function fetchReadiness(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_readiness?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,
      date: latest.day,
      contributors: latest.contributors,         // hrv_balance, recovery_index, resting_heart_rate, body_temperature, etc.
      temperature_deviation: latest.temperature_deviation,
      temperature_trend_deviation: latest.temperature_trend_deviation,
    }
  } catch { return null }
}

async function fetchSleep(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_sleep?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,
      date: latest.day,
      contributors: latest.contributors,         // rem_sleep, deep_sleep, efficiency, latency, restfulness, timing, total_sleep
    }
  } catch { return null }
}

async function fetchSleepDetail(token) {
  // Detailed sleep periods (multiple per night: light, rem, deep stages)
  try {
    const { data } = await ourFetch(`/usercollection/sleep?start_date=${yesterday()}&end_date=${today()}`, token)
    if (!data?.length) return null
    // Return the longest sleep period (main sleep vs naps)
    const main = data.reduce((a, b) => (a.total_sleep_duration || 0) > (b.total_sleep_duration || 0) ? a : b)
    return {
      total_sleep_duration_min: Math.round((main.total_sleep_duration || 0) / 60),
      rem_sleep_duration_min: Math.round((main.rem_sleep_duration || 0) / 60),
      deep_sleep_duration_min: Math.round((main.deep_sleep_duration || 0) / 60),
      light_sleep_duration_min: Math.round((main.light_sleep_duration || 0) / 60),
      awake_duration_min: Math.round((main.awake_duration || 0) / 60),
      efficiency: main.efficiency,
      latency_min: Math.round((main.sleep_latency || 0) / 60),
      bedtime_start: main.bedtime_start,
      bedtime_end: main.bedtime_end,
      average_hrv: main.average_hrv,
      average_heart_rate: main.average_heart_rate,
      lowest_heart_rate: main.lowest_heart_rate,
      breath_average: main.breath_average,
    }
  } catch { return null }
}

async function fetchActivity(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_activity?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      score: latest.score,
      date: latest.day,
      steps: latest.steps,
      active_calories: latest.active_calories,
      total_calories: latest.total_calories,
      target_calories: latest.target_calories,
      equivalent_walking_distance: latest.equivalent_walking_distance,
      high_activity_time: latest.high_activity_time,
      medium_activity_time: latest.medium_activity_time,
      low_activity_time: latest.low_activity_time,
      sedentary_time: latest.sedentary_time,
      resting_time: latest.resting_time,
      met: latest.contributors,
    }
  } catch { return null }
}

async function fetchStress(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_stress?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      stress_high: latest.stress_high,           // minutes in high stress
      recovery_high: latest.recovery_high,       // minutes in high recovery
      day_summary: latest.day_summary,           // e.g. 'somewhat_stressful'
      date: latest.day,
    }
  } catch { return null }
}

async function fetchResilience(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_resilience?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      level: latest.level,                       // e.g. 'adequate', 'solid', 'limited'
      contributors: latest.contributors,
      date: latest.day,
    }
  } catch { return null }
}

async function fetchCardiovascularAge(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_cardiovascular_age?start_date=${daysAgo(7)}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return { vascular_age: latest.vascular_age, date: latest.day }
  } catch { return null }
}

async function fetchWorkouts(token) {
  try {
    const { data } = await ourFetch(`/usercollection/workout?start_date=${daysAgo(2)}&end_date=${today()}`, token)
    if (!data?.length) return null
    return data.map(w => ({
      activity: w.activity,
      calories: w.calories,
      distance: w.distance,
      duration_min: Math.round((w.duration || 0) / 60),
      intensity: w.intensity,
      day: w.day,
    }))
  } catch { return null }
}

async function fetchHeartRate(token) {
  // Overnight HRV proxy via heart rate readings
  try {
    const { data } = await ourFetch(`/usercollection/heartrate?start_datetime=${yesterday()}T22:00:00&end_datetime=${today()}T10:00:00`, token)
    const readings = data || []
    if (!readings.length) return null
    const avg = Math.round(readings.reduce((s, r) => s + r.bpm, 0) / readings.length)
    const min = Math.min(...readings.map(r => r.bpm))
    return { average_bpm: avg, min_bpm: min, sample_count: readings.length }
  } catch { return null }
}

async function fetchSpO2(token) {
  try {
    const { data } = await ourFetch(`/usercollection/daily_spo2?start_date=${yesterday()}&end_date=${today()}`, token)
    const latest = data?.[data.length - 1]
    if (!latest) return null
    return {
      average: latest.spo2_percentage?.average,
      date: latest.day,
    }
  } catch { return null }
}

async function fetchPersonalInfo(token) {
  try {
    return await ourFetch('/usercollection/personal_info', token)
  } catch { return null }
}

// ── Full morning context — raw data for the COO to reason over ────────────────
export async function getOuraMorningContext(token) {
  const [
    readiness, sleep, sleepDetail, activity,
    stress, resilience, cardiovascularAge,
    workouts, heartRate, spo2,
  ] = await Promise.all([
    fetchReadiness(token),
    fetchSleep(token),
    fetchSleepDetail(token),
    fetchActivity(token),
    fetchStress(token),
    fetchResilience(token),
    fetchCardiovascularAge(token),
    fetchWorkouts(token),
    fetchHeartRate(token),
    fetchSpO2(token),
  ])

  if (!readiness && !sleep) return null

  // Derive a simple energy_level for quick scheduling decisions
  const energy_level = readiness?.score >= 85 ? 'high'
    : readiness?.score >= 60 ? 'medium'
    : readiness ? 'low'
    : 'medium'

  return {
    fetched_at: new Date().toISOString(),
    energy_level,                  // COO quick-read
    readiness,
    sleep,
    sleep_detail: sleepDetail,
    activity,
    stress,
    resilience,
    cardiovascular_age: cardiovascularAge,
    workouts,
    heart_rate_overnight: heartRate,
    spo2,
    // Compact string for prompts that need brevity
    coo_summary: [
      readiness ? `Readiness ${readiness.score}/100` : null,
      sleep ? `Sleep ${sleep.score}/100` : null,
      stress?.day_summary ? `Stress: ${stress.day_summary}` : null,
      resilience?.level ? `Resilience: ${resilience.level}` : null,
      workouts?.length ? `${workouts.length} workout(s) logged` : null,
    ].filter(Boolean).join(' · '),
  }
}

// ── Token validation ──────────────────────────────────────────────────────────
export async function validateOuraToken(token) {
  try {
    const data = await fetchPersonalInfo(token)
    if (!data) return { valid: false }
    return { valid: true, email: data.email, age: data.age }
  } catch {
    return { valid: false }
  }
}
