import { RecapService } from '../../apps/api/src/agents/RecapAgent/recapService';

describe('RecapAgent from matview', () => {
  const url = process.env.SUPABASE_URL as string;
  const anon = process.env.SUPABASE_ANON_KEY as string;

  if (!url || !anon) {
    it('skipped (missing SUPABASE_URL/ANON)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it('produces non-empty daily recap payload', async () => {
    const recap = new RecapService({ microRecap: false });
    await recap.initialize();
    const today = new Date().toISOString().split('T')[0]!;
    const data = await recap.getDailyRecapData(today);

    expect(data).toBeDefined();
    if (data) {
      expect(typeof data.totalPicks).toBe('number');
      // embed should have at least title/description fields
      const embed = await recap.buildRecapEmbed(data);
      expect(embed).toBeDefined();
      expect(JSON.stringify(embed).length).toBeGreaterThan(10);
    }
  });
});

