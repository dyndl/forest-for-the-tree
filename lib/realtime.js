'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── SUPABASE REALTIME HOOK ────────────────────────────────────────────────────
// Subscribes to live changes on tasks + schedules for the current user
// Calls callbacks when remote changes come in (e.g. COO updates schedule)

export function useRealtime({ userId, onTaskChange, onScheduleChange, onAgentChange }) {
  const channelRef = useRef(null)

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
        if (onTaskChange) onTaskChange(payload)
      })

      // Schedule changes (COO updates mid-day)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schedules',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (onScheduleChange) onScheduleChange(payload)
      })

      // Agent status changes (alert surfaces)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agents',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (onAgentChange) onAgentChange(payload)
      })

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime connected for', userId)
        }
      })

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
