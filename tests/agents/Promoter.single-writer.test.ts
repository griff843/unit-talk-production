import { createClient } from '@supabase/supabase-js';

describe('Promoter.single-writer policy', () => {
  const url = process.env.SUPABASE_URL as string;
  const anon = process.env.SUPABASE_ANON_KEY as string;

  if (!url || !anon) {
    it('skipped (missing SUPABASE_URL/ANON)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it('direct app-role (anon) insert to unified_picks should be blocked by RLS', async () => {
    const anonClient = createClient(url, anon);

    const { error } = await anonClient
      .from('unified_picks')
      .insert({ sport: 'TEST', prediction: 'NONE', score: 0, tier: 'C' });

    expect(error).toBeTruthy();
  });
});

