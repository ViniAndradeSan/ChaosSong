'use client'

import { useState, useEffect, useCallback } from 'react'

const PLAYER_NAME_KEY = 'chaos_song_player_name'

export function usePlayerName() {
  const [playerName, setPlayerNameState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_NAME_KEY)
    setPlayerNameState(stored)
    setHydrated(true)
  }, [])

  const setPlayerName = useCallback((name: string) => {
    const trimmed = name.trim()
    localStorage.setItem(PLAYER_NAME_KEY, trimmed)
    setPlayerNameState(trimmed)
  }, [])

  const clearPlayerName = useCallback(() => {
    localStorage.removeItem(PLAYER_NAME_KEY)
    setPlayerNameState(null)
  }, [])

  return { playerName, hydrated, setPlayerName, clearPlayerName }
}
