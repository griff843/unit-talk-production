import { getTypedSupabaseClient } from '@/lib/supabase'

async function main() {
  const start = Date.now()
  const client = getTypedSupabaseClient()
  const results: Record<string, any> = { ok: true, duration_ms: 0 }

  try {
    // Simple health checks against key routes via internal fetch
    const endpoints = [
      'http://localhost:3015/api/health',
      'http://localhost:3015/api/monitoring/pipeline',
      'http://localhost:3015/api/pipeline/lag?limit=5',
    ]

    const checks = await Promise.allSettled(endpoints.map(async (url) => {
      const res = await fetch(url)
      return { url, status: res.status }
    }))

    results.endpoints = checks
  } catch (e: any) {
    results.ok = false
    results.error = e?.message || String(e)
  }

  try {
    // Minimal DB probe
    if (client) {
      const { data, error } = await client.from('users').select('count').limit(1)
      if (error) throw error
      results.db = { ok: true, count: data?.length ?? 0 }
    } else {
      results.db = { ok: false, error: 'no client' }
    }
  } catch (e: any) {
    results.db = { ok: false, error: e?.message || String(e) }
  }

  results.duration_ms = Date.now() - start
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

