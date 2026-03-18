# 🌲 Forest for the Trees — Setup Guide
## From zero to running on your iPhone in ~45 minutes

---

## What you're deploying
A Next.js app that runs on Vercel (free), connected to:
- **Google Calendar** — COO reads your events before building each schedule
- **Gmail** — scans for job/interview emails and auto-surfaces them as tasks
- **Google Tasks** — accepted schedule blocks sync back as real Google Tasks
- **Supabase** — your tasks, schedules, agent outputs stored in a real DB
- **Anthropic API** — Claude Sonnet powers all 6 agents + the COO

---

## Step 1 — GitHub (5 min)

1. Go to **github.com** → New repository → name it `forest-for-the-trees`
2. Make it **private**
3. On your computer, open Terminal in the project folder and run:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/forest-for-the-trees.git
git push -u origin main
```

---

## Step 2 — Supabase (5 min)

1. Go to **supabase.com** → New project → name it `forest-for-the-trees`
2. Pick a region close to you, set a DB password (save it)
3. Once created, go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → Run
4. Go to **Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## Step 3 — Google Cloud (15 min)

1. Go to **console.cloud.google.com**
2. Create a new project → name it `Forest for the Trees`
3. Go to **APIs & Services → Library** → Enable these 3 APIs:
   - Google Calendar API
   - Gmail API
   - Google Tasks API
4. Go to **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: `Forest for the Trees`
   - Add your email as test user
   - Scopes: add `calendar.readonly`, `gmail.readonly`, `tasks`
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Forest for the Trees`
   - Authorized redirect URIs: `https://YOUR_VERCEL_APP.vercel.app/api/auth/callback/google`
     *(You'll get the Vercel URL in Step 4 — come back and add it)*
6. Copy your **Client ID** and **Client Secret**

---

## Step 4 — Vercel (10 min)

1. Go to **vercel.com** → New Project → Import your GitHub repo
2. Framework: **Next.js** (auto-detected)
3. Before deploying, go to **Environment Variables** and add all of these:

| Key | Value |
|-----|-------|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (your Vercel URL) |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in Terminal, paste result |
| `GOOGLE_CLIENT_ID` | From Step 3 |
| `GOOGLE_CLIENT_SECRET` | From Step 3 |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `NEXT_PUBLIC_SUPABASE_URL` | From Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 2 |
| `CRON_SECRET` | Any random string, e.g. `forest-secret-2024` |

4. Click **Deploy**
5. Once deployed, copy your Vercel URL (e.g. `forest-for-the-trees.vercel.app`)
6. Go back to Google Cloud → add that URL to your OAuth redirect URIs

---

## Step 5 — Add to iPhone Home Screen (2 min)

1. Open Safari on your iPhone
2. Go to `https://your-app.vercel.app`
3. Tap the **Share** button (box with arrow)
4. Tap **Add to Home Screen**
5. Name it **Forest** → Add
6. It opens full-screen like a native app

---

## Step 6 — First Sign In

1. Open the app on your phone
2. Tap **Connect with Google**
3. Sign in and grant all permissions (Calendar, Gmail, Tasks)
4. You're in — the COO will auto-generate your first schedule

---

## How it works day-to-day

| Time | What happens automatically |
|------|---------------------------|
| 7:30 AM | COO reads your calendar + Gmail, builds today's schedule |
| When you open app | Morning brief is waiting — accept or veto blocks |
| Noon | Silent agent sweep — flags anything urgent |
| 4:00 PM | Second agent sweep |
| Any time | Tap **Check in** → talk to COO → it adjusts your schedule |
| Evening | Tap Check in → Evening retro → tomorrow's top 3 |

---

## Cron jobs (automatic)

The `vercel.json` file sets up 3 automatic runs:
- `7:30 AM` daily → morning brief
- `12:00 PM` daily → agent sweep
- `4:00 PM` daily → agent sweep

These run even if you never open the app.

---

## Costs (per month)

| Service | Cost |
|---------|------|
| Vercel | Free (Hobby plan) |
| Supabase | Free (500MB) |
| Anthropic API | ~$5-15 depending on usage |
| Google APIs | Free (within generous quotas) |

---

## Adding more agents later

Open the app → Agents tab → + button
Give it a name, emoji, area, and system prompt. It joins the autonomous sweep immediately.

---

## Troubleshooting

**"Error: RefreshAccessTokenError"** → Go to Google Cloud, make sure the redirect URI exactly matches your Vercel URL including `https://`

**Schedule not generating** → Check your `ANTHROPIC_API_KEY` is set in Vercel environment variables

**Gmail not finding emails** → Add a Gmail label called `jobs` or `interviews` to relevant threads

**Cron not running** → Make sure `CRON_SECRET` in Vercel matches the one in `vercel.json`

---

## File structure

```
forest-for-the-trees/
├── app/
│   ├── page.js              ← Main React app (all UI)
│   ├── layout.js            ← PWA meta tags
│   ├── globals.css          ← Forest theme styles
│   ├── providers.js         ← NextAuth session
│   └── api/
│       ├── auth/[...nextauth]/route.js  ← Google OAuth
│       ├── tasks/route.js               ← Task CRUD + Google Tasks sync
│       ├── schedule/route.js            ← COO schedule gen + veto
│       ├── agents/route.js              ← Agent runs + tuning
│       ├── coo/route.js                 ← Check-ins + retros
│       └── cron/route.js               ← Morning brief + sweeps
├── lib/
│   ├── coo.js               ← All Claude API calls
│   ├── google.js            ← Calendar, Gmail, Tasks helpers
│   └── supabase.js          ← DB client
├── public/
│   └── manifest.json        ← PWA manifest
├── supabase-schema.sql      ← Run this in Supabase
├── vercel.json              ← Cron schedule
├── next.config.js
├── .env.example             ← Copy to .env.local for local dev
└── README.md
```
