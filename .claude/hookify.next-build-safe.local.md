---
name: next-build-safe
enabled: true
event: bash
pattern: npx\s+next\s+build|next\s+build|npm\s+run\s+build
action: warn
---

⚠️ **next build detected — stale cache risk**

Before running `next build`, always:
1. Kill any running dev server: `kill -9 $(lsof -ti :3000) 2>/dev/null`
2. Clear the cache: `rm -rf .next`

Then build. Running `next build` while the dev server is live corrupts `.next/server/vendor-chunks/` and causes `Cannot find module './vendor-chunks/jose.js'` (and similar) errors on next startup.

**Safe sequence:**
```
kill -9 $(lsof -ti :3000) 2>/dev/null; rm -rf .next && next build
```
