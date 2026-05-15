'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, RotateCw, Dice1, Plus, Minus, Copy, Trash2, Eraser } from 'lucide-react'
import type { Character, Combatant } from '@/lib/types'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import {
  loadSessionState,
  saveSessionState,
  clearSessionLog,
  defaultSessionState,
  type SessionStateData,
  type NpcDraft,
} from '@/lib/supabase/mesa'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface SessionManagerProps {
  characters: Character[]
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1
}

const NPC_TYPE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  hostil:  { label: 'Hostil',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  aliado:  { label: 'Aliado',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  neutro:  { label: 'Neutro',  color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
}

export function SessionManager({ characters }: SessionManagerProps) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [logClearedAt, setLogClearedAt] = useState<string | null>(null)

  // ── Core state ───────────────────────────────────────────────────────────
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [round, setRound] = useState(1)
  const [inCombat, setInCombat] = useState(false)
  const [editLocked, setEditLocked] = useState(true)

  // ── NPC draft ─────────────────────────────────────────────────────────────
  const [npcDraft, setNpcDraft] = useState<NpcDraft>({
    name: '', initiative: 0, dt: 0, hp: 0, hp_max: 0, type: 'hostil', notes: '', conditions: [],
  })
  const [npcSearch, setNpcSearch] = useState('')
  const [npcSort, setNpcSort] = useState<'initiative' | 'name' | 'type'>('initiative')
  const [editingNpc, setEditingNpc] = useState<Combatant | null>(null)

  // ── Load session from DB on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { state, logClearedAt: lca } = await loadSessionState(supabase)
      if (cancelled) return

      setLogClearedAt(lca)

      // Merge persisted combatants with current character list
      const charMap = new Map(characters.map((c) => [c.id, c]))

      const merged: Combatant[] = state.combatants.map((saved) => {
        if (saved.characterId && charMap.has(saved.characterId)) {
          const char = charMap.get(saved.characterId)!
          return { ...saved, name: char.name, classe: char.classe, level: char.level, dt: char.dt, movement: char.movement }
        }
        return saved
      })

      // Add any characters not yet in the saved list
      const savedCharIds = new Set(state.combatants.map((c) => c.characterId).filter(Boolean))
      for (const char of characters) {
        if (!savedCharIds.has(char.id)) {
          merged.push({
            id: char.id,
            characterId: char.id,
            name: char.name,
            classe: char.classe,
            level: char.level,
            dt: char.dt,
            movement: char.movement,
            initiative: 0,
          })
        }
      }

      setCombatants(merged)
      setCurrentTurnIndex(state.currentTurnIndex)
      setRound(state.round)
      setInCombat(state.inCombat)
      setEditLocked(state.editLocked)
      setNpcDraft(state.npcDraft)
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Keep character data in sync when characters prop changes ──────────────
  useEffect(() => {
    if (!loaded) return
    setCombatants((prev) => {
      const charMap = new Map(characters.map((c) => [c.id, c]))
      const existingCharIds = new Set(prev.map((c) => c.characterId).filter(Boolean))

      const updated = prev.map((combatant) => {
        if (combatant.characterId && charMap.has(combatant.characterId)) {
          const char = charMap.get(combatant.characterId)!
          return { ...combatant, name: char.name, classe: char.classe, level: char.level, dt: char.dt, movement: char.movement }
        }
        return combatant
      })

      const newChars: Combatant[] = characters
        .filter((c) => !existingCharIds.has(c.id))
        .map((char) => ({
          id: char.id,
          characterId: char.id,
          name: char.name,
          classe: char.classe,
          level: char.level,
          dt: char.dt,
          movement: char.movement,
          initiative: 0,
        }))

      return [...updated, ...newChars]
    })
  }, [characters, loaded])

  // ── Debounced save to DB ───────────────────────────────────────────────────
  const scheduleSave = useCallback(
    (nextState: Partial<SessionStateData>) => {
      if (!loaded) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        const full: SessionStateData = {
          inCombat,
          round,
          currentTurnIndex,
          editLocked,
          combatants,
          npcDraft,
          ...nextState,
        }
        try { await saveSessionState(supabase, full) } catch { /* silencioso */ }
      }, 600)
    },
    [loaded, inCombat, round, currentTurnIndex, editLocked, combatants, npcDraft, supabase]
  )

  // Save whenever important state changes
  useEffect(() => {
    if (!loaded) return
    scheduleSave({ combatants, round, inCombat, currentTurnIndex, editLocked })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatants, round, inCombat, currentTurnIndex, editLocked, loaded])

  // ── Derived ───────────────────────────────────────────────────────────────
  const sortedByInitiative = useMemo(
    () => [...combatants].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name)),
    [combatants]
  )

  useEffect(() => {
    if (currentTurnIndex >= sortedByInitiative.length) {
      setCurrentTurnIndex(Math.max(0, sortedByInitiative.length - 1))
    }
  }, [sortedByInitiative.length, currentTurnIndex])

  const currentCharacter = inCombat && sortedByInitiative.length > 0 ? sortedByInitiative[currentTurnIndex] : null

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleInitiativeChange = (combatantId: string, value: number) => {
    if (inCombat && editLocked) return
    setCombatants((prev) =>
      prev.map((c) => c.id === combatantId ? { ...c, initiative: Math.max(0, value) } : c)
    )
  }

  const rollInitiative = (combatantId: string) => {
    setCombatants((prev) =>
      prev.map((c) =>
        c.id === combatantId ? { ...c, initiative: rollD20() + Math.max(0, c.dt ?? 0) } : c
      )
    )
  }

  const rollAll = () => {
    setCombatants((prev) =>
      prev.map((c) => ({ ...c, initiative: rollD20() + Math.max(0, c.dt ?? 0) }))
    )
  }

  const startCombat = () => {
    if (sortedByInitiative.length === 0) return
    const allZero = sortedByInitiative.every((c) => c.initiative === 0)
    if (allZero) rollAll()
    setInCombat(true)
    setRound(1)
    setCurrentTurnIndex(0)
    setEditLocked(true)
  }

  const nextTurn = () => {
    if (!inCombat || sortedByInitiative.length === 0) return
    const nextIndex = (currentTurnIndex + 1) % sortedByInitiative.length
    if (nextIndex === 0) setRound((r) => r + 1)
    setCurrentTurnIndex(nextIndex)
  }

  const previousTurn = () => {
    if (!inCombat || sortedByInitiative.length === 0) return
    if (currentTurnIndex === 0) setRound((r) => Math.max(1, r - 1))
    setCurrentTurnIndex((i) => (i === 0 ? sortedByInitiative.length - 1 : i - 1))
  }

  const endCombat = () => {
    setInCombat(false)
    setRound(1)
    setCurrentTurnIndex(0)
    setEditLocked(true)
  }

  const addNpc = () => {
    if (!npcDraft.name.trim()) return
    setCombatants((prev) => [
      ...prev,
      {
        id: `npc-${crypto.randomUUID()}`,
        name: npcDraft.name.trim(),
        classe: `NPC • ${NPC_TYPE_STYLES[npcDraft.type].label}`,
        level: 0,
        dt: npcDraft.dt,
        initiative: npcDraft.initiative,
        isNpc: true,
        isTemporary: true,
        npcType: npcDraft.type,
        hp: npcDraft.hp,
        hp_max: npcDraft.hp_max,
        notes: npcDraft.notes,
        conditions: npcDraft.conditions,
      } as Combatant,
    ])
    setNpcDraft({
      name: '', initiative: 0, dt: 0, hp: 0, hp_max: 0,
      type: 'hostil', notes: '', conditions: [],
    })
    scheduleSave({ npcDraft: defaultSessionState.npcDraft })
  }

  const duplicateNpc = (combatant: Combatant) => {
    setCombatants((prev) => [
      ...prev,
      {
        ...combatant,
        id: `npc-${crypto.randomUUID()}`,
        name: `${combatant.name} (cópia)`,
        isTemporary: true,
      },
    ])
  }

  const removeCombatant = (combatantId: string) => {
    setCombatants((prev) => prev.filter((c) => c.id !== combatantId))
  }

  const npcCombatants = useMemo(
    () => combatants.filter((c) => c.isNpc),
    [combatants]
  )

  const sortedNpcCombatants = useMemo(() => {
    const search = npcSearch.trim().toLowerCase()
    const filtered = npcCombatants.filter((combatant) =>
      combatant.name.toLowerCase().includes(search)
    )

    return [...filtered].sort((a, b) => {
      if (npcSort === 'name') return a.name.localeCompare(b.name)
      if (npcSort === 'type') return (a.npcType || '').localeCompare(b.npcType || '') || a.name.localeCompare(b.name)
      return (b.initiative - a.initiative) || a.name.localeCompare(b.name)
    })
  }, [npcCombatants, npcSearch, npcSort])

  const openNpcEditor = useCallback((combatant: Combatant) => {
    setEditingNpc(combatant)
  }, [])

  const closeNpcEditor = useCallback(() => {
    setEditingNpc(null)
  }, [])

  const saveNpcEditor = useCallback(async () => {
    if (!editingNpc) return
    setCombatants((prev) => prev.map((c) => (c.id === editingNpc.id ? editingNpc : c)))
    closeNpcEditor()
  }, [closeNpcEditor, editingNpc])

  const updateEditingNpc = useCallback((field: keyof Combatant, value: unknown) => {
    setEditingNpc((prev) => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const clearTemporaryNpcs = useCallback(() => {
    if (!window.confirm('Remover todos os NPCs temporários?')) return
    setCombatants((prev) => prev.filter((combatant) => !combatant.isTemporary))
  }, [])

  const rerollNpcInitiative = useCallback(() => {
    setCombatants((prev) => prev.map((combatant) =>
      combatant.isNpc
        ? { ...combatant, initiative: rollD20() + Math.max(0, combatant.dt ?? 0) }
        : combatant
    ))
  }, [])

  const adjustNpcHp = useCallback((combatantId: string, delta: number) => {
    setCombatants((prev) => prev.map((combatant) =>
      combatant.id === combatantId
        ? { ...combatant, hp: Math.max(0, (combatant.hp ?? 0) + delta) }
        : combatant
    ))
  }, [])

  const adjustNpcInitiative = useCallback((combatantId: string, delta: number) => {
    setCombatants((prev) => prev.map((combatant) =>
      combatant.id === combatantId
        ? { ...combatant, initiative: Math.max(0, combatant.initiative + delta) }
        : combatant
    ))
  }, [])

  const handleClearLog = async () => {
    try {
      await clearSessionLog(supabase)
      setLogClearedAt(new Date().toISOString())
    } catch { /* silencioso */ }
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-2xl glass animate-pulse" />
        <div className="h-64 rounded-2xl glass animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Combat control ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-strong rounded-2xl p-6 ${inCombat ? 'ring-2 ring-primary/40' : ''}`}
      >
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Estado</p>
            <p className="font-serif text-xl font-bold text-gradient">
              {inCombat ? '⚔️ Combate' : '🛡️ Exploração'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Rodada</p>
            <p className="font-serif text-xl font-bold text-primary">{round}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Turno</p>
            <p className="font-serif text-lg font-bold">
              {inCombat ? `${currentTurnIndex + 1}/${sortedByInitiative.length}` : '—'}
            </p>
          </div>
        </div>

        {inCombat && currentCharacter && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-lg bg-primary/15 border border-primary/30 p-4 mb-6 text-center"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Turno Atual</p>
            <p className="font-serif text-2xl text-primary">{currentCharacter.name}</p>
          </motion.div>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={rollAll}
            className="rounded-lg bg-secondary/15 text-secondary border border-secondary/20 px-4 py-2 text-sm font-semibold hover:bg-secondary/25 transition"
          >
            Rolar tudo
          </button>
          <button
            onClick={() => setEditLocked((prev) => !prev)}
            className="rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-sm hover:bg-muted/40 transition"
          >
            {editLocked ? '🔒 Edição travada' : '🔓 Edição livre'}
          </button>
          <button
            onClick={handleClearLog}
            title="Limpar log de dados (não apaga rolagens do banco)"
            className="ml-auto rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition flex items-center gap-2"
          >
            <Eraser className="size-3.5" />
            Limpar log
          </button>
        </div>

        {logClearedAt && (
          <p className="text-[10px] text-muted-foreground mb-3">
            Log limpo em {new Date(logClearedAt).toLocaleTimeString('pt-BR')} — rolagens anteriores ocultadas no feed.
          </p>
        )}

        <div className="flex gap-2">
          {!inCombat ? (
            <button
              onClick={startCombat}
              className="flex-1 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold py-2 hover:opacity-90 transition"
            >
              Iniciar Combate
            </button>
          ) : (
            <>
              <button
                onClick={previousTurn}
                className="rounded-lg border border-border/40 bg-muted/30 p-2 hover:bg-muted/50 transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={nextTurn}
                className="flex-1 rounded-lg bg-primary/20 text-primary font-semibold py-2 hover:bg-primary/30 transition flex items-center justify-center gap-2"
              >
                Próximo Turno
                <ChevronRight className="size-4" />
              </button>
              <button
                onClick={endCombat}
                title="Encerrar combate"
                className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-2 hover:bg-destructive/20 transition"
              >
                <RotateCw className="size-4" />
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Initiative list ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="font-serif text-lg text-gradient">Iniciativas</h3>
          <div className="text-xs text-muted-foreground">
            {editLocked ? 'Edição travada em combate' : 'Edição liberada'}
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sortedByInitiative.map((combatant) => {
              const ext = combatant as Combatant & { npcType?: string; hp?: number }
              const typeStyle = ext.npcType ? NPC_TYPE_STYLES[ext.npcType] : null
              const isActive = inCombat && currentCharacter?.id === combatant.id

              return (
                <motion.div
                  key={combatant.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                    isActive
                      ? 'bg-primary/20 border-primary/40'
                      : typeStyle
                      ? `${typeStyle.bg}`
                      : 'bg-card/40 border-border/40'
                  }`}
                >
                  <div className="size-9 rounded-md bg-gradient-to-br from-secondary to-primary flex items-center justify-center font-serif font-bold text-xs ring-1 ring-white/10">
                    {combatant.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-serif text-sm font-semibold truncate">{combatant.name}</p>
                      {combatant.isNpc && typeStyle && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${typeStyle.color} ${typeStyle.bg}`}>
                          {typeStyle.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {combatant.level ? `Nv ${combatant.level} • ` : ''}{combatant.classe ?? 'Combatente'}
                      {ext.hp ? ` • HP ${ext.hp}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => rollInitiative(combatant.id)}
                      type="button"
                      title="Rolar iniciativa"
                      className="rounded px-2 py-1 text-xs bg-muted/30 hover:bg-muted/50 transition"
                    >
                      <Dice1 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleInitiativeChange(combatant.id, combatant.initiative - 1)}
                      className="rounded px-2 py-1 text-xs bg-muted/30 hover:bg-muted/50 transition"
                      disabled={inCombat && editLocked}
                    >
                      <Minus className="size-3" />
                    </button>
                    <input
                      type="number"
                      value={combatant.initiative}
                      onChange={(e) => handleInitiativeChange(combatant.id, Number(e.target.value))}
                      disabled={inCombat && editLocked}
                      className="w-14 rounded-md bg-input/60 border border-border/50 px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-60"
                    />
                    <button
                      onClick={() => handleInitiativeChange(combatant.id, combatant.initiative + 1)}
                      className="rounded px-2 py-1 text-xs bg-muted/30 hover:bg-muted/50 transition"
                      disabled={inCombat && editLocked}
                    >
                      <Plus className="size-3" />
                    </button>
                    {combatant.isTemporary && (
                      <>
                        <button
                          onClick={() => duplicateNpc(combatant)}
                          title="Duplicar"
                          className="rounded px-2 py-1 text-xs bg-muted/30 hover:bg-muted/50 transition"
                        >
                          <Copy className="size-3" />
                        </button>
                        <button
                          onClick={() => removeCombatant(combatant.id)}
                          title="Remover"
                          className="rounded px-2 py-1 text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* ── NPC Module ── */}
        <div className="mt-6 rounded-2xl border border-border/30 bg-card/60 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold">Gerenciar NPCs</h4>
              <p className="text-xs text-muted-foreground">NPCs temporários podem ser adicionados, editados e descartados com rapidez.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={rerollNpcInitiative}
                type="button"
                className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
              >
                Reaplicar iniciativa
              </button>
              <button
                onClick={clearTemporaryNpcs}
                type="button"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition"
              >
                Remover temporários
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex-1 min-w-0">
              <label className="sr-only" htmlFor="npc-search">Buscar NPC</label>
              <input
                id="npc-search"
                type="text"
                value={npcSearch}
                onChange={(e) => setNpcSearch(e.target.value)}
                placeholder="Buscar por nome"
                className="w-full rounded-xl border border-border/40 bg-input/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ordenar</span>
              {(['initiative', 'name', 'type'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setNpcSort(option)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                    npcSort === option
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {option === 'initiative' ? 'Iniciativa' : option === 'name' ? 'Nome' : 'Tipo'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <input
              type="text"
              value={npcDraft.name}
              onChange={(e) => setNpcDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addNpc()}
              placeholder="Nome"
              className="rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                value={npcDraft.initiative || ''}
                onChange={(e) => setNpcDraft((d) => ({ ...d, initiative: Math.max(0, Number(e.target.value)) }))}
                placeholder="Iniciativa"
                className="rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <input
                type="number"
                value={npcDraft.dt || ''}
                onChange={(e) => setNpcDraft((d) => ({ ...d, dt: Math.max(0, Number(e.target.value)) }))}
                placeholder="Bônus DT"
                className="rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                value={npcDraft.hp || ''}
                onChange={(e) => setNpcDraft((d) => ({ ...d, hp: Math.max(0, Number(e.target.value)) }))}
                placeholder="HP atual"
                className="rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <input
                type="number"
                value={npcDraft.hp_max || ''}
                onChange={(e) => setNpcDraft((d) => ({ ...d, hp_max: Math.max(0, Number(e.target.value)) }))}
                placeholder="HP máximo"
                className="rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {(['hostil', 'aliado', 'neutro'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNpcDraft((d) => ({ ...d, type: t }))}
                  type="button"
                  className={`rounded-full px-3 py-1 text-[11px] font-medium border transition ${
                    npcDraft.type === t
                      ? `${NPC_TYPE_STYLES[t].bg} ${NPC_TYPE_STYLES[t].color}`
                      : 'border-border/40 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {NPC_TYPE_STYLES[t].label}
                </button>
              ))}
            </div>
            <button
              onClick={addNpc}
              disabled={!npcDraft.name.trim()}
              className="rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
            >
              Adicionar NPC rápido
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {sortedNpcCombatants.length === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Nenhum NPC temporário adicionado.
              </div>
            ) : (
              sortedNpcCombatants.map((combatant) => {
                const typeStyle = combatant.npcType ? NPC_TYPE_STYLES[combatant.npcType] : null
                const hpPct = combatant.hp_max ? (combatant.hp ?? 0) / combatant.hp_max : 0
                const isLowHp = hpPct > 0 && hpPct <= 0.25
                const isCriticalHp = hpPct > 0 && hpPct <= 0.1

                return (
                  <div key={combatant.id} className={`rounded-2xl border p-4 transition-all ${
                    isCriticalHp
                      ? 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/20'
                      : isLowHp
                      ? 'border-orange-500/40 bg-orange-500/5'
                      : 'border-border/40 bg-card/50'
                  }`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="font-semibold text-sm truncate">{combatant.name}</p>
                          {typeStyle && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${typeStyle.color} ${typeStyle.bg}`}>
                              {typeStyle.label}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">HP</span>
                            <span className="font-mono font-semibold">{combatant.hp ?? 0}/{combatant.hp_max ?? 0}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                background: isCriticalHp
                                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                  : isLowHp
                                  ? 'linear-gradient(90deg, #f97316, #ea580c)'
                                  : 'linear-gradient(90deg, var(--hp), oklch(0.85 0.15 320))',
                                width: `${Math.min(100, hpPct * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Iniciativa {combatant.initiative} • DT {combatant.dt ?? 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustNpcHp(combatant.id, -5)}
                            type="button"
                            className="size-8 rounded-lg border border-border/40 bg-muted/30 hover:bg-red-500/20 hover:text-red-400 transition flex items-center justify-center"
                            title="Diminuir 5 HP"
                          >
                            <Minus className="size-4" />
                          </button>
                          <button
                            onClick={() => adjustNpcHp(combatant.id, -1)}
                            type="button"
                            className="size-8 rounded-lg border border-border/40 bg-muted/30 hover:bg-red-500/20 hover:text-red-400 transition flex items-center justify-center"
                            title="Diminuir 1 HP"
                          >
                            <Minus className="size-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustNpcHp(combatant.id, 1)}
                            type="button"
                            className="size-8 rounded-lg border border-border/40 bg-muted/30 hover:bg-green-500/20 hover:text-green-400 transition flex items-center justify-center"
                            title="Aumentar 1 HP"
                          >
                            <Plus className="size-3" />
                          </button>
                          <button
                            onClick={() => adjustNpcHp(combatant.id, 5)}
                            type="button"
                            className="size-8 rounded-lg border border-border/40 bg-muted/30 hover:bg-green-500/20 hover:text-green-400 transition flex items-center justify-center"
                            title="Aumentar 5 HP"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => adjustNpcInitiative(combatant.id, 1)}
                        type="button"
                        className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/40 transition"
                      >+ Init</button>
                      <button
                        onClick={() => adjustNpcInitiative(combatant.id, -1)}
                        type="button"
                        className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/40 transition"
                      >- Init</button>
                      <button
                        onClick={() => rollInitiative(combatant.id)}
                        type="button"
                        className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/40 transition"
                      >Rolar iniciativa</button>
                      <button
                        onClick={() => openNpcEditor(combatant)}
                        type="button"
                        className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/40 transition"
                      >Editar</button>
                      <button
                        onClick={() => duplicateNpc(combatant)}
                        type="button"
                        className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/40 transition"
                      >Duplicar</button>
                      <button
                        onClick={() => removeCombatant(combatant.id)}
                        type="button"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20 transition"
                      >Remover</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <Dialog open={editingNpc !== null} onOpenChange={(open) => { if (!open) closeNpcEditor() }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar NPC</DialogTitle>
              <DialogDescription>Altere os dados do NPC e salve para atualizar imediatamente.</DialogDescription>
            </DialogHeader>
            {editingNpc ? (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editingNpc.name}
                    onChange={(e) => updateEditingNpc('name', e.target.value)}
                    placeholder="Nome"
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <select
                    value={editingNpc.npcType ?? 'hostil'}
                    onChange={(e) => updateEditingNpc('npcType', e.target.value)}
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    <option value="hostil">Hostil</option>
                    <option value="aliado">Aliado</option>
                    <option value="neutro">Neutro</option>
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    value={editingNpc.initiative}
                    onChange={(e) => updateEditingNpc('initiative', Math.max(0, Number(e.target.value)))}
                    placeholder="Iniciativa"
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <input
                    type="number"
                    value={editingNpc.dt ?? 0}
                    onChange={(e) => updateEditingNpc('dt', Math.max(0, Number(e.target.value)))}
                    placeholder="Bônus DT"
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    value={editingNpc.hp ?? 0}
                    onChange={(e) => updateEditingNpc('hp', Math.max(0, Number(e.target.value)))}
                    placeholder="HP atual"
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <input
                    type="number"
                    value={editingNpc.hp_max ?? 0}
                    onChange={(e) => updateEditingNpc('hp_max', Math.max(0, Number(e.target.value)))}
                    placeholder="HP máximo"
                    className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
                <textarea
                  value={editingNpc.notes ?? ''}
                  onChange={(e) => updateEditingNpc('notes', e.target.value)}
                  placeholder="Notas"
                  className="min-h-[96px] w-full resize-none rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <input
                  type="text"
                  value={(editingNpc.conditions ?? []).join(', ')}
                  onChange={(e) => updateEditingNpc('conditions', e.target.value.split(',').map((cond) => cond.trim()).filter(Boolean))}
                  placeholder="Condições (sep. por vírgula)"
                  className="w-full rounded-lg border border-border/40 bg-input/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>
            ) : null}
            <DialogFooter className="mt-4">
              <button
                type="button"
                onClick={closeNpcEditor}
                className="rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNpcEditor}
                className="rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Salvar NPC
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}
