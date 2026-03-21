import { google } from 'googleapis'

export function getOAuthClient(accessToken, refreshToken) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return client
}

// ── CALENDAR ────────────────────────────────────────────────────────────────
export async function getTodayEvents(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    })
    return (res.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || 'Untitled',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || '',
      description: e.description || '',
    }))
  } catch (err) {
    console.error('Calendar error:', err.message)
    return []
  }
}

// ── GMAIL ────────────────────────────────────────────────────────────────────
export async function getImportantEmails(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })

  // Scan for job/interview/urgent emails from last 48h
  const queries = [
    'label:jobs OR label:interviews newer_than:2d',
    'subject:(interview OR offer OR application OR urgent) newer_than:2d is:unread',
    'from:(linkedin OR greenhouse OR lever OR ashby OR workday) newer_than:2d',
  ]

  const results = []
  for (const q of queries) {
    try {
      const list = await gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults: 5,
      })
      const messages = list.data.messages || []
      for (const msg of messages.slice(0, 3)) {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        })
        const headers = full.data.payload?.headers || []
        const get = (name) => headers.find(h => h.name === name)?.value || ''
        results.push({
          id: msg.id,
          subject: get('Subject'),
          from: get('From'),
          date: get('Date'),
          snippet: full.data.snippet || '',
        })
      }
    } catch (err) {
      // Query may return no results - that's fine
    }
  }

  // Deduplicate by id
  const seen = new Set()
  return results.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
}

// ── GOOGLE TASKS ─────────────────────────────────────────────────────────────
export async function getGoogleTasks(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const tasksApi = google.tasks({ version: 'v1', auth })

  try {
    // Get or create the FFTREES task list
    const lists = await tasksApi.tasklists.list()
    let listId = null
    for (const l of lists.data.items || []) {
      if (l.title === 'Forest for the Trees') { listId = l.id; break }
    }
    if (!listId) {
      const created = await tasksApi.tasklists.insert({ requestBody: { title: 'Forest for the Trees' } })
      listId = created.data.id
    }

    const tasks = await tasksApi.tasks.list({
      tasklist: listId,
      showCompleted: false,
      maxResults: 50,
    })
    return { listId, tasks: tasks.data.items || [] }
  } catch (err) {
    console.error('Tasks error:', err.message)
    return { listId: null, tasks: [] }
  }
}

export async function createGoogleTask(accessToken, refreshToken, listId, task) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const tasksApi = google.tasks({ version: 'v1', auth })
  try {
    await tasksApi.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: task.name,
        notes: `[${task.q.toUpperCase()}] ${task.cat} | ${task.blocks}×15min${task.notes ? ' | ' + task.notes : ''}`,
        due: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('Create task error:', err.message)
  }
}

export async function completeGoogleTask(accessToken, refreshToken, listId, googleTaskId) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const tasksApi = google.tasks({ version: 'v1', auth })
  try {
    await tasksApi.tasks.patch({
      tasklist: listId,
      task: googleTaskId,
      requestBody: { status: 'completed' },
    })
  } catch (err) {
    console.error('Complete task error:', err.message)
  }
}

// ── CALENDAR WRITE — COO notifications via Google Calendar ───────────────────

export async function clearCOOEvents(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const yesterday = new Date(now - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: yesterday.toISOString(),
      timeMax: tomorrow.toISOString(),
      q: '🌲',
      singleEvents: true,
      maxResults: 50,
    })
    const events = res.data.items || []
    await Promise.all(
      events.map(e => calendar.events.delete({ calendarId: 'primary', eventId: e.id }).catch(() => {}))
    )
    return events.length
  } catch (err) {
    console.error('clearCOOEvents error:', err.message)
    return 0
  }
}

function makeEvent(title, startISO, durationMin, description, alertMin = 5) {
  const start = new Date(startISO)
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  return {
    summary: `🌲 ${title}`,
    description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: alertMin }],
    },
    colorId: '2', // sage green
  }
}

