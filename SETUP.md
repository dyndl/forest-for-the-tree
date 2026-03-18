# 🌲 Forest for the Trees — Setup Guide
## From zero to running on your phone in ~45 minutes

---

## Prerequisites

- A Google account (for Calendar, Gmail, Tasks, Contacts)
- A [Vercel](https://vercel.com) account (free)
- A [Supabase](https://supabase.com) account (free)
- An [Anthropic API key](https://console.anthropic.com)
- Node.js 18+ (for local dev only)

---

## Step 1 — Fork & clone (5 min)

1. Fork this repo on GitLab (or GitHub)
2. Clone it locally:
```bash
git clone https://gitlab.com/YOUR_USERNAME/forest-for-the-trees.git
cd forest-for-the-trees
npm install
```

---

## Step 2 — Supabase database (10 min)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it `forest-for-the-trees`, set a DB password, choose a region close to you
3. Wait ~2 min for provisioning
4. Go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → **Run**
5. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

---

## Step 3 — Google Cloud OAuth (15 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **New project** → name it `Forest for the Trees`
3. **APIs & Services → Library** → enable all four:
   - Google Calendar API
   - Gmail API
   - Google Tasks API
   - Google People API (for Contacts)
4. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: `Forest for the Trees`
   - Add your email as a test user
   - Scopes: `calendar.readonly`, `gmail.readonly`, `tasks`, `contacts.readonly`
5. **APIs & Services → Credentials → Create OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://YOUR_APP.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
6. Copy **Client ID** → `GOOGLE_CLIENT_ID`
7. Copy **Client Secret** → `GOOGLE_CLIENT_SECRET`

---

## Step 4 — Deploy to Vercel (10 min)

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
2. Framework: **Next.js** (auto-detected)
3. Before deploying, add **Environment Variables**:

| Key | How to get it |
|-----|--------------|
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in terminal |
| `GOOGLE_CLIENT_ID` | From Step 3 |
| `GOOGLE_CLIENT_SECRET` | From Step 3 |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | From Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 2 |
| `CRON_SECRET` | Any random string — used to authenticate cron calls |
| `OPENAI_API_KEY` | Optional — only needed for voice memo transcription |

4. Click **Deploy**
5. Once deployed, copy your Vercel URL
6. Go back to Google Cloud → add the real Vercel URL to your OAuth redirect URIs
7. Update `NEXTAUTH_URL` in Vercel env vars with the real URL → **Redeploy**

---

## Step 5 — First sign-in + onboarding (5 min)

1. Open your Vercel URL in a browser
2. Click **Connect with Google** → grant all permissions
3. The app redirects to a 6-step onboarding:
   - **Roadmap** — your 4-week goal + best focus hours
   - **Life areas** — define the areas you want the COO to budget time for
   - **COO style** — ADHD-aware mode (optional), patterns, notes, notification prefs
   - **Oura** — optional readiness integration
   - **Relationships** — how contact tracking works
4. Complete onboarding → your COO is live

---

## Step 6 — Add to phone home screen (2 min)

**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the **Share** button → **Add to Home Screen**
3. Name it `Forest` → **Add**

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the three-dot menu → **Add to Home Screen**

The app opens full-screen like a native app.

---

## Cron jobs

The `vercel.json` file configures three automatic runs daily:

| Time | What runs |
|------|-----------|
| 7:30 AM | Morning brief — COO reads calendar + Gmail, builds schedule |
| 12:00 PM | Agent sweep — all agents run silently, urgent items surfaced |
| 4:00 PM | Agent sweep — same as noon |

These run even if you never open the app. Make sure `CRON_SECRET` in Vercel matches the value in `vercel.json`.

---

## Optional: Oura Ring

1. Go to [cloud.ouraring.com](https://cloud.ouraring.com) → Profile → Personal Access Tokens
2. Create a token → copy it
3. During onboarding (Step 5 above) paste it, or add it later via **Settings → Oura**

When connected, the COO reads your readiness and sleep scores each morning and adjusts the day's cognitive load accordingly.

---

## Optional: Voice memos + media

Add `OPENAI_API_KEY` to your Vercel environment variables to enable Whisper transcription.

- **Voice**: tap 🎙 Record in any agent card → auto-transcribed
- **Files**: tap 📎 Upload → PDFs, images, audio files
- **Camera**: tap 📷 → photo or library pick → Claude analyses it

Without an OpenAI key, file and image uploads still work — only audio transcription is disabled.

---

## Local development

```bash
cp .env.example .env.local
# Fill in all values
npm run dev
# Open http://localhost:3000
```

---

## Relationship tracking setup

For the Relationship Pulse agent to track overdue touchpoints:

1. Open [Google Contacts](https://contacts.google.com) on desktop
2. For each important person: click their name → **More fields** → **Custom fields**
3. Add: key = `relationship_tier`, value = `close`, `friend`, or `acquaintance`

Thresholds: **close** = 7 days, **friend** = 14 days, **acquaintance** = 30 days.
The COO ignores untagged contacts entirely.


---

## Personal context persistence

Your personal context (goals, life areas, outline, preferences) is stored in two places:

| Location | What it is | Survives upgrades? |
|---|---|---|
| **Supabase `user_context`** | Live source of truth for the running app | ✅ Yes — outside the repo |
| **`forest-context.md` in cloud storage** | Human-readable backup, editable by hand | ✅ Yes — outside the repo |

### Editing your context manually

**Google tier:** Open Google Drive → `Forest for the Trees` folder → `forest-context.md`. Edit it directly — the COO reads it on every morning run.

**Microsoft tier:** Open OneDrive → `Forest for the Trees` folder → `forest-context.md`. Same thing.

**Zero tier:** Copy `user-context/my-context.example.md` to `user-context/my-context.md` and fill it in. This file is gitignored and stays local.

### Pulling upstream updates (upgrading your fork)

```bash
git fetch upstream
git merge upstream/main
git push
# Vercel auto-redeploys — your Supabase data and cloud file are untouched
```

No data migration needed for most updates. If a new release adds database columns, the release notes will include the SQL to run in Supabase SQL Editor.

---
---

## Troubleshooting

**`RefreshAccessTokenError`**
→ Google Cloud: make sure the redirect URI exactly matches your Vercel URL including `https://`

**Schedule not generating**
→ Check `ANTHROPIC_API_KEY` is set in Vercel environment variables

**Cron not running**
→ Confirm `CRON_SECRET` in Vercel matches the secret in `vercel.json`

**Gmail not scanning correctly**
→ Confirm `gmail.readonly` scope was added in the OAuth consent screen and re-authenticate

**Contacts not loading**
→ Make sure Google People API is enabled and `contacts.readonly` scope is included

---

## Questions / feature ideas

Open an issue or start a discussion on the repo. Common extension points:

- Add a wearable beyond Oura (Whoop, Garmin)
- Weekly email digest via Resend
- Plaid integration for finance tracking
- Custom cron schedule (change times in `vercel.json`)
