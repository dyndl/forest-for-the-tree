# Contributing to Forest for the Trees

Thanks for your interest in contributing! This is a small open project — contributions of all sizes are welcome.

---

## Getting started

1. Fork the repo and clone it locally
2. Follow [SETUP.md](./SETUP.md) to get a working dev environment
3. Run `npm run dev` and make sure the app boots at `http://localhost:3000`

---

## What's worth contributing

**Good first issues:**
- UI polish / mobile layout fixes
- Additional life area suggestions in the onboarding `AREA_SUGGESTIONS` list
- New agent prompt templates
- Typos or unclear docs

**Medium effort:**
- Additional wearable integrations (Whoop, Garmin, Apple Health)
- New notification channels (Slack, email digest via Resend)
- Settings page improvements
- Accessibility improvements

**Larger features (open an issue first):**
- Multi-user / team support
- Native mobile app (React Native)
- Additional calendar providers (Outlook, iCal)
- Finance tracking integration (Plaid)

---

## Ground rules

- **No personal data in code.** All defaults must be empty strings, empty arrays, or generic placeholders. Never hardcode names, goals, API keys, or personal preferences.
- **Never commit `user-context/my-context.md`.** This file is gitignored for good reason — it contains personal information. Only `user-context/my-context.example.md` belongs in the repo.
- **Keep the COO persona neutral.** The system prompts should work for any user's life — not assume a specific job, lifestyle, or goal type.
- **Feature flags over breaking changes.** New optional features should be off by default (like ADHD-aware mode).
- **One PR per concern.** Keep changes focused — a UI fix and a new API route shouldn't be in the same PR.

---

## Branch naming

```
feat/short-description
fix/short-description
docs/short-description
refactor/short-description
```

---

## Pull request checklist

- [ ] No hardcoded personal data anywhere in the diff
- [ ] `.env.example` updated if new env vars were added
- [ ] `supabase-schema.sql` updated if new tables/columns were added
- [ ] Onboarding flow still works end-to-end
- [ ] No `console.log` left in production paths

---

## Adding a new environment variable

1. Add it to `.env.example` with a placeholder value and a comment
2. Document it in the **Environment variables** table in `README.md`
3. Add it to the **Step 4** table in `SETUP.md`

---

## Questions

Open an issue with the `question` label — happy to help.

---

## Personal context and upgrades

When you fork this repo and deploy your own instance, your personal context lives in two places:

1. **Supabase** — the `user_context` table (source of truth for the running app)
2. **Your cloud storage** — `Forest for the Trees/forest-context.md` in Google Drive or OneDrive (auto-synced)

When pulling upstream changes from this repo:
```bash
git fetch upstream
git merge upstream/main
```

Neither location is affected — your Supabase data and cloud file are completely outside the git repo. You can upgrade freely without losing any personal context.

If you want to **hand-edit** your context (e.g. to update your roadmap or outline before the next COO run), edit `Forest for the Trees/forest-context.md` directly in Google Drive / OneDrive. The app reads it on every COO morning run.

For the **zero-integration tier**, copy `user-context/my-context.example.md` to `user-context/my-context.md` and fill it in locally.
