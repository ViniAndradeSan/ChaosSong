'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type AnimatedSectionProps = {
  title?: string
  delay?: number
  children: ReactNode
  className?: string
}

export function AnimatedSection({ title, delay = 0, children, className = '' }: AnimatedSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className={className}
    >
      {title && (
        <h2 className="font-serif uppercase tracking-[0.2em] text-muted-foreground text-sm mb-3">
          {title}
        </h2>
      )}
      {children}
    </motion.section>
  )
}