function parseTime(timeStr, baseDate) {
  // Parse "8:00 AM" style strings
  const [time, period] = timeStr.split(' ')
  let [hours, minutes] = time.split(':').map(Number)
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  const d = new Date(baseDate)
  d.setHours(hours, minutes || 0, 0, 0)
  return d.toISOString()
}

/** Parse "HH:MM" pref string → { h, m }, falling back to defaults */
function prefTime(prefs, key, defaultH, defaultM = 0) {
  const t = prefs?.[key]
  if (!t) return { h: defaultH, m: defaultM }
  const [h, m] = t.split(':').map(Number)
  return { h: isNaN(h) ? defaultH : h, m: isNaN(m) ? defaultM : m }
}

export async function writeCOOScheduleToCalendar(accessToken, refreshToken, schedule, notifPrefs = {}) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const today = new Date()
  const created = []

  const eventsToCreate = []

  // Morning brief notification
  if (notifPrefs.morning_brief !== false) {
    const { h, m } = prefTime(notifPrefs, 'morning_brief_time', 7, 30)
    const briefTime = new Date(today); briefTime.setHours(h, m, 0, 0)
    eventsToCreate.push(makeEvent(
      'Morning brief ready',
      briefTime.toISOString(),
      15,
      `Your COO has planned today.\n\nTop 3:\n${(schedule.top_3_mits || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nOpen Forest for the Trees to review and accept your schedule.`,
      1
    ))
  }

  // Each scheduled task block
  for (const slot of (schedule.slots || [])) {
    if (slot.type !== 'task' || !slot.taskId) continue
    if (slot.state === 'vetoed') continue

    try {
      const startISO = parseTime(slot.time, today)
      const durationMin = (slot.blocks || 1) * 15
      const desc = [
        slot.note || '',
        slot.quadrant ? `[${slot.quadrant.toUpperCase()}]` : '',
        'Open Forest for the Trees to mark complete.',
      ].filter(Boolean).join('\n')

      eventsToCreate.push(makeEvent(slot.label, startISO, durationMin, desc, 5))
    } catch {}
  }

  // Midday check-in
  if (notifPrefs.midday_checkin !== false) {
    const { h, m } = prefTime(notifPrefs, 'midday_checkin_time', 12, 0)
    const midday = new Date(today); midday.setHours(h, m, 0, 0)
    eventsToCreate.push(makeEvent('Midday check-in', midday.toISOString(), 10, 'How is it going? Any blockers?\n\nOpen Forest for the Trees for your check-in.', 1))
  }

  // Afternoon pulse
  if (notifPrefs.afternoon_checkin !== false) {
    const { h, m } = prefTime(notifPrefs, 'afternoon_checkin_time', 16, 0)
    const afternoon = new Date(today); afternoon.setHours(h, m, 0, 0)
    eventsToCreate.push(makeEvent('Afternoon pulse', afternoon.toISOString(), 10, 'What got done? What is left?\n\nOpen Forest for the Trees.', 1))
  }

  // Evening retro
  if (notifPrefs.evening_retro !== false) {
    const { h, m } = prefTime(notifPrefs, 'evening_retro_time', 19, 0)
    const evening = new Date(today); evening.setHours(h, m, 0, 0)
    eventsToCreate.push(makeEvent('Evening retro', evening.toISOString(), 15, 'Day is wrapping up. One win, one miss, one thing for tomorrow.\n\nOpen Forest for the Trees.', 5))
  }

  // Create all events
  for (const event of eventsToCreate) {
    try {
      const res = await calendar.events.insert({ calendarId: 'primary', requestBody: event })
      created.push(res.data.id)
    } catch (err) {
      console.error('createCOOEvent error:', err.message)
    }
  }

  return created.length
}

export async function writeUrgentAlert(accessToken, refreshToken, agentName, alertText) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date(Date.now() + 2 * 60 * 1000) // 2 min from now

  try {
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: makeEvent(
        `Urgent — ${agentName}`,
        now.toISOString(),
        10,
        `${alertText}\n\nOpen Forest for the Trees → Agents tab.`,
        0
      ),
    })
  } catch (err) {
    console.error('writeUrgentAlert error:', err.message)
  }
}

