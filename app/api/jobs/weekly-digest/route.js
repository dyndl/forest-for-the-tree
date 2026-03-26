import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
export const dynamic = 'force-dynamic'

// GET — return pending weekly digest for this user
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const { data } = await supabaseAdmin
    .from('weekly_digests')
    .select('*')
    .eq('user_id', userId)
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(data || null)
}
