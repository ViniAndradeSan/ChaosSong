'use client'

import { motion } from 'framer-motion'
import { Dice5 } from 'lucide-react'
import { useDiceRoller } from '@/hooks/use-dice-roller'

interface RollMacroProps {
  enabled?: boolean
  expression?: string
  onToggle?: (enabled: boolean) => void
  onExpressionChange?: (expression: string) => void
  size?: 'sm' | 'md'
}

export function RollMacro({
  enabled = false,
  expression = '1d20',
  onToggle,
  onExpressionChange,
  size = 'md',
}: RollMacroProps) {
  const { rollDice } = useDiceRoller()

  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const inputClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
  const buttonClass = size === 'sm' ? 'p-1.5 size-6' : 'p-2 size-8'

  return (
    <div className={`flex items-center gap-2 ${sizeClass}`}>
      <label className="flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle?.(e.target.checked)}
          className="accent-primary rounded"
        />
        <span className="text-muted-foreground group-hover:text-foreground transition">
          Girar dados?
        </span>
      </label>

      {enabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={expression}
            onChange={(e) => onExpressionChange?.(e.target.value)}
            placeholder="1d20"
            className={`w-20 rounded-lg bg-input/60 border border-border px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/60 ${inputClass}`}
          />
          <motion.button
            onClick={() => rollDice(expression)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            className={`rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition flex items-center justify-center ${buttonClass}`}
            title="Girar dados"
          >
            <Dice5 className="size-4" />
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}