// ── GOOGLE CONTACTS / PEOPLE API ─────────────────────────────────────────────

export async function getRelationshipContacts(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const people = google.people({ version: 'v1', auth })

  try {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 200,
      personFields: 'names,emailAddresses,phoneNumbers,birthdays,userDefined,metadata',
    })

    const contacts = (res.data.connections || []).map(p => {
      const name = p.names?.[0]?.displayName || 'Unknown'
      const birthday = p.birthdays?.[0]
      const tier = p.userDefined?.find(f => f.key === 'relationship_tier')?.value || null
      const lastContact = p.userDefined?.find(f => f.key === 'last_contact')?.value || null
      const notes = p.userDefined?.find(f => f.key === 'notes')?.value || null

      let birthdayStr = null
      if (birthday?.date) {
        const { month, day } = birthday.date
        birthdayStr = `${month}/${day}`
      }

      return { name, birthday: birthdayStr, tier, lastContact, notes, resourceName: p.resourceName }
    }).filter(c => c.name !== 'Unknown')

    return contacts
  } catch (err) {
    console.error('getRelationshipContacts error:', err.message)
    return []
  }
}

// ── COO BOOT SCAN ─────────────────────────────────────────────────────────────

/**
 * Inbox stats: accurate unread + total via Labels API, subscription estimate via search.
 * labels.get('INBOX') returns exact messagesUnread / messagesTotal from Gmail's index —
 * unlike messages.list resultSizeEstimate which is wildly inaccurate at low maxResults.
 */
export async function scanGmailInbox(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })
  try {
    // Run in parallel: accurate label counts + subscription search estimate
    const [inboxLabel, subRes] = await Promise.all([
      gmail.users.labels.get({ userId: 'me', id: 'INBOX' }),
      // Larger maxResults gives resultSizeEstimate a bigger sample to work with
      gmail.users.messages.list({ userId: 'me', q: 'has:unsubscribe', maxResults: 500 }),
    ])
    return {
      unread:        inboxLabel.data.messagesUnread    || 0,
      total:         inboxLabel.data.messagesTotal     || 0,
      subscriptions: subRes.data.resultSizeEstimate    || 0,
    }
  } catch (err) {
    console.error('scanGmailInbox error:', err.message)
    return { unread: 0, subscriptions: 0, total: 0 }
  }
}

/** Count events in the next 14 days — paginated so we don't cap at 100. */
export async function scanCalendarUpcoming(accessToken, refreshToken) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const now      = new Date()
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  try {
    let count = 0, pageToken = undefined
    do {
      const res = await calendar.events.list({
        calendarId:  'primary',
        timeMin:     now.toISOString(),
        timeMax:     twoWeeks.toISOString(),
        singleEvents: true,
        maxResults:  250,
        pageToken,
      })
      count    += (res.data.items || []).length
      pageToken = res.data.nextPageToken
    } while (pageToken)
    return count
  } catch (err) {
    console.error('scanCalendarUpcoming error:', err.message)
    return 0
  }
}

/** Total contact count */
export async function scanContactsCount(accessToken, refreshToken) {
  const auth   = getOAuthClient(accessToken, refreshToken)
  const people = google.people({ version: 'v1', auth })
  try {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1,
      personFields: 'names',
    })
    return res.data.totalPeople || 0
  } catch (err) {
    console.error('scanContactsCount error:', err.message)
    return 0
  }
}

