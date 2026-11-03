import { createClient } from '@supabase/supabase-js'

const env = (import.meta as any).env

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

export const supabase =
  url && key ? createClient(url, key) : null

export const isSupabaseConfigured = Boolean(supabase)
