'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  // Use hardcoded fallback if NEXT_PUBLIC envs are still not injected
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url || !key) {
    console.warn('⚠️ Supabase env vars missing in browser. Did you restart Next.js after editing .env?')
  }

  return createBrowserClient(url, key)
}
