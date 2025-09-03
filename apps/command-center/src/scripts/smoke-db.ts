import { getTypedSupabaseClient } from '@/lib/supabase'

async function main() {
  const start = Date.now()
  const client = getTypedSupabaseClient()
  const results: Record<string, any> = { ok: true, duration_ms: 0 }

  try {
    if (!client) throw new Error('no supabase client')

    const tables = ['users', 'unified_picks', 'raw_props', 'events']
    const probes = await Promise.allSettled(
      tables.map(async (t) => {
        const { data, error } = await client.from(t).select('count').limit(1)
        if (error) throw error
        return { table: t, count: data?.length ?? 0 }
      })
    )
    results.probes = probes
  } catch (e: any) {
    results.ok = false
    results.error = e?.message || String(e)
  }

  results.duration_ms = Date.now() - start
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

