import type { DicePart } from '@/lib/dice'

// Character sheet types for Chaos Song RPG

export type Skill = {
  id: string
  name: string
  value: number
  trained?: boolean
  roll_enabled?: boolean
  roll_expression?: string
}

export type Power = {
  id: string
  name: string
  description: string
  cost: number
  type?: string
  category?: string
  is_attack?: boolean
  attack_bonus?: number
  damage_formula?: string
  roll_enabled?: boolean
  roll_expression?: string
}

export type InventoryItem = {
  id: string
  name: string
  qty: number
  description?: string
  roll_enabled?: boolean
  roll_expression?: string
}

export type Condition = {
  id: string
  name: string
  source?: string
  expires_at?: string
}

export type Character = {
  id: string
  name: string
  classe: string
  ego: string
  level: number
  dt: number
  money: number
  movement: number

  // Attributes
  agl: number
  car: number
  forca: number
  intt: number
  pre: number
  vig: number

  // Resistances
  reflex: number
  fort: number
  vont: number

  // Vitals
  hp: number
  hp_max: number
  stress: number
  stress_max: number
  harmony: number
  harmony_max: number

  // Lists
  skills: Skill[]
  expert_skills: Skill[]
  powers: Power[]
  inventory: InventoryItem[]

  // Notes
  notes: string
  master_notes?: string

  // Conditions and runtime state
  conditions?: string[]

  // Appearance
  avatar_url: string
  theme_color: string

  // Timestamps
  created_at: string
  updated_at: string
}

export type DiceRoll = {
  id: string
  character_id?: string
  actor_name: string
  expression: string
  total: number
  parts: DicePart[]
  roll_type: 'normal' | 'critical' | 'failure'
  origin: 'player' | 'sheet' | 'master' | 'attack' | 'damage'
  created_at: string
}

export type Combatant = {
  id: string
  characterId?: string
  name: string
  classe?: string
  level?: number
  dt?: number
  movement?: number
  initiative: number
  isNpc?: boolean
  isTemporary?: boolean
  npcType?: 'hostil' | 'aliado' | 'neutro'
  hp?: number
  hp_max?: number
  notes?: string
  conditions?: string[]
  created_at?: string
  updated_at?: string
}

export const defaultCharacter: Omit<Character, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  classe: '',
  ego: '',
  level: 1,
  dt: 15,
  money: 0,
  movement: 0,

  agl: 1,
  car: 1,
  forca: 1,
  intt: 1,
  pre: 1,
  vig: 1,

  reflex: 0,
  fort: 0,
  vont: 0,

  hp: 0,
  hp_max: 0,
  stress: 100,
  stress_max: 100,
  harmony: 5,
  harmony_max: 5,

  skills: [],
  expert_skills: [],
  powers: [],
  inventory: [],

  notes: '',
  avatar_url: '',
  theme_color: '#8b5cf6',
}
