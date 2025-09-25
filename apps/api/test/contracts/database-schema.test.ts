import { supabaseClient } from '../../src/services/supabase/singleton';

// Minimal contract checks to ensure key tables are queryable
// Uses mocked Supabase from test/setup.ts to avoid external I/O

describe('Database schema contracts', () => {
  it('unified_picks table should be selectable', async () => {
    const supabase = supabaseClient as any;
    expect(supabase).toBeTruthy();

    const { data, error } = await supabase.from('unified_picks').select('*').limit(0);
    expect(error).toBeNull();
    expect(Array.isArray(data) || data === null).toBe(true);
  });

  it('raw_props table should be selectable', async () => {
    const supabase = supabaseClient as any;
    const { error } = await supabase.from('raw_props').select('*').limit(0);
    expect(error).toBeNull();
  });
});

