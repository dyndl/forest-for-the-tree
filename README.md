# 🌲 Forest for the Trees

**An autonomous life COO — powered by Claude, deployed as a PWA on Vercel.**

Each morning it reads your Google Calendar and Gmail, builds a time-blocked schedule in 15-min increments, and checks in with you throughout the day. You focus on the work; it handles the managing.

---

## What it does

| Feature | Description |
|---|---|
| **Morning brief** | COO reads your calendar + Gmail and builds a full day schedule by 7:30am |
| **Task matrix** | Eisenhower-style bubble view — tasks sorted by urgency × importance |
| **Schedule** | Accept or veto each 15-min block before your day starts |
| **Check-ins** | Midday, afternoon, and evening — COO adjusts the plan in real time |
| **Agents** | Autonomous background agents (you define them) sweep twice daily |
| **Relationships** | Tracks Google Contacts — birthday warnings, overdue touchpoints, weekly review |
| **Oura integration** | Optional — readiness score shapes cognitive load of each day |
| **Voice + media** | Upload voice memos, images, PDFs to any agent card for context |
| **PWA** | Add to iPhone home screen, opens full-screen like a native app |

---

## Stack

- **Next.js 14** (App Router) — deployed on Vercel
- **Supabase** — Postgres database + Realtime
- **NextAuth** — Google OAuth (Calendar, Gmail, Tasks, Contacts)
- **Anthropic Claude** — all COO logic and agent runs
- **OpenAI Whisper** — audio transcription (optional)
- **Oura API** — readiness/sleep data (optional)

---

## Setup

See **[SETUP.md](./SETUP.md)** for the full walkthrough (~45 min end-to-end).

The short version:
1. Fork this repo
2. Create a Supabase project → run `supabase-schema.sql`
3. Create a Google Cloud project → enable Calendar, Gmail, Tasks, Contacts APIs → create OAuth credentials
4. Deploy to Vercel → add environment variables
5. Open the app → sign in with Google → complete the 6-step onboarding

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ANTHROPIC_API_KEY
OPENAI_API_KEY          # optional — Whisper transcription
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

---

## Onboarding

On first login the app runs a 6-step onboarding flow that collects everything the COO needs:

1. **Welcome** — overview of what the COO does
2. **Roadmap** — your 4-week north-star goal + best focus hours
3. **Life areas** — pick from suggestions (Deep Work, Health, Learning…) or define your own, with a weekly block budget per area
4. **COO style** — optional ADHD-aware mode, known patterns, free-text notes, notification preferences
5. **Oura** — optional readiness integration
6. **Relationships** — how Google Contacts tracking works

All settings are editable any time via the ⚙ Settings page.

---

## ADHD-aware mode

When enabled during onboarding (or toggled in Settings), the COO:
- Breaks all tasks into ≤30 min chunks
- Protects context switches — no back-to-back topic changes
- Names patterns it observes (avoidance, hyperfocus, etc.) without judgment
- Caps deep work blocks at 45 min on low-readiness days

This is off by default and fully optional.

---

## Agents

The Agents tab lets you create autonomous background agents. Each agent has:
- A name, emoji, and area of life it covers
- A system prompt describing what it watches for
- A backlog of uploaded context (voice memos, files, images)

Agents run silently at noon and 4pm every day. If one finds something urgent, it surfaces an alert on the home screen.

---

## Costs

| Service | Cost |
|---|---|
| Vercel | Free (Hobby) |
| Supabase | Free (500 MB) |
| Anthropic API | ~$5–15/month depending on usage |
| OpenAI Whisper | ~$0.006/min of audio (optional) |
| Google APIs | Free within quota |
| Oura API | Free with Oura membership |

---

## File structure

```
├── app/
│   ├── page.js                        ← Main UI (matrix, schedule, agents, check-ins)
│   ├── layout.js                      ← PWA meta + fonts
│   ├── globals.css                    ← Forest theme
│   ├── providers.js                   ← NextAuth session provider
│   ├── onboarding/page.js             ← First-run setup flow
│   ├── settings/page.js               ← Edit preferences post-onboarding
│   └── api/
│       ├── auth/[...nextauth]/        ← Google OAuth
│       ├── tasks/                     ← Task CRUD + Google Tasks sync
│       ├── schedule/                  ← COO schedule generation + veto
│       ├── agents/                    ← Agent runs + tuning
│       ├── coo/                       ← Check-ins + retros
│       ├── cron/                      ← Morning brief + agent sweeps
│       ├── oura/                      ← Oura token validation + data fetch
│       ├── relationships/             ← Contacts sync + birthday logic
│       ├── media/                     ← File/image/audio upload
│       ├── voice/                     ← Whisper transcription
│       └── settings/                  ← User context CRUD
├── lib/
│   ├── coo.js                         ← All Claude API calls
│   ├── google.js                      ← Calendar, Gmail, Tasks, Contacts helpers
│   ├── oura.js                        ← Oura API helpers
│   ├── supabase.js                    ← Supabase client
│   └── realtime.js                    ← Supabase Realtime subscriptions
├── components/
│   ├── MediaUploader.js               ← Voice/file/camera upload component
│   └── errors.js                      ← Error boundary + retry UI
├── public/
│   └── manifest.json                  ← PWA manifest
├── supabase-schema.sql                ← Run this in Supabase SQL editor
├── vercel.json                        ← Cron schedule (7:30am, 12pm, 4pm)
├── .env.example                       ← Copy to .env.local
└── next.config.js
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
