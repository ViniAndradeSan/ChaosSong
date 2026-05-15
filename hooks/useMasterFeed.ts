'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { clearFeed as clearFeedCheckpoint, fetchFeed, loadSessionState, subscribeFeed } from '@/lib/supabase/mesa'
import type { DiceRoll } from '@/lib/types'

export type EventCategory = 'damage' | 'heal' | 'stress' | 'harmony' | 'system' | 'combat' | 'dice'

export type EventLog = {
  id: string
  timestamp: Date
  message: string
  emoji: string
  category: EventCategory
}

export function useMasterFeed(admin: boolean) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [events, setEvents] = useState<EventLog[]>([])
  const [logClearedAt, setLogClearedAt] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const logClearedAtRef = useRef<string | null>(null)
  const lastSeenDiceRolls = useRef<Set<string>>(new Set())
  const feedRootRef = useRef<HTMLDivElement | null>(null)
  const channelCleanupRef = useRef<() => void>(() => {})

  const scrollToTop = useCallback(() => {
    if (feedRootRef.current) {
      feedRootRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const addLogEvent = useCallback((message: string, emoji: string, category: EventCategory = 'system') => {
    setEvents((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date(), message, emoji, category },
      ...prev.slice(0, 49),
    ])
  }, [])

  const appendDiceEvents = useCallback((rolls: DiceRoll[]) => {
    if (rolls.length === 0) return

    setEvents((prev) => {
      const existingIds = new Set(prev.map((event) => event.id))
      const newEvents = rolls
        .filter((roll) => !existingIds.has(roll.id))
        .map((roll) => {
          const origin = roll.origin || 'sheet'
          const isCritical = roll.roll_type === 'critical'
          const isFailure = roll.roll_type === 'failure'
          let message = `${roll.actor_name} rolou ${roll.expression} = ${roll.total}`
          let emoji = '🎲'
          let category: EventCategory = 'dice'

          if (origin === 'attack') {
            category = 'combat'
            emoji = isCritical ? '💥' : isFailure ? '⚠️' : '⚔️'
            message = `${roll.actor_name} atacou: ${roll.expression} = ${roll.total}`
            if (isCritical) message += ' — Crítico'
            if (isFailure) message += ' — Falha crítica'
          } else if (origin === 'damage') {
            category = 'combat'
            emoji = '🩸'
            message = `${roll.actor_name} causou dano: ${roll.expression} = ${roll.total}`
          }

          return {
            id: roll.id,
            timestamp: new Date(roll.created_at),
            message,
            emoji,
            category,
          }
        })

      return [...newEvents, ...prev].slice(0, 49)
    })
  }, [])

  const purgeOldDiceEvents = useCallback((cutoff: Date) => {
    setEvents((prev) => prev.filter((event) => event.category !== 'dice' || event.timestamp > cutoff))
  }, [])

  const loadInitialFeed = useCallback(async () => {
    if (!admin) return
    setIsLoading(true)
    setError(null)

    try {
      const { logClearedAt: clearedAt } = await loadSessionState(supabase)
      logClearedAtRef.current = clearedAt
      setLogClearedAt(clearedAt)

      const rolls = await fetchFeed(supabase, 20, clearedAt ?? undefined)
      lastSeenDiceRolls.current.clear()
      rolls.forEach((roll) => lastSeenDiceRolls.current.add(roll.id))
      setEvents((prev) => {
        const nonDice = prev.filter((event) => event.category !== 'dice')
        const diceEvents = rolls.map((roll) => {
          const origin = roll.origin || 'sheet'
          const isCritical = roll.roll_type === 'critical'
          const isFailure = roll.roll_type === 'failure'
          let message = `${roll.actor_name} rolou ${roll.expression} = ${roll.total}`
          let emoji = '🎲'
          let category: EventCategory = 'dice'

          if (origin === 'attack') {
            category = 'combat'
            emoji = isCritical ? '💥' : isFailure ? '⚠️' : '⚔️'
            message = `${roll.actor_name} atacou: ${roll.expression} = ${roll.total}`
            if (isCritical) message += ' — Crítico'
            if (isFailure) message += ' — Falha crítica'
          } else if (origin === 'damage') {
            category = 'combat'
            emoji = '🩸'
            message = `${roll.actor_name} causou dano: ${roll.expression} = ${roll.total}`
          }

          return {
            id: roll.id,
            timestamp: new Date(roll.created_at),
            message,
            emoji,
            category,
          }
        })
        return [...diceEvents, ...nonDice].slice(0, 49)
      })
    } catch (err) {
      setError('Erro ao carregar o feed do mestre.')
    } finally {
      setIsLoading(false)
    }
  }, [admin, supabase])

  const handleNewRoll = useCallback(
    (roll: DiceRoll) => {
      if (lastSeenDiceRolls.current.has(roll.id)) return
      const cutoff = logClearedAtRef.current ? new Date(logClearedAtRef.current) : null
      if (cutoff && new Date(roll.created_at) <= cutoff) return

      lastSeenDiceRolls.current.add(roll.id)
      appendDiceEvents([roll])
    },
    [appendDiceEvents],
  )

  const handleCheckpointUpdate = useCallback(
    (timestamp: string) => {
      if (timestamp === logClearedAtRef.current) return
      logClearedAtRef.current = timestamp
      setLogClearedAt(timestamp)
      const cutoff = new Date(timestamp)
      lastSeenDiceRolls.current.clear()
      purgeOldDiceEvents(cutoff)
      addLogEvent('Feed de eventos limpo', '🧹', 'system')
      scrollToTop()
    },
    [addLogEvent, purgeOldDiceEvents, scrollToTop],
  )

  const clearFeed = useCallback(async () => {
    if (!admin) return
    setIsClearing(true)
    setError(null)

    try {
      const timestamp = await clearFeedCheckpoint(supabase)
      logClearedAtRef.current = timestamp
      setLogClearedAt(timestamp)
      lastSeenDiceRolls.current.clear()
      purgeOldDiceEvents(new Date(timestamp))
      addLogEvent('Feed de eventos limpo', '🧹', 'system')
      scrollToTop()
    } catch (err) {
      setError('Erro ao limpar o feed do mestre.')
    } finally {
      setIsClearing(false)
    }
  }, [admin, purgeOldDiceEvents, scrollToTop, supabase, addLogEvent])

  useEffect(() => {
    if (!admin) return

    loadInitialFeed()

    const unsubscribe = subscribeFeed(
      supabase,
      () => logClearedAtRef.current,
      handleNewRoll,
      handleCheckpointUpdate,
    )

    channelCleanupRef.current = unsubscribe

    const pollInterval = window.setInterval(async () => {
      try {
        const rolls = await fetchFeed(supabase, 5, logClearedAtRef.current ?? undefined)
        rolls.forEach((roll) => {
          if (!lastSeenDiceRolls.current.has(roll.id)) {
            lastSeenDiceRolls.current.add(roll.id)
            appendDiceEvents([roll])
          }
        })
      } catch {
        // fallback silencioso
      }
    }, 1200)

    return () => {
      unsubscribe()
      window.clearInterval(pollInterval)
    }
  }, [admin, appendDiceEvents, handleCheckpointUpdate, handleNewRoll, loadInitialFeed, supabase])

  return {
    events,
    logClearedAt,
    clearFeed,
    addLogEvent,
    isClearing,
    isLoading,
    error,
    feedRootRef,
  }
}
