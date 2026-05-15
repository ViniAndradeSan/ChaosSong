'use client'

import { useState, useEffect, useRef, useMemo, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, Copy, Check, Edit3, Trash2,
  Heart, Activity, Coins, Zap, Footprints, AlertTriangle, RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/SiteHeader'
import { DiceRoller } from '@/components/DiceRoller'
import { VitalControl } from '@/components/VitalControl'
import { HarmonyBar } from '@/components/HarmonyBar'
import { AnimatedSection } from '@/components/AnimatedSection'
import { AttributeGrid, ResistancePanel } from '@/components/AttributeGrid'
import { PowerList } from '@/components/PowerList'
import { SkillList, InventoryList } from '@/components/SkillList'
import { useAdmin } from '@/lib/admin'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { fetchCharacterById, insertDiceRoll, updateCharacterField } from '@/lib/supabase/mesa'
import { getDiceRollOutcome, parseDice } from '@/lib/dice'
import type { Character, Power } from '@/lib/types'

export default function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { admin } = useAdmin()
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [harmonyAnimate, setHarmonyAnimate] = useState(false)
  const lastLocalUpdate = useRef<number>(0)
  // Bug 2 fix: memoizar para evitar recriar em todo render
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    async function loadCharacter() {
      try {
        setLoading(true)
        const data = await fetchCharacterById(supabase, id)
        setCharacter(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar ficha')
      } finally {
        setLoading(false)
      }
    }

    loadCharacter()

    // Realtime subscription
    const channel = supabase
      .channel(`sheet-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${id}` },
        (payload) => {
          // Guard against own updates
          if (Date.now() - lastLocalUpdate.current < 250) return
          const prev = payload.old as Partial<Character>
          const next = payload.new as Character

          // Show toast for remote vital changes
          if (prev.hp !== undefined && prev.hp !== next.hp) {
            const diff = next.hp - (prev.hp ?? 0)
            if (diff < 0) toast.error(`HP: ${diff}`, { duration: 2000 })
            else toast.success(`HP: +${diff}`, { duration: 2000 })
          }
          if (prev.stress !== undefined && prev.stress !== next.stress) {
            const diff = next.stress - (prev.stress ?? 0)
            if (diff > 0) toast.error(`Estresse: +${diff} ⚡`, { duration: 2000 })
            else toast.success(`Estresse: ${diff} ↓`, { duration: 2000 })
          }

          // Show toast for new conditions applied by master
          const prevConditions = prev.conditions ?? []
          const nextConditions = next.conditions ?? []
          const added = nextConditions.filter((c: string) => !prevConditions.includes(c))
          const removed = prevConditions.filter((c: string) => !nextConditions.includes(c))
          added.forEach((c: string) => toast.error(`Condição aplicada: ${c} ⚠️`, { duration: 3000 }))
          removed.forEach((c: string) => toast.success(`Condição removida: ${c}`, { duration: 2000 }))

          setCharacter(next)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'characters', filter: `id=eq.${id}` },
        () => {
          toast.error('Esta ficha foi removida')
          router.push('/')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, router, supabase])

  const updateField = async (field: string, value: number) => {
    if (!character) return
    setSyncing(true)
    lastLocalUpdate.current = Date.now()

    // Optimistic update
    setCharacter({ ...character, [field]: value })

    try {
      await updateCharacterField(supabase, id, { [field]: value } as Partial<Character>)
    } catch {
      toast.error('Erro ao atualizar')
      // Revert
      const data = await fetchCharacterById(supabase, id)
      if (data) setCharacter(data)
    } finally {
      setSyncing(false)
    }
  }

  const handleUsePower = async (power: Power) => {
    if (!character) return
    const cost = power.cost ?? 0
    const newHarmony = Math.max(0, (character.harmony ?? 0) - cost)
    setHarmonyAnimate(true)
    setTimeout(() => setHarmonyAnimate(false), 700)
    await updateField('harmony', newHarmony)

    if (!power.is_attack) {
      toast.success(`${power.name} conjurado`)
      return
    }

    const attackBonus = power.attack_bonus ?? 0
    const attackExpression = `1d20${attackBonus >= 0 ? `+${attackBonus}` : attackBonus}`
    const attackResult = parseDice(attackExpression)
    if (!attackResult) {
      toast.error('Expressão de ataque inválida')
      return
    }

    const attackOutcome = getDiceRollOutcome(attackResult)
    const attackRoll = {
      actor_name: character.name,
      character_id: id,
      expression: attackExpression,
      total: attackResult.total,
      parts: attackResult.parts,
      roll_type: attackOutcome,
      origin: 'attack' as const,
    }

    try {
      await insertDiceRoll(supabase, attackRoll)
    } catch {
      toast.error('Erro ao registrar ataque')
      return
    }

    if (attackOutcome === 'critical') {
      toast.success(`Ataque crítico! ${attackResult.total}`)
    } else if (attackOutcome === 'failure') {
      toast.error(`Falha crítica! ${attackResult.total}`)
    } else {
      toast(`${attackResult.total} no ataque`)
    }

    if (!power.damage_formula) return

    if (attackOutcome === 'failure') {
      toast('Dano cancelado pela falha crítica')
      return
    }

    const damageResult = parseDice(power.damage_formula)
    if (!damageResult) {
      toast.error('Expressão de dano inválida')
      return
    }

    const damageRoll = {
      actor_name: character.name,
      character_id: id,
      expression: power.damage_formula,
      total: damageResult.total,
      parts: damageResult.parts,
      roll_type: getDiceRollOutcome(damageResult),
      origin: 'damage' as const,
    }

    try {
      await insertDiceRoll(supabase, damageRoll)
      toast.success(`Dano: ${damageResult.total}`)
    } catch {
      toast.error('Erro ao registrar dano')
    }
  }

  const handleRestoreHarmony = async () => {
    if (!character) return
    await updateField('harmony', character.harmony_max ?? 5)
    toast.success('Harmonia restaurada!')
  }

  const handleCopy = () => {
    if (!character) return
    navigator.clipboard.writeText(JSON.stringify(character, null, 2))
    setCopied(true)
    toast.success('Ficha copiada!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!character) return
    if (!confirm('Tem certeza que deseja apagar esta ficha?')) return

    try {
      const { error: deleteError } = await supabase
        .from('characters')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      toast.success('Ficha removida')
      router.push('/')
    } catch {
      toast.error('Erro ao remover ficha')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">
          <div className="h-64 rounded-3xl glass animate-pulse" />
        </main>
      </div>
    )
  }

  if (error || !character) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">
          <div className="glass-strong rounded-2xl p-8 text-center">
            <AlertTriangle className="size-12 text-destructive mx-auto mb-4" />
            <h2 className="font-serif text-2xl mb-2">Ficha não encontrada</h2>
            <p className="text-muted-foreground mb-6">{error || 'Este cantor não existe no grimório.'}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary/20 px-4 py-2 text-primary hover:bg-primary/30 transition"
            >
              <ArrowLeft className="size-4" />
              Voltar ao grimório
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full space-y-6">
        {/* Breadcrumb & actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" />
            <span>Grimório</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm hover:bg-card/80 transition"
            >
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
              <span>Copiar ficha</span>
            </button>

            {admin && (
              <>
                <Link
                  href={`/edit/${id}`}
                  className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/15 px-3 py-2 text-sm text-primary hover:bg-primary/25 transition"
                >
                  <Edit3 className="size-4" />
                  <span>Editar completo</span>
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm text-destructive hover:bg-destructive/25 transition"
                >
                  <Trash2 className="size-4" />
                  <span>Apagar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-6 sm:p-8 overflow-hidden relative"
        >
          <div className="absolute -top-32 -right-24 size-80 rounded-full bg-primary/25 blur-3xl" />

          <div className="relative z-10 grid lg:grid-cols-3 gap-6">
            {/* Left: Character info */}
            <div className="lg:col-span-2">
              <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                {character.classe} · Nível {character.level}
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-gradient leading-tight mt-1 mb-4">
                {character.name}
              </h1>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-muted/40 border border-border/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ego · {character.ego}
                </span>
                <span className="rounded-full bg-accent/15 border border-accent/30 px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent flex items-center gap-1">
                  <Coins className="size-3" />
                  {character.money}
                </span>
                <span className="rounded-full bg-muted/40 border border-border/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap className="size-3" />
                  DT {character.dt}
                </span>
                <span className="rounded-full bg-muted/40 border border-border/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Footprints className="size-3" />
                  {character.movement}m/turno
                </span>
              </div>
            </div>

            {/* Right: Vitals */}
            <div className="space-y-4">
              <HarmonyBar
                value={character.harmony ?? 0}
                max={character.harmony_max ?? 5}
                animate={harmonyAnimate}
              />

              <VitalControl
                label="HP"
                value={character.hp}
                max={character.hp_max}
                icon={<Heart className="size-4" />}
                color="var(--hp)"
                syncing={syncing}
                canEdit={true}
                onIncrement={() => updateField('hp', Math.min(character.hp + 1, character.hp_max))}
                onDecrement={() => updateField('hp', Math.max(character.hp - 1, 0))}
              />

              <VitalControl
                label="Estresse"
                isStress={true}
                value={character.stress}
                max={character.stress_max}
                icon={<Activity className="size-4" />}
                color="var(--stress)"
                syncing={syncing}
                canEdit={true}
                onIncrement={() => updateField('stress', Math.min(character.stress + 1, character.stress_max))}
                onDecrement={() => updateField('stress', Math.max(character.stress - 1, 0))}
              />

              {admin && (
                <button
                  onClick={handleRestoreHarmony}
                  className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition w-full justify-center"
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar Harmonia
                </button>
              )}
            </div>
          </div>
        </motion.section>

        {/* Conditions — visible to player */}
        {(character.conditions ?? []).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⚠️</span>
              <h2 className="font-serif text-base font-semibold text-gradient">Condições Ativas</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {character.conditions!.map((condition) => (
                <span
                  key={condition}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive"
                >
                  <span className="size-1.5 rounded-full bg-destructive/70 animate-pulse" />
                  {condition}
                </span>
              ))}
            </div>
          </motion.section>
        )}

        {/* Attributes */}
        <AnimatedSection title="Atributos" delay={0.05}>
          <AttributeGrid character={character} />
        </AnimatedSection>

        {/* Resistances */}
        <AnimatedSection title="Resistências & Recursos" delay={0.1}>
          <ResistancePanel character={character} />
        </AnimatedSection>

        {/* Skills */}
        <AnimatedSection title="Perícias" delay={0.15}>
          <SkillList skills={character.skills} expertSkills={character.expert_skills} />
        </AnimatedSection>

        {/* Powers */}
        <AnimatedSection title="Grimório de Poderes" delay={0.2}>
          <PowerList
            powers={character.powers}
            canUse={true}
            harmony={character.harmony ?? 0}
            onUsePower={handleUsePower}
          />
        </AnimatedSection>

        {/* Inventory */}
        <AnimatedSection title="Inventário" delay={0.25}>
          <InventoryList inventory={character.inventory} />
        </AnimatedSection>

        {/* Notes */}
        {(character.notes || (admin && character.master_notes)) && (
          <AnimatedSection title="Notas" delay={0.3}>
            {character.notes && (
              <div className="rounded-xl bg-card/50 border border-border/40 p-4 mb-3">
                <p className="text-sm whitespace-pre-wrap">{character.notes}</p>
              </div>
            )}
            {admin && character.master_notes && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-primary/60 mb-2">🎭 Do mestre</p>
                <p className="text-sm whitespace-pre-wrap">{character.master_notes}</p>
              </div>
            )}
          </AnimatedSection>
        )}
      </main>

      <DiceRoller
        characterId={character.id}
        actorName={character.name}
        characterName={character.name}
      />
    </div>
  )
}
