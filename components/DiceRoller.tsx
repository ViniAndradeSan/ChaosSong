'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseDice, getDiceRollOutcome, type DiceResult } from '@/lib/dice'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { insertDiceRoll } from '@/lib/supabase/mesa'
import { usePlayerName } from '@/lib/usePlayerName'
import { setDiceRollerControl } from '@/hooks/use-dice-roller'
import type { DiceRoll } from '@/lib/types'

const PRESETS = ['1d20', '1d20+5', '2d6', '4d6kh3', '2d20kh1', '3d10kl2', '1d100']

const BURST_PARTICLES = [
  { angle: 0,   dist: 60, size: 5 },
  { angle: 40,  dist: 72, size: 4 },
  { angle: 80,  dist: 55, size: 6 },
  { angle: 120, dist: 68, size: 4 },
  { angle: 160, dist: 62, size: 5 },
  { angle: 200, dist: 70, size: 3 },
  { angle: 240, dist: 58, size: 6 },
  { angle: 280, dist: 75, size: 4 },
  { angle: 320, dist: 63, size: 5 },
  { angle: 350, dist: 52, size: 3 },
]

type RollPhase = 'idle' | 'charging' | 'rolling' | 'result'
type RollOutcome = 'normal' | 'critical' | 'failure'

interface DiceRollerProps {
  characterId?: string
  actorName?: string
  characterName?: string
}

function playRitualSound(outcome: RollOutcome) {
  try {
    const ctx = new AudioContext()
    if (outcome === 'critical') {
      const freqs = [440, 550, 660, 880]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06)
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.06 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.06)
        osc.stop(ctx.currentTime + i * 0.06 + 0.4)
      })
    } else if (outcome === 'failure') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 220
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.35)
      osc.type = 'sawtooth'
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 660
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.13, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.22)
    }
  } catch { /* AudioContext unavailable */ }
}

function useScramble(target: number, active: boolean) {
  const [display, setDisplay] = useState('??')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) { setDisplay(target.toString()); return }
    let tick = 0
    intervalRef.current = setInterval(() => {
      tick++
      setDisplay(Math.floor(Math.random() * 100).toString().padStart(2, '0'))
      if (tick > 14) { clearInterval(intervalRef.current!); setDisplay(target.toString()) }
    }, 55)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active, target])

  return display
}