export async function updateContactLastContact(accessToken, refreshToken, resourceName) {
  const auth = getOAuthClient(accessToken, refreshToken)
  const people = google.people({ version: 'v1', auth })
  const today = new Date().toISOString().slice(0, 10)

  try {
    // Get current userDefined fields first
    const current = await people.people.get({
      resourceName,
      personFields: 'userDefined,metadata',
    })

    const existing = current.data.userDefined || []
    const updated = existing.filter(f => f.key !== 'last_contact')
    updated.push({ key: 'last_contact', value: today })

    await people.people.updateContact({
      resourceName,
      updatePersonFields: 'userDefined',
      requestBody: {
        etag: current.data.etag,
        userDefined: updated,
      },
    })
    return true
  } catch (err) {
    console.error('updateContactLastContact error:', err.message)
    return false
  }
}

export function getUpcomingBirthdays(contacts, daysAhead = 14) {
  const today = new Date()
  const upcoming = []

  for (const contact of contacts) {
    if (!contact.birthday) continue
    const [month, day] = contact.birthday.split('/').map(Number)
    const thisYear = new Date(today.getFullYear(), month - 1, day)
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
    const daysUntil = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
    if (daysUntil <= daysAhead) {
      upcoming.push({ ...contact, daysUntil, birthdayDate: thisYear.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) })
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
}

export function getOverdueContacts(contacts, tierThresholds = { close: 7, friend: 14, acquaintance: 30 }) {
  const today = new Date()
  const overdue = []

  for (const contact of contacts) {
    if (!contact.tier || !contact.lastContact) continue
    const threshold = tierThresholds[contact.tier] || 30
    const last = new Date(contact.lastContact)
    const daysSince = Math.round((today - last) / (1000 * 60 * 60 * 24))
    if (daysSince >= threshold) {
      overdue.push({ ...contact, daysSince })
    }
  }

  return overdue.sort((a, b) => b.daysSince - a.daysSince)
}

// ── WEBHOOK / WATCH ────────────────────────────────────────────────────────────

/**
 * Register a Gmail Pub/Sub push watch.
 * Requires GMAIL_PUBSUB_TOPIC env var (e.g. "projects/my-project/topics/gmail-push").
 * Returns { historyId, expiration } — expiration is a Unix ms timestamp string.
 */
export async function registerGmailWatch(accessToken, refreshToken) {
  const auth  = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC,
      labelIds: ['INBOX'],
    },
  })
  return res.data // { historyId, expiration }
}

/** Stop an active Gmail push watch for this user. */
export async function stopGmailWatch(accessToken, refreshToken) {
  const auth  = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.stop({ userId: 'me' }).catch(() => {})
}

/**
 * Fetch Gmail history since startHistoryId.
 * Returns an array of message IDs that were added to INBOX.
 */
export async function getGmailHistory(accessToken, refreshToken, startHistoryId) {
  const auth  = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })
  try {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })
    const added = []
    for (const h of res.data.history || []) {
      for (const m of h.messagesAdded || []) added.push(m.message.id)
    }
    return added
  } catch (err) {
    if (err.code === 404) return [] // historyId expired; caller should re-register
    throw err
  }
}

/** Fetch Subject + From headers and label IDs for a single message. */
export async function getMessageMetadata(accessToken, refreshToken, messageId) {
  const auth  = getOAuthClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From'],
  })
  const headers = res.data.payload?.headers || []
  return {
    subject:  headers.find(h => h.name === 'Subject')?.value || '',
    from:     headers.find(h => h.name === 'From')?.value    || '',
    labelIds: res.data.labelIds || [],
  }
}

/**
 * Register a Google Calendar events.watch channel.
 * channelId must be a UUID unique per user.
 * Returns { id, resourceId, expiration } — expiration is a Unix ms timestamp string.
 */
export async function registerCalendarWatch(accessToken, refreshToken, channelId) {
  const auth     = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const base     = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const res = await calendar.events.watch({
    calendarId: 'primary',
    requestBody: {
      id:         channelId,
      type:       'web_hook',
      address:    `${base}/api/webhooks/calendar`,
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return res.data // { kind, id, resourceId, resourceUri, expiration }
}

/** Stop a Google Calendar watch channel. */
export async function stopCalendarWatch(accessToken, refreshToken, channelId, resourceId) {
  const auth     = getOAuthClient(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  }).catch(() => {})
}
