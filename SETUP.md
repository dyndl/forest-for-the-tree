# Forest for the Trees — Setup Guide
## Total time: ~45 minutes

---

## Step 1: Get the code onto your machine (5 min)

Option A — GitHub (recommended):
1. Go to github.com → New repository → name it "forest-for-the-trees" → Create
2. On your computer, open Terminal and run:
```
cd ~/Downloads
git clone <your-repo-url>
cp -r forest-for-the-trees/* <your-repo-path>/
cd <your-repo-path>
npm install
git add . && git commit -m "init" && git push
```

Option B — just unzip and run locally first:
```
cd ~/Downloads/forest-for-the-trees
npm install
```

---

## Step 2: Supabase database (10 min)

1. Go to supabase.com → New project (free tier)
2. Name it "forest-for-the-trees", set a password, choose a region
3. Wait ~2 min for it to provision
4. Go to SQL Editor → New query
5. Paste the entire contents of `supabase-schema.sql` → Run
6. Go to Settings → API → copy:
   - Project URL  → NEXT_PUBLIC_SUPABASE_URL
   - anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role key → SUPABASE_SERVICE_ROLE_KEY

---

## Step 3: Google OAuth (15 min)

1. Go to console.cloud.google.com
2. Create new project: "Forest for the Trees"
3. APIs & Services → Enable APIs → enable all three:
   - Google Calendar API
   - Gmail API
   - Google Tasks API
4. APIs & Services → OAuth consent screen:
   - User type: External
   - App name: Forest for the Trees
   - Add your email as test user
   - Scopes: add calendar.readonly, gmail.readonly, tasks
5. APIs & Services → Credentials → Create OAuth client ID:
   - Type: Web application
   - Authorized redirect URIs: 
     - https://YOUR_APP.vercel.app/api/auth/callback/google
     - http://localhost:3000/api/auth/callback/google (for local testing)
6. Copy Client ID → GOOGLE_CLIENT_ID
7. Copy Client Secret → GOOGLE_CLIENT_SECRET

---

## Step 4: Deploy to Vercel (5 min)

1. Go to vercel.com → New Project → Import your GitHub repo
2. Add Environment Variables (Settings → Environment Variables):

```
NEXTAUTH_URL          = https://YOUR_APP.vercel.app
NEXTAUTH_SECRET       = (run: openssl rand -base64 32 in terminal)
GOOGLE_CLIENT_ID      = from Step 3
GOOGLE_CLIENT_SECRET  = from Step 3
ANTHROPIC_API_KEY     = your key from console.anthropic.com
NEXT_PUBLIC_SUPABASE_URL      = from Step 2
NEXT_PUBLIC_SUPABASE_ANON_KEY = from Step 2
SUPABASE_SERVICE_ROLE_KEY     = from Step 2
CRON_SECRET           = (make up any random string)
```

3. Deploy → copy your Vercel URL
4. Go back to Google Console → update the redirect URI with your real Vercel URL
5. Update NEXTAUTH_URL in Vercel env vars with your real URL
6. Redeploy

---

## Step 5: Install on iPhone as PWA (2 min)

1. Open Safari on your iPhone
2. Go to your Vercel URL
3. Sign in with Google
4. Tap the Share button (box with arrow)
5. Tap "Add to Home Screen"
6. Name it "Forest" → Add
7. It appears on your home screen and opens full-screen like a native app

---

## What happens automatically:

- **7:30am daily**: COO reads your Calendar and Gmail, builds your schedule
- **12:00pm**: Midday check-in prompt appears
- **4:00pm**: Afternoon check-in prompt appears  
- **All agents**: Run silently in background at noon and 4pm, surface alerts if urgent

## What you do:
1. Open app in morning → see your schedule → Accept or Veto blocks
2. Do the tasks → tap to complete on the matrix bubbles
3. Answer check-ins in 1-2 sentences
4. Add urgent tasks via quick-add anytime

---

## Local development (optional):

```bash
cp .env.example .env.local
# fill in your values
npm run dev
# open http://localhost:3000
```

---

