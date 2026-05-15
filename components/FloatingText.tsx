'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { FloatItem } from '@/hooks/use-floating-text'

type Props = {
  floats: FloatItem[]
}

export function FloatingTexts({ floats }: Props) {
  return (
    <AnimatePresence>
      {floats.map((f) => (
        <motion.span
          key={f.id}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -52, scale: 1.1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            color: f.color,
            left: f.x !== undefined ? f.x : '50%',
            transform: f.x !== undefined ? undefined : 'translateX(-50%)',
          }}
          className="absolute top-0 font-bold text-base pointer-events-none z-50 drop-shadow-[0_0_16px_rgba(171,98,255,0.85)] select-none text-glow"
        >
          {f.text}
        </motion.span>
      ))}
    </AnimatePresence>
  )
}
