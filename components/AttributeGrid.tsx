'use client'

import { motion } from 'framer-motion'
import type { Character } from '@/lib/types'

const ATTRIBUTES = [
  { key: 'agl', name: 'Agilidade', abbr: 'AGI' },
  { key: 'car', name: 'Carisma', abbr: 'CAR' },
  { key: 'forca', name: 'Força', abbr: 'FOR' },
  { key: 'intt', name: 'Intelecto', abbr: 'INT' },
  { key: 'pre', name: 'Presença', abbr: 'PRE' },
  { key: 'vig', name: 'Vigor', abbr: 'VIG' },
] as const

type AttributeGridProps = {
  character: Character
}

export function AttributeGrid({ character }: AttributeGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {ATTRIBUTES.map((attr, i) => (
        <motion.div
          key={attr.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -2, scale: 1.01 }}
          transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' }}
          className="rounded-xl p-3 text-center magic-panel border border-border/60 transition"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">
            {attr.name}
          </span>
          <span className="font-serif text-3xl font-bold text-gradient mt-1 block">
            {character[attr.key]}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 block">
            {attr.abbr}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

type ResistancePanelProps = {
  character: Character
}

export function ResistancePanel({ character }: ResistancePanelProps) {
  const items = [
    { label: 'Reflexos', value: character.reflex },
    { label: 'Fortitude', value: character.fort },
    { label: 'Vontade', value: character.vont },
    { label: 'DT', value: character.dt, accent: true },
    { label: 'Deslocamento', value: character.movement, suffix: 'm' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className={`rounded-xl p-3 text-center border transition ${
            item.accent
              ? 'bg-gradient-to-br from-primary/20 to-secondary/10 border-primary/40 ring-arcane'
              : 'bg-card/60 border-border/60'
          }`}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">
            {item.label}
          </span>
          <span className="font-serif text-2xl font-bold block mt-1">
            {item.value}
            {item.suffix && <span className="text-sm text-muted-foreground">{item.suffix}</span>}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
