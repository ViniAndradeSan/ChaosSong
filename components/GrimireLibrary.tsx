'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Heart, Star, Filter, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { Power } from '@/lib/types'

type PowerType = 'magia' | 'habilidade' | 'ritual' | 'efeito' | 'invocação' | 'reação' | 'todas'

type GrimireLibraryProps = {
  characters: any[]
}

// Mock powers library - na prática viriam do DB
const GRIMOIRE_LIBRARY: (Power & { type: PowerType; duration?: string; cooldown?: string })[] = [
  {
    id: '1',
    name: 'Invocar',
    description: 'Convoca um aliado para participar do combate',
    cost: 5,
    type: 'invocação',
    category: 'combate',
    duration: 'sustentada',
    cooldown: 'uma cena',
  },
  {
    id: '2',
    name: 'Escudo Arcano',
    description: 'Cria uma barreira de proteção mágica',
    cost: 3,
    type: 'magia',
    category: 'defesa',
    duration: 'uma rodada',
  },
  {
    id: '3',
    name: 'Rajada de Fogo',
    description: 'Lança uma explosão de fogo em uma área',
    cost: 4,
    type: 'magia',
    category: 'ataque',
    duration: 'instantâneo',
    cooldown: 'duas rodadas',
  },
  {
    id: '4',
    name: 'Ritual de Cura',
    description: 'Realiza um ritual de cura profunda',
    cost: 6,
    type: 'ritual',
    category: 'cura',
    duration: 'uma cena',
    cooldown: 'uma sessão',
  },
  {
    id: '5',
    name: 'Reflexo de Combate',
    description: 'Reage rapidamente ao ataque de um inimigo',
    cost: 0,
    type: 'reação',
    category: 'combate',
    duration: 'instantâneo',
  },
]

export function GrimireLibrary({ characters }: GrimireLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<PowerType>('todas')
  const [favorites, setFavorites] = useState<string[]>([])
  const [used, setUsed] = useState<string[]>([])
  const [selectedPower, setSelectedPower] = useState<(typeof GRIMOIRE_LIBRARY)[0] | null>(null)
  const [invokeEffects, setInvokeEffects] = useState<Record<string, number>>({})

  const filtered = useMemo(() => {
    return GRIMOIRE_LIBRARY.filter((power) => {
      const matchesSearch = power.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        power.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'todas' || power.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [searchTerm, typeFilter])

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  const usePower = useCallback((power: typeof GRIMOIRE_LIBRARY[0]) => {
    setUsed((prev) => [...prev, power.id])
    setInvokeEffects((prev) => ({ ...prev, [power.id]: (prev[power.id] ?? 0) + 1 }))
    toast.success(`${power.name} foi usada!`)
    
    // Remover do marcado de usado após 3 segundos
    setTimeout(() => {
      setUsed((prev) => prev.filter((id) => id !== power.id))
    }, 3000)
  }, [])

  const types: PowerType[] = ['todas', 'magia', 'habilidade', 'ritual', 'efeito', 'invocação', 'reação']

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar habilidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                typeFilter === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <Filter className="inline size-3 mr-1" />
              {type === 'todas' ? 'Todas' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </div>
      </motion.div>

      {/* Powers Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((power, idx) => (
            <motion.div
              key={power.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: idx * 0.04 }}
              className="relative group"
            >
              {/* Card */}
              <div
                onClick={() => setSelectedPower(power)}
                className="magic-panel rounded-xl p-4 border cursor-pointer transition hover:border-primary/60 space-y-3 relative overflow-hidden"
              >
                {/* Used overlay */}
                {used.includes(power.id) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center rounded-xl"
                  >
                    <span className="font-bold text-green-400 text-lg">✓ Usada</span>
                  </motion.div>
                )}

                {/* Invoke effect rings */}
                {(invokeEffects[power.id] ?? 0) > 0 && (
                  <>
                    {Array.from({ length: invokeEffects[power.id] }).map((_, i) => (
                      <motion.div
                        key={`ring-${i}`}
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 2.2, opacity: 0 }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-xl border-2 border-primary/40 pointer-events-none"
                      />
                    ))}
                  </>
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-bold">{power.name}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {power.type} · {power.category}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(power.id)
                    }}
                    className="transition hover:scale-110"
                  >
                    <Star
                      className={`size-4 ${
                        favorites.includes(power.id)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">{power.description}</p>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs relative z-10">
                  <div className="flex items-center gap-3">
                    {power.cost > 0 && (
                      <span className="flex items-center gap-1 text-primary">
                        <Zap className="size-3" />
                        {power.cost}
                      </span>
                    )}
                    {power.duration && (
                      <span className="text-muted-foreground">{power.duration}</span>
                    )}
                  </div>
                  {power.cooldown && (
                    <span className="text-muted-foreground text-[9px]">CD: {power.cooldown}</span>
                  )}
                </div>

                {/* Use Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    usePower(power)
                  }}
                  className={`relative w-full rounded-lg py-2 text-sm font-semibold transition overflow-hidden ${
                    ['invocação', 'ritual', 'magia'].includes(power.type)
                      ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {/* Magic glow effect */}
                  {['invocação', 'ritual', 'magia'].includes(power.type) && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileHover={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent pointer-events-none"
                    />
                  )}
                  <span className="relative">Usar</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal detalhes */}
      <AnimatePresence>
        {selectedPower && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPower(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl max-w-sm w-full p-6 border space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-gradient">{selectedPower.name}</h2>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    {selectedPower.type} · {selectedPower.category}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPower(null)}
                  className="p-2 rounded-lg hover:bg-muted/40 transition"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{selectedPower.description}</p>

              <div className="space-y-2 text-sm">
                {selectedPower.cost > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Custo:</span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Zap className="size-3 text-primary" />
                      {selectedPower.cost} Harmonia
                    </span>
                  </div>
                )}
                {selectedPower.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duração:</span>
                    <span className="font-semibold">{selectedPower.duration}</span>
                  </div>
                )}
                {selectedPower.cooldown && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recarga:</span>
                    <span className="font-semibold">{selectedPower.cooldown}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    toggleFavorite(selectedPower.id)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                    favorites.includes(selectedPower.id)
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <Star className="size-4" />
                  {favorites.includes(selectedPower.id) ? 'Favorito' : 'Favoritar'}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    usePower(selectedPower)
                    setSelectedPower(null)
                  }}
                  className="flex-1 rounded-lg bg-gradient-to-r from-primary to-secondary text-white py-2 text-sm font-semibold transition hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                >
                  Usar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
