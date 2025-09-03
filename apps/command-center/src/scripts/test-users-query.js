const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUsersQuery() {
  console.log('🔍 Testing users table query...')
  const { data, error } = await supabase.from('users').select('*').limit(5)
  if (error) { console.error('❌ Error:', error.message); process.exit(1) }
  console.log('✅ Result count:', data?.length || 0)
}

if (require.main === module) {
  testUsersQuery().catch((e) => { console.error(e); process.exit(1) })
}

