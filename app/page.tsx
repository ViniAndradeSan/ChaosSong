'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, AlertTriangle, Music } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { CharacterCard } from '@/components/CharacterCard'
import { DiceRoller } from '@/components/DiceRoller'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { useAdmin } from '@/lib/admin'
import { usePlayerName } from '@/lib/usePlayerName'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { fetchCharacters } from '@/lib/supabase/mesa'
import type { Character } from '@/lib/types'
import Link from 'next/link'

export default function HomePage() {
  const { admin } = useAdmin()
  const { playerName, hydrated: nameHydrated, setPlayerName } = usePlayerName()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)

  // Throttle realtime updates - batch changes within 300ms window
  const pendingUpdatesRef = useRef<Map<string, Character>>(new Map())
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Show welcome screen only after hydration, when no name is stored
  useEffect(() => {
    if (nameHydrated && !playerName && !admin) {
      setShowWelcome(true)
    }
  }, [nameHydrated, playerName, admin])

  const handleWelcomeEnter = (name: string) => {
    setPlayerName(name)
    setShowWelcome(false)
  }

  useEffect(() => {
    const supabase = getSupabaseClient()

    async function loadCharacters() {
      try {
        setLoading(true)
        const data = await fetchCharacters(supabase)
        setCharacters(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar fichas')
      } finally {
        setLoading(false)
      }
    }

    loadCharacters()

    // Realtime subscription with throttled updates
    const channel = supabase
      .channel('sheets-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'characters' },
        (payload) => {
          // Queue update instead of applying immediately
          if (payload.eventType === 'DELETE') {
            pendingUpdatesRef.current.set(`DELETE_${payload.old.id}`, payload.old as Character)
          } else {
            pendingUpdatesRef.current.set(payload.new.id, payload.new as Character)
          }
          
          // Clear existing timeout and set new one
          if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
          
          updateTimeoutRef.current = setTimeout(() => {
            setCharacters((prev) => {
              let updated = [...prev]
              
              for (const [key, char] of pendingUpdatesRef.current.entries()) {
                if (key.startsWith('DELETE_')) {
                  const id = key.replace('DELETE_', '')
                  updated = updated.filter((c) => c.id !== id)
                } else {
                  const idx = updated.findIndex((c) => c.id === char.id)
                  if (idx >= 0) {
                    updated[idx] = char
                  } else {
                    updated.push(char)
                  }
                }
              }
              
              return updated.sort((a, b) => a.name.localeCompare(b.name))
            })
            
            pendingUpdatesRef.current.clear()
          }, 300)
        }
      )
      .subscribe()

    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredCharacters = characters.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.classe?.toLowerCase().includes(search.toLowerCase()) ||
      c.ego?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Welcome screen overlay */}
      <AnimatePresence>
        {showWelcome && <WelcomeScreen onEnter={handleWelcomeEnter} />}
      </AnimatePresence>

      <SiteHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full">
        {/* Hero Banner */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-8 sm:p-12 mb-10 overflow-hidden relative"
        >
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 size-72 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative z-10">
            <span className="text-xs uppercase tracking-[0.5em] text-muted-foreground mb-3 block">
              Chaos Song · Vol. I
            </span>
            <h1 className="font-serif text-4xl sm:text-6xl font-bold leading-tight mb-4">
              <span className="text-gradient">Cantores da</span>
              <br />
              <span className="text-foreground">Tempestade Final</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg">
              Um grimório vivo onde cada ficha é um instrumento arcano. Invoque poderes, 
              consulte resistências e mantenha sua Harmonia ressoando contra o caos.
            </p>
          </div>
        </motion.section>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, classe, ego..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-input/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>

          {/* New character button (admin only) */}
          {admin && (
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold bg-gradient-to-br from-primary via-secondary to-accent text-primary-foreground hover:opacity-90 shadow-[0_0_30px_oklch(0.65_0.27_320/0.4)] transition"
            >
              <Plus className="size-4" />
              Nova ficha
            </Link>
          )}
        </div>

        {/* Character grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl glass animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="glass-strong rounded-2xl p-6 text-center">
            <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
            <h3 className="font-serif text-xl mb-2">Erro ao carregar grimório</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Verifique se a tabela &quot;characters&quot; existe no Supabase e se as variáveis de ambiente estão configuradas.
            </p>
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <Music className="size-12 text-primary/40 mx-auto mb-4" />
            <h3 className="font-serif text-xl text-gradient mb-2">
              O silêncio antes da canção
            </h3>
            <p className="text-muted-foreground">
              {search
                ? 'Nenhum cantor encontrado com esses termos.'
                : 'Nenhuma ficha registrada ainda. Invoque o primeiro cantor!'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCharacters.map((character, index) => (
              <CharacterCard key={character.id} character={character} index={index} />
            ))}
          </div>
        )}
      </main>

      <DiceRoller actorName={playerName ?? undefined} />
    </div>
  )
}
