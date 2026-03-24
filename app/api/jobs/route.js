import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseJobApplications } from '@/lib/coo'
import { getImportantEmails } from '@/lib/google'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { data: ctx } = await supabaseAdmin.from('user_context').select('job_pipeline').eq('user_id', userId).maybeSingle()
  return Response.json({ pipeline: ctx?.job_pipeline || { applications: [], leads: [], last_scanned: null } })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  let emails = []
  if (session.accessToken) {
    try { emails = await getImportantEmails(session.accessToken, session.refreshToken) } catch {}
  }

  const { data: ctx } = await supabaseAdmin.from('user_context').select('job_pipeline').eq('user_id', userId).maybeSingle()
  const existing = ctx?.job_pipeline || { applications: [], leads: [] }

  const updated = await parseJobApplications({ emails, existing })
  await supabaseAdmin.from('user_context').update({ job_pipeline: updated }).eq('user_id', userId)
  return Response.json({ pipeline: updated })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const body = await req.json()
  const { id, status, notes, action } = body

  const { data: ctx } = await supabaseAdmin.from('user_context').select('job_pipeline').eq('user_id', userId).maybeSingle()
  const pipeline = ctx?.job_pipeline || { applications: [], leads: [] }

  const today = new Date().toISOString().slice(0, 10)

  if (action === 'dismiss_lead') {
    pipeline.leads = (pipeline.leads || []).filter(l => l.id !== id)
  } else if (action === 'convert_lead') {
    const lead = (pipeline.leads || []).find(l => l.id === id)
    if (lead) {
      pipeline.leads = pipeline.leads.filter(l => l.id !== id)
      pipeline.applications = [...(pipeline.applications || []), {
        id: lead.id, company: lead.company, role: lead.role,
        status: 'applied', date_applied: today, last_activity: today, source: 'linkedin', notes: '',
      }]
    }
  } else if (action === 'add') {
    const slug = `${body.company}_${body.role}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_').slice(0, 50)
    pipeline.applications = [...(pipeline.applications || []), {
      id: slug, company: body.company, role: body.role,
      status: 'applied', date_applied: today, last_activity: today, source: 'direct', notes: '',
    }]
  } else if (action === 'delete') {
    pipeline.applications = (pipeline.applications || []).filter(a => a.id !== id)
  } else {
    pipeline.applications = (pipeline.applications || []).map(a =>
      a.id === id ? { ...a, ...(status && { status }), ...(notes !== undefined && { notes }), last_activity: today } : a
    )
  }

  await supabaseAdmin.from('user_context').update({ job_pipeline: pipeline }).eq('user_id', userId)
  return Response.json({ pipeline })
}
