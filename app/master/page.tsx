  'use client'

  import { useState, useEffect, useRef, useMemo } from 'react'
  import { useRouter } from 'next/navigation'
  import Link from 'next/link'
  import { motion, AnimatePresence } from 'framer-motion'
  import {
    LayoutGrid, Tv2, ArrowLeft, Heart, Activity,
    Users, X, Minus, Plus, Sparkles
  } from 'lucide-react'
  import { toast } from 'sonner'
  import { SiteHeader } from '@/components/SiteHeader'
import { SessionManager } from '@/components/SessionManager'
  import { useAdmin } from '@/lib/admin'
  import { getSupabaseClient } from '@/lib/supabase/singleton'
  import { fetchCharacters, updateCharacterField } from '@/lib/supabase/mesa'
  import { useFloatingText } from '@/hooks/use-floating-text'
  import { useMasterFeed, EventCategory } from '@/hooks/useMasterFeed'
  import { FloatingTexts } from '@/components/FloatingText'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import type { Character } from '@/lib/types'

  type Tab = 'fichas' | 'sessao'

const EVENT_STYLES: Record<EventCategory, { color: string; bg: string }> = {
  damage: { color: 'text-red-400', bg: 'bg-red-500/10' },
  heal: { color: 'text-green-400', bg: 'bg-green-500/10' },
  stress: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  harmony: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  system: { color: 'text-muted-foreground', bg: 'bg-muted/20' },
  combat: { color: 'text-primary', bg: 'bg-primary/10' },
  dice: { color: 'text-violet-400', bg: 'bg-violet-500/10' },
}


  function getCardBorderStyle(char: Character): string {
    const hpPct = char.hp_max > 0 ? char.hp / char.hp_max : 1
    const stressPct = char.stress_max > 0 ? char.stress / char.stress_max : 0
    const harmonyFull = (char.harmony ?? 0) >= (char.harmony_max ?? 5)

    if (hpPct < 0.2) return 'ring-2 ring-red-500/60'
    if (stressPct > 0.8) return 'ring-2 ring-orange-500/40'
    if (harmonyFull) return 'ring-2 ring-blue-400/50'
    return 'ring-1 ring-white/10'
  }

  export default function MasterDashboard() {
    const { admin, hydrated } = useAdmin()
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('fichas')
    const [characters, setCharacters] = useState<Character[]>([])
    const {
      events,
      clearFeed,
      addLogEvent,
      feedRootRef,
    } = useMasterFeed(admin)
    const [selectedChar, setSelectedChar] = useState<Character | null>(null)
    const [showVitalsEditor, setShowVitalsEditor] = useState(false)
    const [vitalsDraft, setVitalsDraft] = useState<{
      hp: number
      hp_max: number
      stress: number
      stress_max: number
      harmony: number
      harmony_max: number
    } | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [masterNotesOpen, setMasterNotesOpen] = useState(true)
    const [masterNotesDraft, setMasterNotesDraft] = useState('')
    const [masterNotesSaving, setMasterNotesSaving] = useState(false)
    const [conditionInput, setConditionInput] = useState('')
    const lastLocalUpdate = useRef<number>(0)
    const noteSaveTimer = useRef<number | null>(null)
    const supabase = useMemo(() => getSupabaseClient(), [])

    useEffect(() => {
      if (hydrated && !admin) router.push('/')
    }, [admin, hydrated, router])

    useEffect(() => {
      if (!admin) return

      async function loadCharacters() {
        const data = await fetchCharacters(supabase)
        setCharacters(data)
      }

      loadCharacters()
    }, [admin, supabase])

    const updateField = async (charId: string, field: string, value: unknown) => {
      setSyncing(true)
      lastLocalUpdate.current = Date.now()

      const previousCharacters = characters
      const previousSelectedChar = selectedChar

      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? { ...c, [field]: value } : c))
      )
      if (selectedChar?.id === charId) {
        setSelectedChar((prev) => prev ? { ...prev, [field]: value } : null)
      }

      try {
        await updateCharacterField(supabase, charId, { [field]: value } as Partial<Character>)
      } catch {
        setCharacters(previousCharacters)
        setSelectedChar((prev) => (prev?.id === charId ? previousSelectedChar : prev))
        toast.error('Erro ao atualizar')
      } finally {
        setSyncing(false)
      }
    }

    const scheduleMasterNotesSave = async (value: string) => {
      setMasterNotesDraft(value)
      if (!selectedChar) return
      if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current)

      noteSaveTimer.current = window.setTimeout(async () => {
        setMasterNotesSaving(true)
        await updateField(selectedChar.id, 'master_notes', value)
        setMasterNotesSaving(false)
        addLogEvent(`${selectedChar.name}: notas do mestre atualizadas`, '📝', 'system')
      }, 700)
    }

    const addCondition = async () => {
      if (!selectedChar || !conditionInput.trim()) return
      const nextConditions = Array.from(new Set([...(selectedChar.conditions ?? []), conditionInput.trim()]))
      await updateField(selectedChar.id, 'conditions', nextConditions)
      setConditionInput('')
      addLogEvent(`${selectedChar.name}: condição adicionada ${conditionInput.trim()}`, '⚠️', 'combat')
    }

    const removeCondition = async (condition: string) => {
      if (!selectedChar) return
      const nextConditions = (selectedChar.conditions ?? []).filter((item) => item !== condition)
      await updateField(selectedChar.id, 'conditions', nextConditions)
      addLogEvent(`${selectedChar.name}: condição removida ${condition}`, '⚠️', 'combat')
    }

    useEffect(() => {
      if (!selectedChar) return
      setMasterNotesDraft(selectedChar.master_notes ?? '')
      setConditionInput('')
      if (noteSaveTimer.current) {
        window.clearTimeout(noteSaveTimer.current)
        noteSaveTimer.current = null
      }
    }, [selectedChar?.id, selectedChar?.master_notes])

    useEffect(() => {
      return () => {
        if (noteSaveTimer.current) {
          window.clearTimeout(noteSaveTimer.current)
        }
      }
    }, [])

    const openVitalsEditor = () => {
      if (!selectedChar) return
      setVitalsDraft({
        hp: selectedChar.hp,
        hp_max: selectedChar.hp_max,
        stress: selectedChar.stress,
        stress_max: selectedChar.stress_max,
        harmony: selectedChar.harmony ?? 0,
        harmony_max: selectedChar.harmony_max ?? 5,
      })
      setShowVitalsEditor(true)
    }

    const handleClearFeed = async () => {
      try {
        await clearFeed()
        toast.success('Feed de eventos limpo')
      } catch {
        toast.error('Erro ao limpar feed de eventos')
      }
    }

    const saveVitalsEditor = async () => {
      if (!selectedChar || !vitalsDraft) return
      setSyncing(true)
      lastLocalUpdate.current = Date.now()

      const next = {
        hp: Math.max(0, Math.min(vitalsDraft.hp, vitalsDraft.hp_max)),
        hp_max: Math.max(0, vitalsDraft.hp_max),
        stress: Math.max(0, Math.min(vitalsDraft.stress, vitalsDraft.stress_max)),
        stress_max: Math.max(0, vitalsDraft.stress_max),
        harmony: Math.max(0, Math.min(vitalsDraft.harmony, vitalsDraft.harmony_max)),
        harmony_max: Math.max(0, vitalsDraft.harmony_max),
      }

      try {
        await updateCharacterField(supabase, selectedChar.id, { ...next, updated_at: new Date().toISOString() } as Partial<Character>)

        setCharacters((prev) => prev.map((c) => (c.id === selectedChar.id ? { ...c, ...next } : c)))
        setSelectedChar((prev) => prev ? { ...prev, ...next } : prev)
        setShowVitalsEditor(false)
        toast.success('Vitais atualizados')
      } catch {
        toast.error('Erro ao atualizar vitais')
      } finally {
        setSyncing(false)
      }
    }

    if (!hydrated) return null
    if (!admin) return null

    const totalHP = characters.reduce((sum, c) => sum + c.hp, 0)
    const totalHPMax = characters.reduce((sum, c) => sum + c.hp_max, 0)
    const totalStress = characters.reduce((sum, c) => sum + c.stress, 0)
    const totalStressMax = characters.reduce((sum, c) => sum + c.stress_max, 0)
    const totalHarmony = characters.reduce((sum, c) => sum + (c.harmony ?? 0), 0)
    const totalHarmonyMax = characters.reduce((sum, c) => sum + (c.harmony_max ?? 5), 0)
    const totalHPPct = totalHPMax > 0 ? (totalHP / totalHPMax) * 100 : 0
    const totalStressPct = totalStressMax > 0 ? (totalStress / totalStressMax) * 100 : 0
    const totalHarmonyPct = totalHarmonyMax > 0 ? (totalHarmony / totalHarmonyMax) * 100 : 0

    return (
      <>
        <div className="min-h-screen flex flex-col">
        <SiteHeader />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
          {/* Header with wave pulse */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="size-4" />
                Grimório
              </Link>
              <div className="relative flex items-center">
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                <h1 className="font-serif text-2xl text-gradient relative">Escudo do Mestre</h1>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <span className="text-2xl font-serif font-bold">{characters.length}</span>
                <span className="text-xs text-muted-foreground block">Cantores</span>
              </div>
            </div>
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-[var(--hp)]/20 flex items-center justify-center">
                <Heart className="size-5 text-[var(--hp)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold">{totalHP}</span>
                  <span className="text-xs text-muted-foreground">/ {totalHPMax}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden mt-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--hp), oklch(0.85 0.15 320))' }}
                    animate={{ width: `${Math.min(100, totalHPPct)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground block mt-2">HP Total</span>
              </div>
            </div>
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-[var(--stress)]/20 flex items-center justify-center">
                <Activity className="size-5 text-[var(--stress)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold">{totalStress}</span>
                  <span className="text-xs text-muted-foreground">/ {totalStressMax}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden mt-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--stress), oklch(0.85 0.15 46))' }}
                    animate={{ width: `${Math.min(100, totalStressPct)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground block mt-2">Estresse Total</span>
              </div>
            </div>
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-[var(--harmony)]/20 flex items-center justify-center">
                <Sparkles className="size-5 text-[var(--harmony)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold">{totalHarmony}</span>
                  <span className="text-xs text-muted-foreground">/ {totalHarmonyMax}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden mt-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--harmony), oklch(0.85 0.15 240))' }}
                    animate={{ width: `${Math.min(100, totalHarmonyPct)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground block mt-2">Harmonia Total</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {(['fichas', 'sessao'] as Tab[]).map((t) => {
              const icons = { fichas: <LayoutGrid className="size-4" />, sessao: <Tv2 className="size-4" /> }
              const labels = { fichas: 'Fichas Vivas', sessao: 'Sessão' }
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${tab === t ? 'bg-primary/20 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                    }`}
                >
                  {icons[t]}
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2">
              {tab === 'fichas' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {characters.map((char) => {
                    const borderStyle = getCardBorderStyle(char)
                    const isRecentlyUpdated = char.updated_at
                      ? Date.now() - new Date(char.updated_at).getTime() < 5000
                      : false

                    return (
                      <motion.button
                        key={char.id}
                        onClick={() => setSelectedChar(char)}
                        whileHover={{ y: -2 }}
                        animate={isRecentlyUpdated ? {
                          boxShadow: [
                            '0 0 0px rgba(139,92,246,0)',
                            '0 0 22px rgba(139,92,246,0.65)',
                            '0 0 0px rgba(139,92,246,0)',
                          ],
                        } : {}}
                        transition={isRecentlyUpdated ? { duration: 1, repeat: 1 } : {}}
                        className={`text-left glass rounded-xl p-4 transition ${selectedChar?.id === char.id ? 'ring-arcane' : ''
                          } ${borderStyle}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="size-10 rounded-lg bg-gradient-to-br from-secondary via-primary to-accent flex items-center justify-center font-serif font-bold ring-1 ring-white/10">
                            {char.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-serif font-semibold">{char.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              Nv {char.level} · {char.classe}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <MiniBar label="HP" value={char.hp} max={char.hp_max} color="var(--hp)" />
                          <MiniBar label="EST" value={char.stress} max={char.stress_max} color="var(--stress)" />
                          <MiniBar label="HAR" value={char.harmony ?? 0} max={char.harmony_max ?? 5} color="var(--harmony)" />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {tab === 'sessao' && (
                <SessionManager characters={characters} />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Selected character panel */}
              <AnimatePresence>
                {selectedChar && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="glass-strong rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-lg">{selectedChar.name}</h3>
                      <button
                        onClick={() => setSelectedChar(null)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <QuickControl
                        label="HP"
                        value={selectedChar.hp}
                        max={selectedChar.hp_max}
                        color="var(--hp)"
                        icon={<Heart className="size-4" />}
                        syncing={syncing}
                        onIncrement={() => updateField(selectedChar.id, 'hp', Math.min(selectedChar.hp + 1, selectedChar.hp_max))}
                        onDecrement={() => updateField(selectedChar.id, 'hp', Math.max(selectedChar.hp - 1, 0))}
                      />

                      <QuickControl
                        label="Estresse"
                        value={selectedChar.stress}
                        max={selectedChar.stress_max}
                        color="var(--stress)"
                        icon={<Activity className="size-4" />}
                        syncing={syncing}
                        onIncrement={() => updateField(selectedChar.id, 'stress', Math.min(selectedChar.stress + 1, selectedChar.stress_max))}
                        onDecrement={() => updateField(selectedChar.id, 'stress', Math.max(selectedChar.stress - 1, 0))}
                      />

                      <QuickControl
                        label="Harmonia"
                        value={selectedChar.harmony ?? 0}
                        max={selectedChar.harmony_max ?? 5}
                        color="var(--harmony)"
                        icon={<Sparkles className="size-4" />}
                        syncing={syncing}
                        onIncrement={() => updateField(selectedChar.id, 'harmony', Math.min((selectedChar.harmony ?? 0) + 1, selectedChar.harmony_max ?? 5))}
                        onDecrement={() => updateField(selectedChar.id, 'harmony', Math.max((selectedChar.harmony ?? 0) - 1, 0))}
                      />

                      <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium">Atributos</p>
                            <p className="text-xs text-muted-foreground">Visão rápida</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          {[
                            { label: 'AGL', value: selectedChar.agl },
                            { label: 'CAR', value: selectedChar.car },
                            { label: 'FOR', value: selectedChar.forca },
                            { label: 'INT', value: selectedChar.intt },
                            { label: 'PRE', value: selectedChar.pre },
                            { label: 'VIG', value: selectedChar.vig },
                            { label: 'DT', value: selectedChar.dt },
                            { label: 'Mov', value: selectedChar.movement },
                          ].map((row) => (
                            <div key={row.label} className="rounded-xl bg-muted/10 p-2 text-center">
                              <div className="font-semibold text-sm text-foreground">{row.value}</div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{row.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium">Condições</p>
                            <p className="text-xs text-muted-foreground">Aplique efeitos rápidos</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(selectedChar.conditions ?? []).length > 0 ? (
                            selectedChar.conditions?.map((condition) => (
                              <span key={condition} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary">
                                <span>{condition}</span>
                                <button
                                  type="button"
                                  onClick={() => removeCondition(condition)}
                                  className="text-xs text-primary/70 hover:text-primary"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem condições ativas</p>
                          )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <input
                            type="text"
                            value={conditionInput}
                            onChange={(e) => setConditionInput(e.target.value)}
                            placeholder="Ex: Atordoado"
                            className="rounded-lg border border-border/50 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                          />
                          <button
                            type="button"
                            onClick={addCondition}
                            className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
                        <button
                          type="button"
                          onClick={() => setMasterNotesOpen((prev) => !prev)}
                          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground"
                        >
                          <span>Notas do Mestre</span>
                          <span>{masterNotesOpen ? 'Ocultar' : 'Mostrar'}</span>
                        </button>
                        {masterNotesOpen && (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={masterNotesDraft}
                              onChange={(e) => void scheduleMasterNotesSave(e.target.value)}
                              placeholder="Observações do mestre..."
                              className="h-24 w-full resize-none rounded-xl border border-border/50 bg-input/70 px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-primary/60"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {masterNotesSaving ? 'Salvando...' : 'Edição automática com debounce'}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={openVitalsEditor}
                        className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition"
                      >
                        Editar vitais
                      </button>

                      <Link
                        href={`/sheet/${selectedChar.id}`}
                        className="block text-center rounded-lg border border-border/60 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition"
                      >
                        Ver ficha completa
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Event feed — categorized */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground">
                    Feed de Eventos
                  </h3>
                  <button
                    onClick={handleClearFeed}
                    className="rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
                    title="Limpar feed de eventos"
                  >
                    Limpar feed
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  <AnimatePresence mode="popLayout">
                    {events.map((event) => {
                      const style = EVENT_STYLES[event.category]
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -12, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 10 }}
                          className={`text-xs rounded-md px-2 py-1.5 flex items-start gap-2 ${style.bg}`}
                        >
                          <span className="mt-0.5 shrink-0">{event.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium ${style.color}`}>{event.message}</span>
                            <span className="block font-mono text-[9px] text-muted-foreground/50 mt-0.5">
                              {event.timestamp.toLocaleTimeString('pt-BR')}
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showVitalsEditor} onOpenChange={setShowVitalsEditor}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar vitais</DialogTitle>
            <DialogDescription>
              Ajuste os valores atuais e máximos da ficha selecionada.
            </DialogDescription>
          </DialogHeader>

          {vitalsDraft && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="hp">HP atual</Label>
                <Input id="hp" type="number" min={0} value={vitalsDraft.hp} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, hp: Number(e.target.value) } : prev)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hp_max">HP máximo</Label>
                <Input id="hp_max" type="number" min={0} value={vitalsDraft.hp_max} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, hp_max: Number(e.target.value) } : prev)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stress">Estresse atual</Label>
                <Input id="stress" type="number" min={0} value={vitalsDraft.stress} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, stress: Number(e.target.value) } : prev)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stress_max">Estresse máximo</Label>
                <Input id="stress_max" type="number" min={0} value={vitalsDraft.stress_max} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, stress_max: Number(e.target.value) } : prev)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="harmony">Harmonia atual</Label>
                <Input id="harmony" type="number" min={0} value={vitalsDraft.harmony} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, harmony: Number(e.target.value) } : prev)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="harmony_max">Harmonia máxima</Label>
                <Input id="harmony_max" type="number" min={0} value={vitalsDraft.harmony_max} onChange={(e) => setVitalsDraft((prev) => prev ? { ...prev, harmony_max: Number(e.target.value) } : prev)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <button onClick={() => setShowVitalsEditor(false)} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition">Cancelar</button>
            <button onClick={saveVitalsEditor} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition">Salvar vitais</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    )
  }

  function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0

    return (
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
          <span>{label}</span>
          <span className="font-mono">{value}/{max}</span>
        </div>
        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}, oklch(0.85 0.15 320))` }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    )
  }

  function QuickControl({
    label,
    value,
    max,
    color,
    icon,
    syncing,
    onIncrement,
    onDecrement,
  }: {
    label: string
    value: number
    max: number
    color: string
    icon: React.ReactNode
    syncing: boolean
    onIncrement: () => void
    onDecrement: () => void
  }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
    const isCritical = pct > 0 && pct <= 20
    const isWarning = pct > 20 && pct <= 45
    const atMin = value <= 0
    const atMax = max > 0 && value >= max
    const { floats, trigger } = useFloatingText()

    const handleIncrement = () => { if (atMax) return; trigger('+1', color); onIncrement() }
    const handleDecrement = () => { if (atMin) return; trigger('-1', '#ef4444'); onDecrement() }

    return (
      <div className={`space-y-1.5 rounded-xl border p-3 transition-all ${isCritical ? 'border-red-500/40 bg-red-500/10 shake shadow-[0_0_24px_rgba(239,68,68,0.12)]' : isWarning ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {icon}
            {label}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrement}
              disabled={atMin}
              aria-disabled={atMin}
              className="size-6 rounded-full bg-muted/40 flex items-center justify-center transition hover:bg-red-500/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-muted/40 disabled:hover:text-current"
            >
              <Minus className="size-3" />
            </button>
            <div className="relative">
              <span className="font-mono w-12 text-center font-semibold block">
                {value}/{max}
              </span>
              <FloatingTexts floats={floats} />
            </div>
            <button
              onClick={handleIncrement}
              disabled={atMax}
              aria-disabled={atMax}
              className="size-6 rounded-full bg-muted/40 flex items-center justify-center transition hover:bg-green-500/20 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-muted/40 disabled:hover:text-current"
            >
              <Plus className="size-3" />
            </button>
            {syncing && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden relative">
          <motion.div
            className="h-full rounded-full"
            style={{ background: isCritical ? 'linear-gradient(90deg, #ef4444, #fb7185)' : `linear-gradient(90deg, ${color}, oklch(0.85 0.15 320))` }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
          {isCritical && (
            <motion.div
              className="absolute inset-0 rounded-full bg-white/20"
              animate={{ opacity: [0.08, 0.28, 0.08] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </div>
      </div>
    )
  }
