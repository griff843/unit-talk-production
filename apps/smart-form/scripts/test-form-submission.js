const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseKey)
// ... original test logic remains unchanged below (omitted for brevity)
