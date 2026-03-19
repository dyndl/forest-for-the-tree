'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let browserClient

/**
 * Browser Supabase client (anon key). Prefer /api/* routes with the service role
 * for data that must align with NextAuth; this exists for realtime and handoff parity.
 */
export function createClient() {
  if (typeof window === 'undefined') {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  if (!browserClient) {
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return browserClient
}
