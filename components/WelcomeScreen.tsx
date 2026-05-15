'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface WelcomeScreenProps {
  onEnter: (name: string) => void
}

const RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛊ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ']

function FloatingRune({ index }: { index: number }) {
  const rune = RUNES[index % RUNES.length]
  const left  = ((index * 137.5) % 100)
  const delay = (index * 0.4) % 6
  const dur   = 8 + (index % 5) * 2
  const size  = 12 + (index % 4) * 6

  return (
    <motion.span
      className="absolute select-none pointer-events-none font-serif text-primary/10"
      style={{ left: `${left}%`, fontSize: size, bottom: '-2rem' }}
      animate={{ y: [0, -(window?.innerHeight ?? 800) - 60], opacity: [0, 0.6, 0.6, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'linear', times: [0, 0.1, 0.85, 1] }}
    >
      {rune}
    </motion.span>
  )
}

export function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [name, setName]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase]         = useState<'idle' | 'typing' | 'ready'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (name.trim().length > 0) setPhase('ready')
    else if (name.length > 0)   setPhase('typing')
    else                        setPhase('idle')
  }, [name])

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))
    onEnter(name.trim())
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSubmit()
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Ambient background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px]" />
      </div>

      {/* Floating runes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <FloatingRune key={i} index={i} />
        ))}
      </div>

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px',
        }}
      />

      {/* Central card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Card glow ring */}
        <motion.div
          className="absolute -inset-px rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, oklch(0.65 0.27 320 / 0.4), oklch(0.6 0.25 200 / 0.2), oklch(0.7 0.3 80 / 0.15))',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative glass-strong rounded-3xl p-8 sm:p-10 border border-border/40">

          {/* Sigil / logo area */}
          <motion.div
            className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            {/* Animated hexagonal sigil */}
            <motion.div
              className="relative mb-5"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <svg viewBox="0 0 80 80" className="w-16 h-16">
                <defs>
                  <linearGradient id="sigilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="oklch(0.65 0.27 320)" />
                    <stop offset="50%" stopColor="oklch(0.6 0.25 200)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.3 80)" />
                  </linearGradient>
                </defs>
                <polygon points="40,4 74,22 74,58 40,76 6,58 6,22"
                  fill="none" stroke="url(#sigilGrad)" strokeWidth="1.5" opacity="0.9" />
                <polygon points="40,14 66,28 66,52 40,66 14,52 14,28"
                  fill="none" stroke="url(#sigilGrad)" strokeWidth="0.8" opacity="0.5" />
                <line x1="40" y1="4"  x2="40" y2="76" stroke="url(#sigilGrad)" strokeWidth="0.5" opacity="0.3" />
                <line x1="6"  y1="22" x2="74" y2="58" stroke="url(#sigilGrad)" strokeWidth="0.5" opacity="0.3" />
                <line x1="74" y1="22" x2="6"  y2="58" stroke="url(#sigilGrad)" strokeWidth="0.5" opacity="0.3" />
                <circle cx="40" cy="40" r="4" fill="url(#sigilGrad)" opacity="0.8" />
              </svg>
            </motion.div>

            <span className="text-[10px] uppercase tracking-[0.6em] text-muted-foreground/60 mb-1">
              Chaos Song · Vol. I
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-center leading-tight">
              <span className="text-gradient">Cantores da</span>
              <br />
              <span className="text-foreground/90">Tempestade Final</span>
            </h1>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="flex items-center gap-3 mb-7"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.5 }}
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
            <span className="text-primary/40 text-xs font-serif">✦</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
          </motion.div>

          {/* Name input area */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5 }}
          >
            <div>
              <label className="block text-xs uppercase tracking-[0.35em] text-muted-foreground/70 mb-3 text-center">
                Como você é chamado?
              </label>
              <div className="relative">
                {/* Input glow */}
                <motion.div
                  className="absolute -inset-px rounded-xl pointer-events-none"
                  animate={{
                    opacity: phase === 'ready' ? 1 : phase === 'typing' ? 0.5 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.65 0.27 320 / 0.5), oklch(0.6 0.25 200 / 0.3))',
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Seu nome de cantor..."
                  maxLength={40}
                  autoFocus
                  className="relative w-full font-serif text-lg text-center rounded-xl bg-input/50 border border-border/60 px-4 py-3.5 focus:outline-none focus:border-primary/50 transition placeholder:text-muted-foreground/30 placeholder:font-sans placeholder:text-sm"
                />
              </div>
            </div>

            {/* Enter button */}
            <motion.button
              onClick={() => void handleSubmit()}
              disabled={!name.trim() || submitting}
              whileTap={name.trim() ? { scale: 0.97 } : {}}
              className="relative w-full rounded-xl py-3.5 font-semibold text-sm transition overflow-hidden disabled:cursor-not-allowed"
              animate={{
                opacity: phase === 'ready' ? 1 : 0.35,
              }}
              transition={{ duration: 0.25 }}
            >
              {/* Button background */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-90" />
              {/* Shimmer on ready */}
              <AnimatePresence>
                {phase === 'ready' && (
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(90deg, transparent, white/10, transparent)' }}
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
                  />
                )}
              </AnimatePresence>
              <span className="relative z-10 text-primary-foreground">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="inline-block"
                    >
                      ⟳
                    </motion.span>
                    Invocando...
                  </span>
                ) : (
                  'Entrar no Grimório ✦'
                )}
              </span>
            </motion.button>
          </motion.div>

          {/* Footer note */}
          <motion.p
            className="text-center text-[10px] text-muted-foreground/35 mt-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Seu nome aparecerá nas rolagens de dados e no Escudo do Mestre
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  )
}
