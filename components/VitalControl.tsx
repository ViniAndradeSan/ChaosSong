'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFloatingText } from '@/hooks/use-floating-text'
import { FloatingTexts } from '@/components/FloatingText'

type VitalControlProps = {
  label: string
  value: number
  max: number
  icon: ReactNode
  color: string
  syncing?: boolean
  canEdit: boolean
  isStress?: boolean  // NEW — inverts the danger logic
  onIncrement?: () => void
  onDecrement?: () => void
}

export function VitalControl({
  label,
  value,
  max,
  icon,
  color,
  syncing,
  canEdit,
  isStress = false,
  onIncrement,
  onDecrement,
}: VitalControlProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const { floats, trigger } = useFloatingText()
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Danger logic ─────────────────────────────────────────────
  // HP / Harmony:  low pct  = bad    (normal)
  // Stress:        high pct = bad    (inverted)
  const isCritical = isStress ? pct >= 80 : (pct > 0 && pct <= 20)
  const isWarning  = isStress ? (pct >= 50 && pct < 80) : (pct > 20 && pct <= 45)
  const isStressMax = isStress && pct >= 100

  const atMin = value <= 0
  const atMax = max > 0 && value >= max

  const handleIncrement = () => {
    if (atMax) return
    trigger(isStress ? '+1 ⚡' : '+1', isStress ? '#ef4444' : color)
    onIncrement?.()
  }
  const handleDecrement = () => {
    if (atMin) return
    trigger(isStress ? '-1' : '-1', isStress ? color : '#ef4444')
    onDecrement?.()
  }

  // ─── Bar gradient ──────────────────────────────────────────────
  const barColor = isStress
    ? isCritical
      ? 'linear-gradient(90deg, oklch(0.55 0.32 18), oklch(0.7 0.35 30), oklch(0.55 0.32 10))'
      : isWarning
      ? 'linear-gradient(90deg, oklch(0.6 0.25 45), oklch(0.65 0.3 25))'
      : `linear-gradient(90deg, ${color}, oklch(0.78 0.18 55))`
    : isCritical
    ? 'linear-gradient(90deg, #ef4444, #fb7185)'
    : isWarning
    ? `linear-gradient(90deg, ${color}, oklch(0.8 0.18 45))`
    : `linear-gradient(90deg, ${color}, oklch(0.85 0.15 320))`

  // ─── Container class ───────────────────────────────────────────
  const containerClass = isStress
    ? isCritical
      ? isStressMax
        ? 'stress-critical stress-max'
        : 'stress-critical'
      : isWarning
      ? 'stress-warning'
      : 'border-white/5 bg-white/[0.02]'
    : isCritical
    ? 'border-red-500/40 bg-red-500/10 shadow-[0_0_28px_rgba(239,68,68,0.14)] shake'
    : isWarning
    ? 'border-orange-500/30 bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.08)]'
    : 'border-white/5 bg-white/[0.02]'

  return (
    <div
      className={`relative overflow-hidden space-y-2 rounded-2xl border p-3 transition-all sound-wave-bg ${containerClass}`}
      ref={containerRef}
    >
      {/* Stress crack overlay */}
      {isStress && isCritical && (
        <div
          className="absolute inset-0 pointer-events-none z-[3]"
          style={{
            opacity: isStressMax ? 0.5 : 0.3,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 120'%3E%3Cg stroke='%23ef4444' stroke-width='0.8' fill='none' opacity='0.9'%3E%3Cpath d='M20 0 L35 30 L18 55 L40 80 L25 120'/%3E%3Cpath d='M80 0 L68 25 L85 50 L70 85 L82 120'/%3E%3Cpath d='M150 0 L162 35 L145 65 L158 100 L148 120'/%3E%3Cpath d='M220 0 L208 28 L225 52 L210 88 L222 120'/%3E%3Cpath d='M280 0 L268 32 L285 58 L272 95 L282 120'/%3E%3Cpath d='M0 40 L50 45 L35 55 L90 48'/%3E%3Cpath d='M180 30 L240 38 L220 48 L290 35'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '300px 120px',
            backgroundRepeat: 'repeat',
            animation: 'stressBarFlicker 1.4s steps(2, end) infinite',
          }}
        />
      )}

      {/* Pulsing red radial for stress critical */}
      {isStress && isCritical && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22),transparent_60%)]"
          animate={{ opacity: [0.06, 0.3, 0.06], scale: [1, 1.03, 1] }}
          transition={{ type: 'tween', duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Normal critical (HP etc.) */}
      {!isStress && isCritical && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_55%)]"
          animate={{ opacity: [0.08, 0.24, 0.08], scale: [1, 1.02, 1] }}
          transition={{ type: 'tween', duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <span className={`flex items-center gap-2 text-sm transition-colors ${isStress && isCritical ? 'text-red-400' : 'text-muted-foreground'}`}>
          {icon}
          {label}
          {isStress && isCritical && (
            <motion.span
              className="text-[10px] uppercase tracking-widest text-red-400 font-mono"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              ⚠ CRÍTICO
            </motion.span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={handleDecrement}
              disabled={atMin}
              aria-disabled={atMin}
              className="size-6 rounded-full bg-muted/40 flex items-center justify-center transition hover:bg-red-500/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-muted/40 disabled:hover:text-current"
            >
              <Minus className="size-3" />
            </button>
          )}
          <div className="relative">
            <span className={`font-mono w-12 text-center font-semibold block ${isStress && isCritical ? 'text-red-400' : ''}`}>
              {value}/{max}
            </span>
            <FloatingTexts floats={floats} />
          </div>
          {canEdit && (
            <button
              onClick={handleIncrement}
              disabled={atMax}
              aria-disabled={atMax}
              className="size-6 rounded-full bg-muted/40 flex items-center justify-center transition hover:bg-green-500/20 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-muted/40 disabled:hover:text-current"
            >
              <Plus className="size-3" />
            </button>
          )}
          {syncing && (
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>
      </div>

      {/* Bar */}
      <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden ring-1 ring-white/5 relative z-10">
        <motion.div
          className={`h-full rounded-full ${isStress && isCritical ? 'stress-bar-high' : ''}`}
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{
            width: `${pct}%`,
            scaleY: isCritical ? [1, 1.08, 1] : 1,
          }}
          transition={{ type: 'tween', duration: 1.2, ease: 'easeOut' }}
        />
        {/* Flash on critical */}
        {isCritical && (
          <motion.div
            className="absolute inset-0 rounded-full bg-white/20"
            animate={{ opacity: [0.08, 0.32, 0.08] }}
            transition={{ duration: isStress ? 0.8 : 1, repeat: Infinity }}
          />
        )}

        {/* Sonic wave lines inside bar at high stress */}
        {isStress && isWarning && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 10'%3E%3Cpath d='M0 5 Q10 1 20 5 Q30 9 40 5 Q50 1 60 5 Q70 9 80 5 Q90 1 100 5 Q110 9 120 5 Q130 1 140 5 Q150 9 160 5 Q170 1 180 5 Q190 9 200 5' stroke='rgba(255,255,255,0.25)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 10px',
              backgroundRepeat: 'repeat-x',
              backgroundPosition: 'center',
              opacity: 0.6,
            }}
          />
        )}
      </div>
    </div>
  )
}
