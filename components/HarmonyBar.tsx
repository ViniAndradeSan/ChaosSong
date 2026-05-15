'use client'

import { motion, AnimatePresence } from 'framer-motion'

type HarmonyBarProps = {
  value: number
  max: number
  animate?: boolean
}

export function HarmonyBar({ value, max, animate = false }: HarmonyBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const isCritical = pct > 0 && pct <= 20
  const isWarning = pct > 20 && pct <= 45

  // Generate equalizer bars
  const bars = Array.from({ length: 18 }, (_, i) => ({
    height: `${30 + (i % 5) * 14}%`,
    delay: i * 80,
  }))

  return (
    <div className={`relative overflow-hidden space-y-2 rounded-2xl border p-3 transition-all magic-panel ${isCritical ? 'border-hp/40 bg-hp/10 vital-critical' : isWarning ? 'border-stress/30 bg-stress/5' : 'border-white/5 bg-white/[0.02]'}`}>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Harmonia
        </span>
        <span className="font-mono text-2xl text-gradient font-bold">
          {value}
          <span className="text-muted-foreground text-base">/{max}</span>
        </span>
      </div>

      {/* Track */}
      <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden ring-1 ring-white/5">
        {/* Fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${isCritical ? 'harmony-critical' : 'pulse-glow'}`}
          style={{ background: isCritical ? 'linear-gradient(90deg, #ef4444, #fb7185)' : 'var(--gradient-harmony)' }}
          initial={{ width: 0, scaleY: 1 }}
          animate={{ width: `${pct}%`, scaleY: isCritical ? [1, 1.06, 1] : [1, 1.02, 1] }}
          transition={{ type: 'tween', duration: 1.2, ease: 'easeOut' }}
        />

        {/* Equalizer overlay */}
        <div className={`absolute inset-0 flex items-end justify-around px-1 pointer-events-none ${isCritical ? 'opacity-60' : 'opacity-30'}`}>
          {bars.map((bar, i) => (
            <div
              key={i}
              className="equalizer-bar w-0.5 rounded-full bg-white/60"
              style={{
                height: bar.height,
                animationDelay: `${bar.delay}ms`,
              }}
            />
          ))}
        </div>

        {/* Flash effect on power use */}
        <AnimatePresence>
          {animate && (
            <motion.div
              key={value}
              initial={{ opacity: 0.9, scale: 0.98 }}
              animate={{ opacity: 0, scale: 1.02 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 rounded-full bg-white/30"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
