// ── Integration tier feature flags ───────────────────────────────────────────
// Each tier unlocks different features across the app.
// API routes and UI components check these flags before calling external services.
//
// Usage:
//   import { getFeatureFlags } from '@/lib/integrations'
//   const flags = getFeatureFlags(userSettings.integration_tier, userSettings.addons)
//   if (flags.googleCalendar) { ... }

export const TIER_FEATURES = {
  zero: {
    googleCalendar:   false,
    googleGmail:      false,
    googleTasks:      false,
    googleContacts:   false,
    googleDrive:      false,
    microsoftOutlook: false,
    microsoftTeams:   false,
    microsoftOneDrive:false,
    contextStorage:   'local',   // 'local' | 'google_drive' | 'onedrive'
    scheduleSource:   'manual',  // 'manual' | 'google' | 'microsoft'
  },
  google: {
    googleCalendar:   true,
    googleGmail:      true,
    googleTasks:      true,
    googleContacts:   true,
    googleDrive:      true,
    microsoftOutlook: false,
    microsoftTeams:   false,
    microsoftOneDrive:false,
    contextStorage:   'google_drive',
    scheduleSource:   'google',
  },
  microsoft: {
    googleCalendar:   false,
    googleGmail:      false,
    googleTasks:      false,
    googleContacts:   false,
    googleDrive:      false,
    microsoftOutlook: true,
    microsoftTeams:   true,
    microsoftOneDrive:true,
    contextStorage:   'onedrive',
    scheduleSource:   'microsoft',
  },
}

export const ADDON_FEATURES = {
  oura:    { ouraRing: true },
  whisper: { voiceTranscription: true },
}

/**
 * Returns a flat flags object for a given tier + active add-ons.
 * @param {string} tier - 'zero' | 'google' | 'microsoft'
 * @param {string[]} addons - e.g. ['oura', 'whisper']
 * @returns {object} merged feature flags
 */
export function getFeatureFlags(tier = 'google', addons = []) {
  const base = TIER_FEATURES[tier] || TIER_FEATURES.google
  const addonFlags = addons.reduce((acc, id) => ({
    ...acc,
    ...(ADDON_FEATURES[id] || {}),
  }), {})
  return { ...base, ...addonFlags }
}

/**
 * Returns a human-readable label for a tier.
 */
export function getTierLabel(tier) {
  return { zero: 'Zero integrations', google: 'Google', microsoft: 'Microsoft' }[tier] || tier
}
