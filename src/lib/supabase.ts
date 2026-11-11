import { createClient, SupabaseClient } from '@supabase/supabase-js'

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  'https://mwqtenuykrdlspxhgdlw.supabase.co'
const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_NvYSYfPuqL04mnkD8BSnXw_uEOMtGam'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'wmk-enterprise-auth-session',
      },
    })
  : null
