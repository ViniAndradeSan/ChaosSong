'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Activity, Zap, Sparkles } from 'lucide-react'
import type { Character } from '@/lib/types'
import { memo } from 'react'

type StatusBarProps = {
  label: string
  value: number
  max: number
  icon: React.ReactNode
  color: string
  isStress?: boolean
}

function StatusBar({ label, value, max, icon, color, isStress = false }: StatusBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  // Stress: high = bad. Everything else: low = bad.
  const isCritical = isStress ? pct >= 80 : (pct > 0 && pct <= 20)
  const isWarning  = isStress ? (pct >= 50 && pct < 80) : (pct > 20 && pct <= 45)

  const barGradient = isStress
    ? isCritical
      ? 'linear-gradient(90deg, oklch(0.55 0.32 18), oklch(0.7 0.35 30))'
      : isWarning
      ? 'linear-gradient(90deg, oklch(0.6 0.25 45), oklch(0.65 0.3 25))'
      : `linear-gradient(90deg, ${color}, oklch(0.78 0.18 55))`
    : isCritical
    ? 'linear-gradient(90deg, #ef4444, #fb7185)'
    : `linear-gradient(90deg, ${color}, oklch(0.85 0.15 320))`

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className={`flex items-center gap-1.5 ${isStress && isCritical ? 'text-red-400' : ''}`}>
          {icon}
          {label}
        </span>
        <span className={`font-mono ${isCritical ? 'text-red-400' : 'text-foreground/80'}`}>
          {value}/{max}
        </span>
      </div>
      <div className={`h-1.5 rounded-full bg-muted/40 overflow-hidden relative ${!isStress && isCritical ? 'vital-critical' : ''} ${isStress && isCritical ? 'stress-critical' : ''}`}>
        <motion.div
          className={`h-full rounded-full ${isStress && isCritical ? 'stress-bar-high' : ''}`}
          style={{ background: barGradient }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {isCritical && (
          <motion.div
            className="absolute inset-0 bg-white/15"
            animate={{ opacity: [0.12, 0.32, 0.12] }}
            transition={{ duration: isStress ? 0.7 : 1, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  )
}

function getCardBorderStyle(char: Character): string {
  const hpPct     = char.hp_max > 0 ? char.hp / char.hp_max : 1
  const stressPct = char.stress_max > 0 ? char.stress / char.stress_max : 0
  const harmonyPct = (char.harmony_max ?? 5) > 0 ? (char.harmony ?? 0) / (char.harmony_max ?? 5) : 0

  if (hpPct < 0.2)     return 'ring-2 ring-red-500/70 vital-critical shadow-[0_0_30px_rgba(239,68,68,0.12)]'
  // Stress high = bad (inverted)
  if (stressPct >= 1.0) return 'ring-2 ring-red-600/80 stress-max shadow-[0_0_40px_rgba(220,38,38,0.25)]'
  if (stressPct >= 0.8) return 'ring-2 ring-orange-500/70 stress-critical'
  if (stressPct >= 0.5) return 'ring-1 ring-orange-400/40 stress-warning'
  if (harmonyPct >= 1)  return 'ring-2 ring-blue-400/60 harmony-critical'
  if (harmonyPct <= 0.2) return 'ring-2 ring-fuchsia-400/40 status-flicker'
  return 'ring-1 ring-white/10'
}

type CharacterCardProps = {
  character: Character
  index: number
}

export const CharacterCard = memo(function CharacterCard({ character, index }: CharacterCardProps) {
  const isRecentlyUpdated =
    character.updated_at
      ? Date.now() - new Date(character.updated_at).getTime() < 5000
      : false

  const borderStyle = getCardBorderStyle(character)
  const stressPct = character.stress_max > 0 ? character.stress / character.stress_max : 0

  return (
    <Link href={`/sheet/${character.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        whileHover={{ y: -6 }}
        className={`group relative block overflow-hidden rounded-2xl glass p-5 transition-all hover:ring-arcane cursor-pointer sound-wave-bg cracked-border ${borderStyle} ${isRecentlyUpdated ? 'recently-updated' : ''}`}
      >
        {/* Hover overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(ellipse_at_top_right,oklch(0.6_0.27_320/0.25),transparent_60%)]" />

        {/* Stress distortion overlay when high */}
        {stressPct >= 0.8 && (
          <div
            className="absolute inset-0 pointer-events-none z-[2]"
            style={{
              opacity: stressPct >= 1 ? 0.45 : 0.25,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 160'%3E%3Cg stroke='%23ef4444' stroke-width='0.7' fill='none' opacity='0.85'%3E%3Cpath d='M15 0 L28 28 L12 55 L32 90 L18 160'/%3E%3Cpath d='M75 0 L60 22 L82 50 L65 88 L78 160'/%3E%3Cpath d='M145 0 L158 32 L140 62 L155 98 L145 160'/%3E%3Cpath d='M210 0 L198 26 L218 55 L202 92 L215 160'/%3E%3Cpath d='M275 0 L262 30 L280 58 L265 96 L278 160'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '300px 160px',
              backgroundRepeat: 'repeat',
            }}
          />
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`size-14 shrink-0 rounded-xl bg-gradient-to-br from-secondary via-primary to-accent flex items-center justify-center text-2xl font-bold font-serif ring-1 ring-white/10 ${stressPct >= 0.8 ? 'ring-red-500/50' : ''}`}>
              {character.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-xl truncate">{character.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                Nv {character.level} · {character.classe} · {character.ego}
              </p>
            </div>
          </div>

          {/* Status bars */}
          <div className="space-y-2.5">
            <StatusBar
              label="HP"
              value={character.hp}
              max={character.hp_max}
              icon={<Heart className="size-3" />}
              color="var(--hp)"
            />
            <StatusBar
              label="Estresse"
              value={character.stress}
              max={character.stress_max}
              icon={<Activity className="size-3" />}
              color="var(--stress)"
              isStress
            />
            <StatusBar
              label="Harmonia"
              value={character.harmony ?? 0}
              max={character.harmony_max ?? 5}
              icon={<Sparkles className="size-3" />}
              color="var(--harmony)"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
            <span className="flex items-center gap-1">
              <Zap className="size-3" />
              DT {character.dt}
            </span>
            <span>{character.powers?.length || 0} poderes</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}, (prev, next) => {
  return prev.character.id === next.character.id &&
    prev.character.updated_at === next.character.updated_at &&
    prev.character.hp === next.character.hp &&
    prev.character.stress === next.character.stress &&
    prev.character.harmony === next.character.harmony &&
    prev.index === next.index
})
