import { createClient as _createClient } from './client'

let instance: ReturnType<typeof _createClient> | null = null

export function getSupabaseClient() {
  if (!instance) instance = _createClient()
  return instance
}
