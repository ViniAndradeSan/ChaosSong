'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Lock, ShieldCheck, Swords, LogOut, X, Eye, EyeOff } from 'lucide-react'
import { useAdmin } from '@/lib/admin'

export function SiteHeader() {
  const { admin, login, logout } = useAdmin()
  const [showModal, setShowModal] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const success = login(password)
    if (success) {
      setShowModal(false)
      setPassword('')
      setError(false)
    } else {
      setError(true)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-gradient-to-br from-primary via-secondary to-accent ring-1 ring-white/10 transition group-hover:ring-arcane flex items-center justify-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold leading-none tracking-wider text-gradient">
                CHAOS SONG
              </h1>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Grimório dos Cantores
              </span>
            </div>
          </Link>

          {/* Auth area */}
          <div className="flex items-center gap-3">
            {!admin ? (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted/60"
              >
                <Lock className="size-3.5" />
                <span>Mestre</span>
              </button>
            ) : (
              <>
                <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wider text-primary/70">
                  <ShieldCheck className="size-3" />
                  <span>Mestre Ativo</span>
                </div>
                
                <Link href="/master">
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 10px oklch(0.5 0.2 280 / 0.4)',
                        '0 0 20px oklch(0.6 0.2 200 / 0.5)',
                        '0 0 10px oklch(0.5 0.2 280 / 0.4)',
                      ],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-gradient-to-br from-violet-800/60 to-cyan-800/50 px-3 py-2 text-xs text-violet-200"
                  >
                    <Swords className="size-3.5" />
                    <span>Escudo do Mestre</span>
                  </motion.div>
                </Link>
                
                <button
                  onClick={logout}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/20 hover:text-destructive"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Modal de senha */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`glass-strong w-full max-w-sm rounded-2xl p-6 ${error ? 'shake' : ''}`}
              onAnimationEnd={() => setError(false)}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-2xl text-gradient">Painel do Mestre</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha do mestre..."
                    className="w-full rounded-xl bg-input/60 border border-border px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <X className="size-3" />
                    <span>Senha incorreta</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary py-3 font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Entrar
                </button>
              </form>

              <p className="mt-4 text-center text-[10px] text-muted-foreground">
                Protegido por senha local · Apenas interface
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
