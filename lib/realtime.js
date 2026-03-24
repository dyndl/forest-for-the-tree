'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── SUPABASE REALTIME HOOK ────────────────────────────────────────────────────
// Subscribes to live changes on tasks + schedules for the current user
// Calls callbacks when remote changes come in (e.g. COO updates schedule)

export function useRealtime({ userId, onTaskChange, onScheduleChange, onAgentChange }) {
  const channelRef = useRef(null)
  // Keep callback refs fresh so the channel never closes over stale handlers
  const cbTask = useRef(onTaskChange)
  const cbSched = useRef(onScheduleChange)
  const cbAgent = useRef(onAgentChange)
  useEffect(() => { cbTask.current = onTaskChange }, [onTaskChange])
  useEffect(() => { cbSched.current = onScheduleChange }, [onScheduleChange])
  useEffect(() => { cbAgent.current = onAgentChange }, [onAgentChange])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`user_${userId.replace(/[^a-z0-9]/g, '_')}`)

      // Task changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (cbTask.current) cbTask.current(payload)
      })

      // Schedule changes (COO updates mid-day)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schedules',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (cbSched.current) cbSched.current(payload)
      })

      // Agent status changes (alert surfaces)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agents',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (cbAgent.current) cbAgent.current(payload)
      })

      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}

// ── PRESENCE HOOK — know if app is open on another device ─────────────────────
export function usePresence({ userId, view }) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`presence_${userId.replace(/[^a-z0-9]/g, '_')}`)
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ view, online_at: new Date().toISOString() })
      }
    })

    return () => { supabase.removeChannel(channel) }
  }, [userId, view])
}
