# Releasing Forest for the Trees

This project uses a two-remote, three-branch model to separate private development from public releases.

---

## Remote setup

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | `gitlab.com/duanemlee/forest-for-the-trees` | Private working remote — all day-to-day development |
| `github` | `github.com/dyndl/forest-for-the-trees` | Public release mirror — only updated via CI |

---

## Branch model

```
main    ──►  GitLab only       (daily work, never auto-mirrors to GitHub)
  │
  └──► beta    ──► GitHub 'beta'   (auto-mirrors on every merge to beta)
         │
         └──► stable  ──► GitHub 'main'  (mirrors only on manual CI approval)
```

| Branch | Who sees it | How it gets to GitHub |
|--------|-------------|----------------------|
| `main` | You only (GitLab) | Never mirrors automatically |
| `beta` | GitHub beta branch | Auto-mirrors on every push |
| `stable` | GitHub main branch | Manual trigger in GitLab CI UI |

---

## Day-to-day development

Work on `main` as normal. Push to GitLab only:

```bash
git add .
git commit -m "feat: your change"
git push origin main   # stays on GitLab
```

---

## Cutting a beta release

When `main` is in a state you want to share publicly as a beta:

```bash
# Merge main into beta
git checkout beta
git merge main
git push origin beta   # triggers CI → auto-mirrors to GitHub 'beta'
git checkout main
```

GitLab CI runs `mirror_beta` automatically. Within ~1 minute, `github.com/dyndl/forest-for-the-trees/tree/beta` is updated.

---

## Cutting a stable release

When beta has been tested and you're ready for a public stable release:

```bash
# Merge beta into stable
git checkout stable
git merge beta
git push origin stable   # CI job appears in GitLab, waits for your approval
git checkout main
```

Then go to **GitLab → CI/CD → Pipelines**, find the `mirror_stable` job, and click **▶ Run**. This is the manual gate — it will not mirror until you explicitly approve it.

Once approved, `github.com/dyndl/forest-for-the-trees` (main branch) is updated.

---

## CI setup (one-time)

Before the pipeline can push to GitHub, add two variables in GitLab:

**GitLab → Settings → CI/CD → Variables**

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `GITHUB_TOKEN` | Your GitHub personal access token (`repo` scope) | ✅ Yes | ✅ Yes |
| `GITHUB_REPO` | `dyndl/forest-for-the-trees` | ✅ Yes | No |

**Generate the GitHub token:**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Repository access: `dyndl/forest-for-the-trees`
3. Permissions: **Contents** → Read and write
4. Copy the token → paste into GitLab variable

---

## Creating the beta and stable branches (first time)

```bash
# Create both branches from current main
git checkout -b beta
git push origin beta

git checkout -b stable
git push origin stable

git checkout main
```

---

## GitHub branch protection (recommended)

On GitHub, protect the `main` branch so it can only be updated by CI (not direct pushes):

**GitHub → Settings → Branches → Add rule**
- Branch name pattern: `main`
- ✅ Restrict who can push — add only your CI bot or leave empty (nobody pushes directly)

This ensures `github/main` is always a deliberate stable release, never an accidental push.

---

## Summary cheat sheet

```bash
# Daily work
git push origin main

# Beta release
git checkout beta && git merge main && git push origin beta && git checkout main

# Stable release
git checkout stable && git merge beta && git push origin stable && git checkout main
# → then approve mirror_stable in GitLab CI UI
```
