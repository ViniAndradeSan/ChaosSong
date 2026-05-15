'use client'

import { useState, useEffect, useCallback } from 'react'

const ADMIN_KEY = 'chaos_song_admin'
const MASTER_PASSWORD = 'tempestade' // Senha local do mestre (soft protection)

export function loginAdmin(password: string): boolean {
  if (password === MASTER_PASSWORD) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      new BroadcastChannel('admin_sync').postMessage({ type: 'login' })
    }
    return true
  }
  return false
}

export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_KEY)
    new BroadcastChannel('admin_sync').postMessage({ type: 'logout' })
  }
}

export function isAdmin(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(ADMIN_KEY) === 'true'
}

export function useAdmin() {
  const [admin, setAdmin] = useState(false)
  // Bug 3 fix: hydrated evita redirect falso antes da hidratação do sessionStorage
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setAdmin(isAdmin())
    setHydrated(true)

    // Bug 5 fix: window.addEventListener('storage') NÃO dispara para sessionStorage.
    // Usar BroadcastChannel para sincronizar entre abas.
    const channel = new BroadcastChannel('admin_sync')
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'logout') setAdmin(false)
      if (e.data?.type === 'login') setAdmin(true)
    }
    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [])

  const login = useCallback((password: string) => {
    const success = loginAdmin(password)
    if (success) setAdmin(true)
    return success
  }, [])

  const logout = useCallback(() => {
    logoutAdmin()
    setAdmin(false)
  }, [])

  return { admin, hydrated, login, logout }
}
