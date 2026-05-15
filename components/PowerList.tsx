'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Music2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { RollMacro } from './RollMacro'
import type { Power } from '@/lib/types'

type PowerCardProps = {
  power: Power
  index: number
  canUse: boolean
  harmony: number
  onUsePower?: (power: Power) => void
}

// Fixed particle angles evenly distributed — avoids hydration mismatch from Math.random()
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]
const PARTICLE_DISTANCES = [55, 68, 48, 72, 60, 52, 65, 58]

function playArcanePing() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  } catch {
    // AudioContext unavailable
  }
}

function PowerCard({ power, index, canUse, harmony, onUsePower }: PowerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [invokeKey, setInvokeKey] = useState(0)
  const canAfford = harmony >= power.cost

  const handleUse = () => {
    if (!canUse || !canAfford) return
    setInvokeKey((k) => k + 1)
    playArcanePing()
    onUsePower?.(power)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative rounded-xl border border-border/60 bg-gradient-to-br from-card/80 to-card/30 p-4 overflow-hidden group hover:border-primary/40 transition cracked-border sound-wave-bg"
    >
      {/* Card-level radial burst on invoke */}
      {invokeKey > 0 && (
        <>
          <motion.div
            key={`burst-a-${invokeKey}`}
            initial={{ opacity: 0.5, scale: 0.8 }}
            animate={{ opacity: 0, scale: 2.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl pointer-events-none bg-[radial-gradient(circle_at_center,oklch(0.65_0.27_320/0.28),transparent_60%)]"
          />
          <motion.div
            key={`burst-b-${invokeKey}`}
            initial={{ opacity: 0.35, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl pointer-events-none bg-[radial-gradient(circle_at_center,oklch(0.55_0.25_280/0.18),transparent_70%)]"
          />
        </>
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Music2 className="size-4 text-primary" />
            <span className="font-serif text-lg">{power.name}</span>
            {(power.category || power.is_attack) && (
              <div className="flex flex-wrap gap-2">
                {power.category && (
                  <span className="bg-accent/15 text-accent border border-accent/30 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {power.category}
                  </span>
                )}
                {power.is_attack && (
                  <span className="bg-destructive/15 text-destructive border border-destructive/30 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    Ataque
                  </span>
                )}
              </div>
            )}
          </div>
          {power.cost > 0 && (
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground block">Custo</span>
              <span className="flex items-center gap-1 font-mono font-bold text-gradient text-lg">
                <Sparkles className="size-3.5" />
                {power.cost}
              </span>
            </div>
          )}
          {power.is_attack && (
            <div className="text-right mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div className="rounded-full bg-destructive/10 px-2 py-1 inline-block text-destructive">Ataque</div>
              <div>Bônus: {power.attack_bonus ?? 0}</div>
              {power.damage_formula ? <div>Dano: {power.damage_formula}</div> : <div className="italic">Sem dano configurado</div>}
            </div>
          )}
        </div>

        <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
          <p className={`text-sm text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>
            {power.description}
          </p>
          {power.description.length > 100 && (
            <span className="text-[10px] text-primary flex items-center gap-1 mt-1">
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? 'Recolher' : 'Expandir'}
            </span>
          )}
        </button>

        {power.roll_enabled && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <RollMacro
              enabled={true}
              expression={power.roll_expression || '1d20'}
              size="sm"
            />
          </div>
        )}

        {canUse && (
          <motion.button
            whileHover={canAfford ? { scale: 1.02 } : {}}
            whileTap={{ scale: 0.96 }}
            onClick={handleUse}
            disabled={!canAfford}
            className={`relative overflow-hidden w-full mt-3 rounded-lg py-2 text-sm font-semibold transition ${
              canAfford
                ? power.is_attack
                  ? 'bg-gradient-to-r from-destructive to-secondary text-primary-foreground hover:shadow-[0_0_24px_oklch(0.8_0.3_20/0.55)]'
                  : 'bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-[0_0_20px_oklch(0.65_0.27_320/0.5)]'
                : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
            }`}
          >
            {/* ── 3 concentric magic rings expanding with staggered delays ── */}
            {invokeKey > 0 &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={`ring-${invokeKey}-${i}`}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2.8, opacity: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.9, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    border: '1px solid oklch(0.65 0.27 320)',
                    pointerEvents: 'none',
                  }}
                />
              ))}

            {/* ── Spark particles at fixed angles (no hydration mismatch) ── */}
            {invokeKey > 0 &&
              PARTICLE_ANGLES.map((angleDeg, i) => {
                const rad = (angleDeg * Math.PI) / 180
                const dist = PARTICLE_DISTANCES[i]
                return (
                  <motion.span
                    key={`particle-${invokeKey}-${i}`}
                    initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                    animate={{
                      opacity: 0,
                      x: Math.cos(rad) * dist,
                      y: Math.sin(rad) * dist,
                      scale: 0.3,
                    }}
                    transition={{ duration: 0.65, ease: 'easeOut', delay: i * 0.02 }}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: 6,
                      height: 6,
                      marginLeft: -3,
                      marginTop: -3,
                      borderRadius: '50%',
                      background: 'oklch(0.8 0.27 320)',
                      boxShadow: '0 0 8px oklch(0.65 0.27 320)',
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}

            <span className="relative z-10">
              {canAfford
                ? power.is_attack
                  ? '⚔️ Ataque ritual'
                  : '✦ Invocar'
                : 'Harmonia insuficiente'}
            </span>
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

type PowerListProps = {
  powers: Power[]
  canUse?: boolean
  harmony?: number
  onUsePower?: (power: Power) => void
}

export function PowerList({ powers, canUse = false, harmony = 0, onUsePower }: PowerListProps) {
  if (!powers || powers.length === 0) {
    return (
      <p className="text-muted-foreground italic text-center py-4">
        Nenhum poder registrado neste grimório.
      </p>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {powers.map((power, i) => (
        <PowerCard key={power.id} power={power} index={i} canUse={canUse} harmony={harmony} onUsePower={onUsePower} />
      ))}
    </div>
  )
}
