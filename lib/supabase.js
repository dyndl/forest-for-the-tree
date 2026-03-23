import { createClient } from '@supabase/supabase-js'

let _client = null

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return _client
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getClient()
    const val = client[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})