## Questions / next features to add:
- Oura/Whoop readiness score → auto-sets energy level
- Plaid bank connection → real Finance Tracker data  
- Weekly email digest via Resend
- Supabase Realtime → schedule updates push to phone instantly


---

## Relationships setup (Google Contacts)

The Relationship Pulse agent reads your Google Contacts to:
- Track birthdays (14-day warning)
- Flag overdue touchpoints by tier
- Generate weekly relationship reviews every Sunday at 9am

### Enable in Google Cloud Console
Add one more scope when setting up OAuth:
- `https://www.googleapis.com/auth/contacts.readonly`
- `https://www.googleapis.com/auth/contacts.other.readonly`

### Set relationship tiers in Google Contacts
For the overdue tracking to work, tag your important contacts:
1. Open Google Contacts on desktop
2. Click a contact → "More fields" → "Custom fields"
3. Add field: key = `relationship_tier`, value = `close`, `friend`, or `acquaintance`
4. Thresholds: close = 7 days, friend = 14 days, acquaintance = 30 days

You only need to tag maybe 20-30 key people. The COO ignores untagged contacts.

### Run the new schema additions
In Supabase SQL Editor, run the bottom section of supabase-schema.sql
(the part starting with "-- RELATIONSHIP CACHE")


---

## Voice, files, camera setup

The app supports voice recording, file uploads, camera capture, and image analysis.

### Add to Vercel environment variables:
```
OPENAI_API_KEY = your_openai_api_key
```
Get it from platform.openai.com — Whisper transcription costs ~$0.006/minute. A 5-minute voice memo costs 3 cents.

### How to upload your voice memo backlog (iPhone):
1. Open Voice Memos app
2. Tap a memo → tap the three dots (…) → Save to Files
3. Save to iCloud Drive or Files
4. Open Forest for the Trees → Agents tab → Music Mentor
5. Tap 📎 Upload file → pick the .m4a file
6. The COO transcribes it with Whisper, extracts lyric fragments, melodic ideas, and production notes
7. Tap "Run" on the Music Mentor agent — it now has your uploaded context

### Live recording:
Tap 🎙 Record in any agent card → speaks directly into your phone mic → stops and transcribes automatically.

### Camera:
Tap 📷 Camera → takes a photo or picks from library → Claude analyzes the image and adds it to the agent's context. Useful for: chord charts on paper, lyrics written in a notebook, whiteboard ideas.

### Backlog:
Tap 🗂 Backlog in any agent card to see all past uploads for that agent. Expand any card to see extracted ideas, lyric fragments, and next actions.

### Run without OpenAI (fallback):
If you don't want to add an OpenAI key, the upload still works — it just won't transcribe audio. Images and PDFs are handled by Claude directly with no OpenAI dependency.


---

## Oura Ring setup

1. Go to cloud.ouraring.com → Profile → Personal Access Tokens
2. Create a new token, copy it
3. During onboarding (step 4) paste the token — the app validates it immediately
4. Or go to Settings → Oura Ring → paste token anytime after setup

The COO uses your readiness score every morning to:
- Auto-set your energy level (low/medium/high)
- Adjust cognitive load in the schedule — fewer deep work blocks on low readiness days
- Reference sleep quality in the morning brief message

## What's new in this version

- Onboarding flow (5 steps, runs once on first login)
- Settings page (roadmap, peak hours, ADHD patterns, notification prefs, Oura)
- Oura Ring integration (readiness, sleep, activity)
- Supabase Realtime (live task + schedule updates across devices)
- Error states + retry buttons (no more silent failures)
- COO memory write-back (retros update your ADHD pattern history)
- Oura-aware schedule generation (Vercel cron + on-demand)
- Sunday weekly review on home screen
- Offline banner + optimistic task updates
- Settings accessible via sidebar ⚙ icon

## Add to Supabase schema
Run the additional tables from supabase-schema.sql in your Supabase SQL editor
(the relationship_cache, relationship_briefs, connectors, user_context tables)
Also add this column to the schedules table:
  alter table schedules add column if not exists oura_data jsonb;

