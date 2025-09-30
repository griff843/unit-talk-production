import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars')
}
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const sport = searchParams.get('sport') || ''

    if (query.length < 2) {
      return NextResponse.json({ players: [] })
    }

    let dbQuery = supabase
      .from('raw_props')
      .select('player_name, team')
      .ilike('player_name', `%${query}%`)
      .limit(10)

    if (sport) {
      dbQuery = dbQuery.eq('sport', sport.toUpperCase())
    }

    const { data: players, error } = await dbQuery

    if (error) {
      console.error('[Players API] Database error:', error)
      return NextResponse.json({ players: [] })
    }

    const unique = Array.from(new Set((players || []).map((p: any) => p.player_name))).slice(0, 10)

    return NextResponse.json({ players: unique })
  } catch (err) {
    console.error('[Players API] Error:', err)
    return NextResponse.json({ players: [] })
  }
}

