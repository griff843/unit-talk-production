// 2025-11-21: Phase 15 synthetic raw_props test data inserter
// Inserts a small batch of realistic raw_props rows for professional pipeline validation

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const baseCreatedAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

  const rows = [];

  const sports = ['NBA', 'NFL'];
  const statTypes = ['points', 'rebounds', 'yards'];

  for (let i = 0; i < 15; i++) {
    const createdAt = new Date(baseCreatedAt.getTime() + i * 20 * 1000);
    const sport = sports[i % sports.length];
    const statType = statTypes[i % statTypes.length];

    rows.push({
      external_id: `TEST_PRO_${i + 1}`,
      player_name: `TEST_PLAYER_${i + 1}`,
      team: sport === 'NBA' ? 'LAL' : 'KC',
      opponent: sport === 'NBA' ? 'BOS' : 'DEN',
      sport,
      league: sport,
      stat_type: statType,
      line: 20 + i,
      over_odds: -115,
      under_odds: -105,
      game_date: createdAt.toISOString().slice(0, 10),
      created_at: createdAt.toISOString(),
      source: 'phase15_test',
      provider: 'test',
      processed_at: null,
      error_message: null,
      meta: {
        test_batch: 'phase15_pro_pipeline',
        sport,
        stat_type: statType,
        created_for: 'professional_pipeline_e2e',
      },
    });
  }

  console.log('Inserting synthetic raw_props rows:', rows.length);

  const { data, error } = await client
    .from('raw_props')
    .insert(rows)
    .select('id, external_id, player_name, sport, league, stat_type, created_at');

  if (error) {
    console.error('INSERT_ERROR', error);
    process.exit(1);
  }

  console.log('INSERT_SUCCESS', JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('FATAL_ERROR', err);
  process.exit(1);
});

