'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Trash2, Save, ArrowLeft, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { RollMacro } from './RollMacro'
import { getSupabaseClient } from '@/lib/supabase/singleton'
import { fetchCharacterById } from '@/lib/supabase/mesa'
import { type Character, type Skill, type Power, type InventoryItem, defaultCharacter } from '@/lib/types'

type SheetEditorProps = {
  characterId?: string
  isNew?: boolean
}

export function SheetEditor({ characterId, isNew = false }: SheetEditorProps) {
  const router = useRouter()
  const [character, setCharacter] = useState<Omit<Character, 'id' | 'created_at' | 'updated_at'>>(defaultCharacter)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = useMemo(() => getSupabaseClient(), [])

  // Load character if editing
  useEffect(() => {
    if (isNew || !characterId) return

    async function loadCharacter() {
      try {
        setLoading(true)
        const data = await fetchCharacterById(supabase, characterId as string)
        if (data) {
          const { id, created_at, updated_at, ...rest } = data
          setCharacter(rest as Omit<Character, 'id' | 'created_at' | 'updated_at'>)
        }
      } catch {
        toast.error('Erro ao carregar ficha')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    loadCharacter()
  }, [characterId, isNew, router, supabase])

  const updateField = useCallback(<K extends keyof typeof character>(field: K, value: typeof character[K]) => {
    setCharacter((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  function validateCharacter(char: Partial<typeof character>): string | null {
    if (!char.name?.trim()) return 'Nome é obrigatório'
    if (!char.classe?.trim()) return 'Classe é obrigatória'
    if (char.hp_max != null && char.hp_max < 0) return 'HP máximo inválido'
    return null
  }

  const handleSave = useCallback(async () => {
    const validationError = validateCharacter(character)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('characters')
          .insert([{ ...character, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
          .select()
          .single()

        if (error) throw error
        toast.success('Ficha criada!')
        router.push(`/sheet/${data.id}`)
      } else {
        const { error } = await supabase
          .from('characters')
          .update({ ...character, updated_at: new Date().toISOString() })
          .eq('id', characterId)

        if (error) throw error
        setHasChanges(false)
        toast.success('Salvo automaticamente', { duration: 1500 })
      }
    } catch {
      toast.error('Erro ao salvar ficha')
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, isNew, characterId])

  // Autosave with debounce
  useEffect(() => {
    if (isNew || !hasChanges) return

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }

    autoSaveTimeout.current = setTimeout(() => {
      handleSave()
    }, 2500)

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current)
      }
    }
  }, [character, hasChanges, isNew, handleSave])

  // Beforeunload warning
  useEffect(() => {
    if (!hasChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  // Skill management
  const addSkill = (expert = false) => {
    const field = expert ? 'expert_skills' : 'skills'
    const newSkill: Skill = { id: crypto.randomUUID(), name: '', value: 0, trained: expert }
    updateField(field, [...(character[field] || []), newSkill])
  }

  const updateSkill = (index: number, field: keyof Skill, value: string | number | boolean, expert = false) => {
    const listField = expert ? 'expert_skills' : 'skills'
    const newList = [...(character[listField] || [])]
    newList[index] = { ...newList[index], [field]: value }
    updateField(listField, newList)
  }

  const removeSkill = (index: number, expert = false) => {
    const field = expert ? 'expert_skills' : 'skills'
    updateField(field, character[field].filter((_, i) => i !== index))
  }

  // Power management
  const addPower = () => {
    const newPower: Power = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      cost: 1,
      is_attack: false,
      attack_bonus: 0,
      damage_formula: '',
    }
    updateField('powers', [...(character.powers || []), newPower])
  }

  const updatePower = (index: number, field: keyof Power, value: string | number | boolean) => {
    const newList = [...(character.powers || [])]
    newList[index] = { ...newList[index], [field]: value }
    updateField('powers', newList)
  }

  const removePower = (index: number) => {
    updateField('powers', character.powers.filter((_, i) => i !== index))
  }

  // Inventory management
  const addItem = () => {
    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      name: '',
      qty: 1,
    }
    updateField('inventory', [...(character.inventory || []), newItem])
  }

  const updateItem = (index: number, field: keyof InventoryItem, value: string | number | boolean) => {
    const newList = [...(character.inventory || [])]
    newList[index] = { ...newList[index], [field]: value }
    updateField('inventory', newList)
  }

  const removeItem = (index: number) => {
    updateField('inventory', character.inventory.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl glass animate-pulse" />
        <div className="h-64 rounded-2xl glass animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-secondary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
        >
          <Save className="size-4" />
          {saving ? (isNew ? 'Forjando ficha...' : 'Salvando grimório...') : (isNew ? 'Criar Ficha' : 'Salvar')}
        </button>
      </div>

      {/* Basic Info */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <h2 className="font-serif text-xl text-gradient">Dados Básicos</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Nome</label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60"
              placeholder="Nome do cantor"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Classe</label>
            <input
              type="text"
              value={character.classe}
              onChange={(e) => updateField('classe', e.target.value)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60"
              placeholder="Classe"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Ego</label>
            <input
              type="text"
              value={character.ego}
              onChange={(e) => updateField('ego', e.target.value)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60"
              placeholder="Identidade narrativa"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Nível</label>
            <input
              type="number"
              value={character.level}
              onChange={(e) => updateField('level', parseInt(e.target.value) || 1)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">DT</label>
            <input
              type="number"
              value={character.dt}
              onChange={(e) => updateField('dt', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Dinheiro</label>
            <input
              type="number"
              value={character.money}
              onChange={(e) => updateField('money', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Deslocamento (m)</label>
            <input
              type="number"
              value={character.movement}
              onChange={(e) => updateField('movement', parseInt(e.target.value) || 9)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
        </div>
      </section>

      {/* Attributes */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <h2 className="font-serif text-xl text-gradient">Atributos</h2>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {[
            { key: 'agl', label: 'AGI' },
            { key: 'car', label: 'CAR' },
            { key: 'forca', label: 'FOR' },
            { key: 'intt', label: 'INT' },
            { key: 'pre', label: 'PRE' },
            { key: 'vig', label: 'VIG' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block text-center">{label}</label>
              <input
                type="number"
                value={character[key as keyof typeof character] as number}
                onChange={(e) => updateField(key as keyof typeof character, parseInt(e.target.value) || 0)}
                className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Resistances */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <h2 className="font-serif text-xl text-gradient">Resistências</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Reflexos</label>
            <input
              type="number"
              value={character.reflex}
              onChange={(e) => updateField('reflex', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Fortitude</label>
            <input
              type="number"
              value={character.fort}
              onChange={(e) => updateField('fort', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Vontade</label>
            <input
              type="number"
              value={character.vont}
              onChange={(e) => updateField('vont', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
        </div>
      </section>

      {/* Vitals */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <h2 className="font-serif text-xl text-gradient">Vitais</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">HP Atual</label>
            <input
              type="number"
              value={character.hp}
              onChange={(e) => updateField('hp', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">HP Máximo</label>
            <input
              type="number"
              value={character.hp_max}
              onChange={(e) => updateField('hp_max', parseInt(e.target.value) || 20)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Estresse Atual</label>
            <input
              type="number"
              value={character.stress}
              onChange={(e) => updateField('stress', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Estresse Máximo</label>
            <input
              type="number"
              value={character.stress_max}
              onChange={(e) => updateField('stress_max', parseInt(e.target.value) || 100)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Harmonia Atual</label>
            <input
              type="number"
              value={character.harmony ?? 5}
              onChange={(e) => updateField('harmony', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Harmonia Máxima</label>
            <input
              type="number"
              value={character.harmony_max ?? 5}
              onChange={(e) => updateField('harmony_max', parseInt(e.target.value) || 5)}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-gradient">Perícias</h2>
          <button
            onClick={() => addSkill(false)}
            className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary hover:bg-primary/30 transition"
          >
            <Plus className="size-4" />
            Adicionar
          </button>
        </div>

        <div className="space-y-3">
          {character.skills?.map((skill, i) => (
            <div key={i} className="rounded-lg bg-card/50 border border-border/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground/50 shrink-0" />
                <input
                  type="text"
                  value={skill.name}
                  onChange={(e) => updateSkill(i, 'name', e.target.value)}
                  placeholder="Nome da perícia"
                  className="flex-1 rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <input
                  type="number"
                  value={skill.value}
                  onChange={(e) => updateSkill(i, 'value', parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <button
                  onClick={() => removeSkill(i)}
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="pl-8 pt-2 border-t border-border/30">
                <RollMacro
                  enabled={skill.roll_enabled ?? false}
                  expression={skill.roll_expression || '1d20'}
                  onToggle={(enabled) => updateSkill(i, 'roll_enabled', enabled)}
                  onExpressionChange={(expr) => updateSkill(i, 'roll_expression', expr)}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Expert skills */}
        <div className="pt-4 border-t border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Especialistas</h3>
            <button
              onClick={() => addSkill(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-1.5 text-sm text-accent hover:bg-accent/30 transition"
            >
              <Plus className="size-4" />
              Adicionar
            </button>
          </div>

          <div className="space-y-3">
            {character.expert_skills?.map((skill, i) => (
              <div key={i} className="rounded-lg bg-primary/10 border border-primary/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground/50 shrink-0" />
                  <input
                    type="text"
                    value={skill.name}
                    onChange={(e) => updateSkill(i, 'name', e.target.value, true)}
                    placeholder="Nome da especialização"
                    className="flex-1 rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <input
                    type="number"
                    value={skill.value}
                    onChange={(e) => updateSkill(i, 'value', parseInt(e.target.value) || 0, true)}
                    className="w-20 rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <button
                    onClick={() => removeSkill(i, true)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="pl-8 pt-2 border-t border-primary/30">
                  <RollMacro
                    enabled={skill.roll_enabled ?? false}
                    expression={skill.roll_expression || '1d20'}
                    onToggle={(enabled) => updateSkill(i, 'roll_enabled', enabled, true)}
                    onExpressionChange={(expr) => updateSkill(i, 'roll_expression', expr, true)}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Powers */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-gradient">Poderes</h2>
          <button
            onClick={addPower}
            className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary hover:bg-primary/30 transition"
          >
            <Plus className="size-4" />
            Adicionar
          </button>
        </div>

        <div className="space-y-4">
          {character.powers?.map((power, i) => (
            <div key={power.id} className="rounded-xl bg-card/50 border border-border/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={power.name}
                      onChange={(e) => updatePower(i, 'name', e.target.value)}
                      placeholder="Nome do poder"
                      className="flex-1 rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                    />
                    <input
                      type="number"
                      value={power.cost}
                      onChange={(e) => updatePower(i, 'cost', parseInt(e.target.value) || 1)}
                      placeholder="Custo"
                      className="w-20 rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
                    />
                  </div>
                  <input
                    type="text"
                    value={power.category || ''}
                    onChange={(e) => updatePower(i, 'category', e.target.value)}
                    placeholder="Categoria (opcional)"
                    className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={power.is_attack ?? false}
                        onChange={(e) => updatePower(i, 'is_attack', e.target.checked)}
                        className="accent-primary"
                      />
                      Ataque
                    </label>
                    <input
                      type="number"
                      value={power.attack_bonus ?? 0}
                      onChange={(e) => updatePower(i, 'attack_bonus', parseInt(e.target.value) || 0)}
                      placeholder="Bônus de ataque"
                      className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
                    />
                  </div>

                  <input
                    type="text"
                    value={power.damage_formula ?? ''}
                    onChange={(e) => updatePower(i, 'damage_formula', e.target.value)}
                    placeholder="Fórmula de dano (ex: 2d6+3)"
                    className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />

                  <textarea
                    value={power.description}
                    onChange={(e) => updatePower(i, 'description', e.target.value)}
                    placeholder="Descrição do poder..."
                    rows={2}
                    className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />

                  <div className="pt-2 border-t border-border/30">
                    <RollMacro
                      enabled={power.roll_enabled ?? false}
                      expression={power.roll_expression || '1d20'}
                      onToggle={(enabled) => updatePower(i, 'roll_enabled', enabled)}
                      onExpressionChange={(expr) => updatePower(i, 'roll_expression', expr)}
                      size="sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removePower(i)}
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Inventory */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-gradient">Inventário</h2>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-sm text-primary hover:bg-primary/30 transition"
          >
            <Plus className="size-4" />
            Adicionar
          </button>
        </div>

        <div className="space-y-3">
          {character.inventory?.map((item, i) => (
            <div key={item.id} className="rounded-lg bg-card/50 border border-border/40 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  placeholder="Nome do item"
                  className="flex-1 rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value) || 1)}
                  placeholder="Qty"
                  className="w-16 rounded-lg bg-input/60 border border-border px-3 py-2 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <input
                type="text"
                value={item.description || ''}
                onChange={(e) => updateItem(i, 'description', e.target.value)}
                placeholder="Descrição"
                className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <div className="pt-2 border-t border-border/30">
                <RollMacro
                  enabled={item.roll_enabled ?? false}
                  expression={item.roll_expression || '1d20'}
                  onToggle={(enabled) => updateItem(i, 'roll_enabled', enabled)}
                  onExpressionChange={(expr) => updateItem(i, 'roll_expression', expr)}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <h2 className="font-serif text-xl text-gradient">Notas</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Notas do Jogador</label>
            <textarea
              value={character.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Anotações visíveis para todos..."
              rows={4}
              className="w-full rounded-lg bg-input/60 border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">🎭 Notas do Mestre (privadas)</label>
            <textarea
              value={character.master_notes || ''}
              onChange={(e) => updateField('master_notes', e.target.value)}
              placeholder="Segredos visíveis apenas para o mestre..."
              rows={3}
              className="w-full rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
        </div>
      </section>
    </motion.div>
  )
}
