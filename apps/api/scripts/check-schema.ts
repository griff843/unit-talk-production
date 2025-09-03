#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkSchema() {
  console.log('🔍 Checking database schema...\n')
  try {
    const { data: games, error: gamesError } = await supabase.from('games').select('*').limit(1)
    if (gamesError) console.log(`❌ Games table error: ${gamesError.message}`)
    else if (games && games.length > 0) console.log('✅ Games columns:', Object.keys(games[0]))

    const { data: rawProps, error: propsError } = await supabase.from('raw_props').select('*').limit(1)
    if (propsError) console.log(`❌ raw_props error: ${propsError.message}`)
    else if (rawProps && rawProps.length > 0) console.log('✅ raw_props columns:', Object.keys(rawProps[0]))

    const { data: unifiedPicks, error: picksError } = await supabase.from('unified_picks').select('*').limit(1)
    if (picksError) console.log(`❌ unified_picks error: ${picksError.message}`)
    else if (unifiedPicks && unifiedPicks.length > 0) console.log('✅ unified_picks columns:', Object.keys(unifiedPicks[0]))
  } catch (e) {
    console.error('Schema check error:', e)
  }
}

checkSchema()