function RollResultDisplay({ roll, index }: { roll: DiceRoll; index: number }) {
  const isCritical = roll.roll_type === 'critical'
  const isFailure  = roll.roll_type === 'failure'
  const originLabel: Record<string, string> = {
    attack: '⚔️ Ataque', damage: '💥 Dano', sheet: '📜 Ficha', player: '🎲 Aberta', master: '🎭 Mestre',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -14, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28, delay: index * 0.03 }}
      className={`relative rounded-xl border p-3 overflow-hidden ${
        isCritical ? 'border-yellow-500/50 bg-yellow-500/[0.06]'
          : isFailure ? 'border-red-600/50 bg-red-600/[0.06]'
          : 'border-border/50 bg-card/50'
      }`}
    >
      {isCritical && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{ background: 'linear-gradient(90deg,transparent,oklch(0.8 0.3 80/0.10),transparent)' }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{roll.expression}</span>
            <span className="text-[10px] text-muted-foreground/60">{originLabel[roll.origin] ?? roll.origin}</span>
            {roll.actor_name && <span className="text-[10px] text-muted-foreground/50 truncate">{roll.actor_name}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {roll.parts.map((part, j) => (
              <span key={j}>
                {j > 0 && <span className="text-[10px] text-muted-foreground/50 mx-0.5">{part.sign}</span>}
                {part.type === 'dice' ? part.results?.map((r, k) => {
                  const isMax  = part.sides !== undefined && r === part.sides
                  const isMin  = r === 1
                  const isKept = part.keptResults ? part.keptResults.includes(r) : true
                  return (
                    <span key={k} className={`font-mono text-[11px] px-1.5 py-0.5 rounded border transition ${
                      !isKept ? 'bg-muted/20 text-muted-foreground/40 border-border/20 line-through'
                        : isMax ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40 font-bold'
                        : isMin ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-primary/10 text-primary border-primary/25'
                    }`}>{r}</span>
                  )
                }) : (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground">
                    {part.modifier && part.modifier > 0 ? `+${part.modifier}` : part.modifier}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={`font-serif font-bold leading-none ${
            isCritical ? 'text-3xl text-yellow-400 drop-shadow-[0_0_12px_oklch(0.8_0.3_80/0.7)]'
              : isFailure ? 'text-3xl text-red-500 drop-shadow-[0_0_12px_oklch(0.5_0.3_20/0.7)]'
              : 'text-2xl text-gradient'
          }`}>{roll.total}</span>
          {(isCritical || isFailure) && (
            <span className={`text-[9px] uppercase tracking-widest font-bold mt-1 ${isCritical ? 'text-yellow-400' : 'text-red-400'}`}>
              {isCritical ? '✦ CRÍTICO' : '✕ FALHA'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CriticalOverlay({ outcome, triggerKey }: { outcome: RollOutcome; triggerKey: number }) {
  if (triggerKey === 0 || outcome === 'normal') return null
  const isCrit = outcome === 'critical'

  return (
    <AnimatePresence>
      <motion.div key={triggerKey} className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
        <motion.div
          className="absolute inset-0"
          style={{ background: isCrit
            ? 'radial-gradient(ellipse at center,oklch(0.8 0.3 80/0.12) 0%,transparent 70%)'
            : 'radial-gradient(ellipse at center,oklch(0.4 0.35 20/0.15) 0%,transparent 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, times: [0, 0.15, 1] }}
        />
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 20 }}
          animate={{ scale: [0.3, 1.12, 1], opacity: [0, 1, 1, 0], y: [20, 0, -8, -50] }}
          transition={{ duration: 1.5, times: [0, 0.2, 0.55, 1] }}
          className="select-none text-center"
        >
          <div className={`font-serif font-bold tracking-widest uppercase ${
            isCrit ? 'text-5xl text-yellow-400 drop-shadow-[0_0_40px_oklch(0.8_0.3_80/0.9)]'
              : 'text-4xl text-red-500 drop-shadow-[0_0_40px_oklch(0.45_0.35_20/0.9)]'
          }`}>
            {isCrit ? '✦ CRÍTICO' : '✕ COLAPSO'}
          </div>
        </motion.div>
        {isCrit && BURST_PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180
          return (
            <motion.div key={i} className="absolute rounded-full"
              style={{ width: p.size, height: p.size, background: 'oklch(0.85 0.3 80)',
                boxShadow: '0 0 10px oklch(0.8 0.3 80)', left: '50%', top: '50%',
                marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(rad) * p.dist * 3, y: Math.sin(rad) * p.dist * 3, opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.9, delay: i * 0.02, ease: 'easeOut' }}
            />
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

function DiceGlyph({ phase, outcome, total }: { phase: RollPhase; outcome: RollOutcome; total: number }) {
  const scrambled = useScramble(total, phase === 'rolling')
  const controls  = useAnimation()

  useEffect(() => {
    if (phase === 'charging') {
      void controls.start({ scale: [1, 1.07, 1.04], rotate: [0, -3, 3, 0], transition: { duration: 0.4, repeat: Infinity } })
    } else if (phase === 'rolling') {
      void controls.start({ rotate: [0, 360], scale: [1, 0.85, 1.1, 1], transition: { duration: 0.6 } })
    } else {
      controls.stop(); controls.set({ scale: 1, rotate: 0 })
    }
  }, [phase, controls])

  const glow = outcome === 'critical'
    ? '0 0 28px oklch(0.8 0.3 80/0.8),0 0 56px oklch(0.7 0.25 80/0.4)'
    : outcome === 'failure'
    ? '0 0 28px oklch(0.45 0.35 20/0.8),0 0 56px oklch(0.4 0.3 20/0.4)'
    : (phase === 'rolling' || phase === 'charging')
    ? '0 0 20px oklch(0.65 0.27 320/0.6)'
    : '0 0 10px oklch(0.55 0.2 300/0.25)'

  const border = outcome === 'critical' && phase === 'result' ? 'border-yellow-500/70'
    : outcome === 'failure' && phase === 'result' ? 'border-red-600/70'
    : phase === 'idle' ? 'border-border/40' : 'border-primary/60'

  const bg = outcome === 'critical' && phase === 'result' ? 'bg-yellow-500/8'
    : outcome === 'failure' && phase === 'result' ? 'bg-red-600/8' : 'bg-card/50'

  return (
    <motion.div animate={controls} className="relative flex items-center justify-center shrink-0">
      {(phase === 'rolling' || phase === 'charging') && (
        <motion.div className="absolute inset-0 rounded-2xl border border-primary/40"
          animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 0.8, repeat: Infinity }} />
      )}
      <div className={`relative flex flex-col items-center justify-center rounded-2xl border-2 ${border} ${bg} transition-all`}
        style={{ width: 88, height: 88, boxShadow: glow }}>
        {/* D20 wireframe */}
        <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
          <polygon points="20,2 38,15 31,36 9,36 2,15" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-primary" />
          <line x1="20" y1="2" x2="9" y2="36" stroke="currentColor" strokeWidth="0.4" className="text-primary" />
          <line x1="20" y1="2" x2="31" y2="36" stroke="currentColor" strokeWidth="0.4" className="text-primary" />
          <line x1="2"  y1="15" x2="38" y2="15" stroke="currentColor" strokeWidth="0.4" className="text-primary" />
        </svg>
        <span className={`font-serif font-bold leading-none select-none transition-all ${
          phase === 'result'
            ? outcome === 'critical' ? 'text-3xl text-yellow-400'
            : outcome === 'failure'  ? 'text-3xl text-red-400'
            : 'text-3xl text-gradient'
            : 'text-2xl text-muted-foreground/60'
        }`}>
          {phase === 'idle' ? '?' : phase === 'charging' ? '…' : scrambled}
        </span>
        {phase === 'result' && outcome !== 'normal' && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className={`text-[8px] uppercase tracking-widest font-bold mt-1 ${outcome === 'critical' ? 'text-yellow-400' : 'text-red-400'}`}>
            {outcome === 'critical' ? 'crítico' : 'falha'}
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

export function DiceRoller({ characterId, actorName, characterName }: DiceRollerProps) {
  const [open,       setOpen]       = useState(false)
  const [expression, setExpression] = useState('1d20')
  const [history,    setHistory]    = useState<DiceRoll[]>([])
  const [phase,      setPhase]      = useState<RollPhase>('idle')
  const [outcome,    setOutcome]    = useState<RollOutcome>('normal')
  const [lastTotal,  setLastTotal]  = useState(0)
  const [criticalKey, setCriticalKey] = useState(0)
  const supabase = useMemo(() => getSupabaseClient(), [])
  const { playerName } = usePlayerName()

  // Resolve the display name: prop takes priority, then stored player name, then fallback
  const resolvedActorName = actorName ?? playerName ?? 'Jogador'

  // Register global control for macro access
  useEffect(() => {
    const openWithExpression = (expr: string) => {
      setExpression(expr)
      setOpen(true)
    }
    setDiceRollerControl({ openWithExpression })
  }, [])

  const rollExpression = useCallback(async (expr: string) => {
    if (phase === 'rolling' || phase === 'charging') return
    setPhase('charging')
    setOutcome('normal')
    await new Promise<void>((r) => setTimeout(r, 260))

    const result = parseDice(expr)
    if (!result) { setPhase('idle'); toast.error('Expressão de dados inválida'); return }

    setPhase('rolling')
    const rollType = getDiceRollOutcome(result)
    await new Promise<void>((r) => setTimeout(r, 500))

    setPhase('result')
    setOutcome(rollType)
    setLastTotal(result.total)
    if (rollType !== 'normal') setCriticalKey((k) => k + 1)
    playRitualSound(rollType)

    const payload: DiceRoll = {
      id: crypto.randomUUID(),
      actor_name: resolvedActorName,
      character_id: characterId,
      expression: result.expression,
      total: result.total,
      parts: result.parts,
      roll_type: rollType,
      origin: characterId ? 'sheet' : 'player',
      created_at: new Date().toISOString(),
    }

    setHistory((prev) => [payload, ...prev.slice(0, 49)])

    try {
      await insertDiceRoll(supabase, {
        actor_name: payload.actor_name, character_id: payload.character_id,
        expression: payload.expression, total: payload.total,
        parts: payload.parts, roll_type: payload.roll_type, origin: payload.origin,
      })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      toast.error(`Erro ao enviar rolagem: ${msg}`)
    }

    setTimeout(() => setPhase('idle'), 3200)
  }, [phase, resolvedActorName, characterId, supabase])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const handleClearHistory = useCallback(() => {
    if (history.length === 0) {
      toast('Nenhuma rolagem para limpar')
      return
    }

    if (!window.confirm('Deseja limpar o histórico de rolagens?')) return
    clearHistory()
    toast.success('Histórico limpo')
  }, [clearHistory, history.length])

  const roll = useCallback(() => void rollExpression(expression), [rollExpression, expression])

  const handlePreset = useCallback((preset: string) => {
    setExpression(preset); void rollExpression(preset)
  }, [rollExpression])

  const isRolling = phase === 'rolling' || phase === 'charging'

  return (
    <>
      <CriticalOverlay outcome={outcome} triggerKey={criticalKey} />

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
        aria-label="Abrir rolador de dados" type="button"
        className="fixed bottom-6 right-4 sm:right-6 z-50 size-14 rounded-full bg-gradient-to-br from-primary via-secondary to-accent text-primary-foreground shadow-[0_0_30px_oklch(0.65_0.27_320/0.5)] flex items-center justify-center pointer-events-auto"
      >
        <motion.span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/25"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
        <svg viewBox="0 0 24 24" className="size-6 relative z-10 fill-none stroke-current" strokeWidth="1.5">
          <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
          <line x1="12" y1="2"  x2="12" y2="14" />
          <line x1="2"  y1="8"  x2="12" y2="14" />
          <line x1="22" y1="8"  x2="12" y2="14" />
          <line x1="2"  y1="16" x2="12" y2="14" />
          <line x1="22" y1="16" x2="12" y2="14" />
        </svg>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 glass-strong rounded-2xl p-4 sm:p-5 w-auto sm:w-[360px] pointer-events-auto border border-border/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="size-4 text-primary fill-none stroke-current" strokeWidth="1.5">
                  <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                  <line x1="12" y1="2" x2="12" y2="14" />
                </svg>
                <span className="font-serif text-lg tracking-wide">Dados do Caos</span>
              </div>
              <button onClick={() => setOpen(false)} type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 transition">
                <X className="size-4" />
              </button>
            </div>

            {/* Glyph + input */}
            <div className="flex items-center gap-4 mb-5">
              <DiceGlyph phase={phase} outcome={outcome} total={lastTotal} />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex gap-2 min-w-0">
                  <input
                    type="text" value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && roll()}
                    placeholder="1d20+5" disabled={isRolling}
                    className="flex-1 min-w-0 font-mono text-sm rounded-xl bg-input/60 border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
                  />
                  <motion.button onClick={roll} disabled={isRolling}
                    whileTap={isRolling ? {} : { scale: 0.92 }} type="button"
                    className={`shrink-0 rounded-xl px-4 py-2 font-semibold text-sm transition whitespace-nowrap ${
                      isRolling ? 'bg-primary/30 text-primary/50 cursor-not-allowed'
                        : 'bg-gradient-to-br from-primary to-secondary text-primary-foreground hover:opacity-90 shadow-[0_0_16px_oklch(0.65_0.27_320/0.4)]'
                    }`}>
                    {phase === 'charging' ? '…' : phase === 'rolling' ? '⟳' : 'Rolar'}
                  </motion.button>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  {characterName
                    ? `✦ ${characterName}`
                    : resolvedActorName !== 'Jogador'
                    ? `✦ ${resolvedActorName} · rolagem aberta`
                    : 'Rolagem aberta — todos recebem o resultado'}
                </p>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PRESETS.map((preset) => (
                <button key={preset} onClick={() => handlePreset(preset)}
                  disabled={isRolling} type="button"
                  className={`font-mono text-[11px] rounded-full px-2.5 py-1 border transition ${
                    expression === preset
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  } disabled:opacity-40`}>
                  {preset}
                </button>
              ))}
            </div>

            <div className="h-px bg-border/40 mb-3" />

            {/* History */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Histórico</p>
                <p className="text-[11px] text-muted-foreground/70">{history.length} rolagens</p>
              </div>
              <button
                onClick={handleClearHistory}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
              >
                <Trash2 className="size-3" />
                Limpar
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {history.length === 0 ? (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-center text-[11px] text-muted-foreground/40 py-4 italic"
                  >Nenhuma rolagem ainda</motion.p>
                ) : (
                  history.map((result, i) => (
                    <RollResultDisplay key={result.id} roll={result} index={i} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
