import type { SupabaseClient } from '@supabase/supabase-js'
import type { Character, DiceRoll, Combatant } from '@/lib/types'

const CHARACTERS_TABLE = 'characters'
const DICE_ROLLS_TABLE = 'dice_rolls'
const SESSION_STATE_TABLE = 'session_state'

export async function fetchCharacters(supabase: SupabaseClient) {
  const { data, error } = await supabase.from(CHARACTERS_TABLE).select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchCharacterById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from(CHARACTERS_TABLE).select('*').eq('id', id).single()
  if (error) throw error
  return data ?? null
}

export async function fetchRecentDiceRolls(supabase: SupabaseClient, limit = 20, afterTimestamp?: string): Promise<DiceRoll[]> {
  let query = supabase
    .from(DICE_ROLLS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (afterTimestamp) {
    query = query.gt('created_at', afterTimestamp)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchFeed(supabase: SupabaseClient, limit = 20, afterTimestamp?: string): Promise<DiceRoll[]> {
  return fetchRecentDiceRolls(supabase, limit, afterTimestamp)
}

export async function insertDiceRoll(
  supabase: SupabaseClient,
  payload: Omit<DiceRoll, 'id' | 'created_at'>
) {
  const { data, error } = await supabase.from(DICE_ROLLS_TABLE).insert(payload).select()
  if (error) throw new Error(error.message ?? error.code ?? 'Erro desconhecido ao inserir rolagem')
  return data?.[0]
}

export function subscribeToDiceRolls(
  supabase: SupabaseClient,
  callback: (roll: DiceRoll) => void
) {
  const channel = supabase
    .channel('dice-rolls-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: DICE_ROLLS_TABLE },
      (payload) => {
        const roll = payload.new as DiceRoll
        callback(roll)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function updateCharacterField(
  supabase: SupabaseClient,
  charId: string,
  payload: Partial<Character>
) {
  const { data, error } = await supabase
    .from(CHARACTERS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', charId)

  if (error) throw error
  return data?.[0]
}

export async function updateCharacterMasterNotes(
  supabase: SupabaseClient,
  charId: string,
  master_notes: string
) {
  return updateCharacterField(supabase, charId, { master_notes })
}

// ─── Session State ────────────────────────────────────────────────────────────

export type NpcDraft = {
  name: string
  initiative: number
  dt: number
  movement: number
  hp: number
  hp_max: number
  type: 'hostil' | 'aliado' | 'neutro'
  notes: string
  conditions: string[]
}

export type SessionStateData = {
  inCombat: boolean
  round: number
  currentTurnIndex: number
  editLocked: boolean
  combatants: Combatant[]
  npcDraft: NpcDraft
}

export const defaultSessionState: SessionStateData = {
  inCombat: false,
  round: 1,
  currentTurnIndex: 0,
  editLocked: true,
  combatants: [],
  npcDraft: {
    name: '',
    initiative: 0,
    dt: 0,
    movement: 0,
    hp: 0,
    hp_max: 0,
    type: 'hostil',
    notes: '',
    conditions: [],
  },
}

export async function loadSessionState(supabase: SupabaseClient): Promise<{
  state: SessionStateData
  logClearedAt: string | null
}> {
  try {
    const { data, error } = await supabase
      .from(SESSION_STATE_TABLE)
      .select('state, log_cleared_at')
      .eq('id', 'global')
      .single()

    if (error || !data) {
      return { state: defaultSessionState, logClearedAt: null }
    }

    return {
      state: (data.state as SessionStateData) ?? defaultSessionState,
      logClearedAt: data.log_cleared_at ?? null,
    }
  } catch {
    return { state: defaultSessionState, logClearedAt: null }
  }
}

export async function saveSessionState(
  supabase: SupabaseClient,
  state: SessionStateData
) {
  const { error } = await supabase
    .from(SESSION_STATE_TABLE)
    .upsert({ id: 'global', state }, { onConflict: 'id' })

  if (error) throw error
}

export async function clearFeed(supabase: SupabaseClient) {
  const timestamp = new Date().toISOString()

  // 1. Delete all dice rolls from the database
  const { error: deleteError } = await supabase
    .from(DICE_ROLLS_TABLE)
    .delete()
    .gte('created_at', '1970-01-01') // Delete all records

  if (deleteError) {
    console.error('Delete dice rolls error:', deleteError)
    throw new Error(`Erro ao limpar histórico de dados: ${deleteError.message}`)
  }

  // 2. Update session state checkpoint
  const { data, error } = await supabase
    .from(SESSION_STATE_TABLE)
    .upsert(
      {
        id: 'global',
        mode: 'exploration',
        state: defaultSessionState,
        log_cleared_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: 'id' }
    )
    .select()

  if (error) {
    console.error('Upsert error:', error)
    throw new Error(`Erro ao limpar feed: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.error('Upsert returned no data')
    throw new Error('Falha ao limpar feed: nenhum registro foi atualizado')
  }

  return timestamp
}

export function subscribeFeed(
  supabase: SupabaseClient,
  getLogClearedAt: () => string | null,
  onNewRoll: (roll: DiceRoll) => void,
  onCheckpointUpdated: (timestamp: string) => void,
) {
  const channel = supabase
    .channel('master-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: DICE_ROLLS_TABLE },
      (payload) => {
        const roll = payload.new as DiceRoll
        const clearedAt = getLogClearedAt()
        if (clearedAt && new Date(roll.created_at) <= new Date(clearedAt)) return
        onNewRoll(roll)
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: SESSION_STATE_TABLE },
      (payload) => {
        const newData = payload.new as { log_cleared_at?: string }
        if (newData.log_cleared_at) {
          onCheckpointUpdated(newData.log_cleared_at)
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/** @deprecated Use clearFeed instead */
export const clearSessionLog = clearFeed
