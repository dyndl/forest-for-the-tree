import { createClient } from '@supabase/supabase-js'

let _client = null

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return _client
}

// Lazy proxy — client is not created until first property access,
// so module-level imports during Next.js build don't fail when env vars are absent.
export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    const client = getClient()
    const val = client[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})
