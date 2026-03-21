import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createGoogleTask, completeGoogleTask, getGoogleTasks } from '@/lib/google'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// GET /api/tasks — fetch today's tasks
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const date = new URL(req.url).searchParams.get('date') || todayKey()

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tasks: data })
}

// POST /api/tasks — create task + sync to Google Tasks
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()
  const task = {
    user_id: userId,
    name: body.name,
    q: body.q || 'do',
    cat: body.cat || 'admin',
    blocks: body.blocks || 2,
    who: body.who || 'me',
    notes: body.notes || '',
    done: false,
    date: body.date || todayKey(),
    source: body.source || 'manual',
    google_task_id: null,
  }

  const { data, error } = await supabaseAdmin.from('tasks').insert(task).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Sync to Google Tasks async (don't block response)
  if (session.accessToken) {
    try {
      const { listId } = await getGoogleTasks(session.accessToken, session.refreshToken)
      if (listId) {
        await createGoogleTask(session.accessToken, session.refreshToken, listId, task)
      }
    } catch {}
  }

  return Response.json({ task: data })
}

// PATCH /api/tasks — update (toggle done, move quadrant)
export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()
  const { id, ...updates } = body

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // If marking done, sync to Google Tasks
  if (updates.done && data.google_task_id && session.accessToken) {
    try {
      const { listId } = await getGoogleTasks(session.accessToken, session.refreshToken)
      if (listId && data.google_task_id) {
        await completeGoogleTask(session.accessToken, session.refreshToken, listId, data.google_task_id)
      }
    } catch {}
  }

  return Response.json({ task: data })
}

// DELETE /api/tasks
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabaseAdmin.from('tasks').delete().eq('id', id).eq('user_id', session.user.email)
  return Response.json({ ok: true })
}
