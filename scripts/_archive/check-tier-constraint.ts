import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // Get existing tier values
  const { data: users, error } = await supabase
    .from('users')
    .select('tier, capper_tier')
    .limit(10);

  console.log('Existing tier values:');
  users?.forEach((u: any) => {
    console.log(`  tier: ${u.tier}, capper_tier: ${u.capper_tier}`);
  });

  // Try to find the check constraint definition
  const { data: constraints, error: constraintError } = await supabase.rpc('pg_get_constraintdef');

  if (constraintError) {
    console.log('Could not query constraints directly');
  }

  // Test inserting with different tier values
  const testTiers = ['vip', 'VIP', 'Free', 'free', 'VIP+', 'Black Label', 'gold', 'silver', 'bronze', 'platinum'];

  console.log('\nTesting tier values...');
  for (const tier of testTiers) {
    const testId = `test_tier_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        username: testId,
        discord_id: testId,
        tier: tier,
        is_active: false,
        meta: { test: true }
      });

    if (!insertError) {
      console.log(`✅ tier="${tier}" is valid`);
      // Clean up
      await supabase.from('users').delete().eq('username', testId);
    } else {
      console.log(`❌ tier="${tier}" - ${insertError.message}`);
    }
  }
}

main().catch(console.error);
