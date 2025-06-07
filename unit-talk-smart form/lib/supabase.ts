'use client'

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase environment variables are missing. Please check your .env.local file.')
}

export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Helper function for error handling
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error)
  return {
    error: {
      message: error?.message || 'An unexpected error occurred',
      details: error?.details || ''
    }
  }
}
