// ── Personal context persistence ─────────────────────────────────────────────
// Reads and writes the user's personal context file to their chosen cloud storage.
// The file is always named "forest-context.md" inside a "Forest for the Trees" folder.
//
// Storage backends:
//   google_drive  — Google Drive API (requires drive.file scope)
//   onedrive      — Microsoft Graph API (requires Files.ReadWrite scope)
//   local         — Returns null (context lives only in Supabase user_context row)

const CONTEXT_FILENAME = 'forest-context.md'
const FOLDER_NAME = 'Forest for the Trees'

// ── Google Drive ──────────────────────────────────────────────────────────────

async function getDriveFolder(accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  if (data.files?.length > 0) return data.files[0].id

  // Create folder if it doesn't exist
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const folder = await createRes.json()
  return folder.id
}

async function getDriveContextFileId(accessToken, folderId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${CONTEXT_FILENAME}' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return data.files?.[0]?.id || null
}

export async function readFromGoogleDrive(accessToken) {
  try {
    const folderId = await getDriveFolder(accessToken)
    const fileId   = await getDriveContextFileId(accessToken, folderId)
    if (!fileId) return null

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    return res.ok ? await res.text() : null
  } catch { return null }
}

export async function writeToGoogleDrive(accessToken, content) {
  try {
    const folderId = await getDriveFolder(accessToken)
    const fileId   = await getDriveContextFileId(accessToken, folderId)

    if (fileId) {
      // Update existing file
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/markdown' },
        body: content,
      })
    } else {
      // Create new file in folder
      const meta = JSON.stringify({ name: CONTEXT_FILENAME, parents: [folderId] })
      const boundary = 'fftrees_boundary'
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      })
    }
    return true
  } catch { return false }
}

// ── Microsoft OneDrive ────────────────────────────────────────────────────────

const OD_BASE = 'https://graph.microsoft.com/v1.0/me/drive/root'

export async function readFromOneDrive(accessToken) {
  try {
    const res = await fetch(
      `${OD_BASE}:/${FOLDER_NAME}/${CONTEXT_FILENAME}:/content`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    return res.ok ? await res.text() : null
  } catch { return null }
}

export async function writeToOneDrive(accessToken, content) {
  try {
    // OneDrive PUT creates file + folder path automatically
    const res = await fetch(
      `${OD_BASE}:/${FOLDER_NAME}/${CONTEXT_FILENAME}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'text/plain',
        },
        body: content,
      }
    )
    return res.ok
  } catch { return false }
}

// ── Unified interface ─────────────────────────────────────────────────────────

/**
 * Read the user's context file from their chosen cloud storage.
 * Returns null if not found or tier is 'local'.
 *
 * @param {string} tier - 'google_drive' | 'onedrive' | 'local'
 * @param {string} accessToken
 */
export async function readContextFile(tier, accessToken) {
  if (tier === 'google_drive') return readFromGoogleDrive(accessToken)
  if (tier === 'onedrive')     return readFromOneDrive(accessToken)
  return null // local tier — context lives only in Supabase
}

/**
 * Write the user's context file to their chosen cloud storage.
 *
 * @param {string} tier - 'google_drive' | 'onedrive' | 'local'
 * @param {string} accessToken
 * @param {object} userContext - the full user_context row from Supabase
 */
export async function writeContextFile(tier, accessToken, userContext) {
  if (tier !== 'google_drive' && tier !== 'onedrive') return false

  const content = buildContextMarkdown(userContext)
  if (tier === 'google_drive') return writeToGoogleDrive(accessToken, content)
  if (tier === 'onedrive')     return writeToOneDrive(accessToken, content)
  return false
}

/**
 * Builds a human-readable markdown representation of the user's context.
 * This is the file that survives upgrades and MRs — editable by hand.
 */
export function buildContextMarkdown(ctx) {
  const areas = (ctx.life_areas || [])
    .map(a => `- ${a.emoji} **${a.label}** — ${a.blocks} blocks/week (${a.blocks * 15} min)`)
    .join('\n') || '- (none set)'

  const patterns = ctx.adhd_patterns?.length
    ? ctx.adhd_patterns.join(', ')
    : 'none'

  const notifOn = Object.entries(ctx.notification_prefs || {})
    .filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'

  return `# Forest for the Trees — Personal Context
<!-- This file is auto-generated and synced by the app. -->
<!-- You can edit it directly; changes will be picked up on the next COO run. -->
<!-- Do NOT commit this file to a public repo — it contains personal information. -->

## Identity
- **Integration tier**: ${ctx.integration_tier || 'google'}
- **Active add-ons**: ${(ctx.addons || []).join(', ') || 'none'}

## Goals
- **4-week roadmap**: ${ctx.roadmap || '(not set)'}
- **Peak focus hours**: ${ctx.peak_hours || '9-11am, 3-5pm'}

## Life areas
${areas}

## COO style
- **ADHD-aware mode**: ${ctx.adhd_aware ? 'enabled' : 'disabled'}
- **Recognised patterns**: ${patterns}
- **Notes for COO**: ${ctx.coo_notes || '(none)'}

## Notifications
- **Active**: ${notifOn}

## Personal outline
${ctx.outline || '(not provided)'}

---
_Last updated: ${new Date().toISOString()}_
`
}
