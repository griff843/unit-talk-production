import { createClient } from '@supabase/supabase-js';

describe('Provider truth matches runtime_config and quota/backoff visible', () => {
  const url = process.env.SUPABASE_URL as string;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!url || !service) {
    it('skipped (missing SUPABASE_URL/SERVICE)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  const db = createClient(url, service);

  it('active provider and quota/backoff flags exist and are sensible', async () => {
    const { data, error } = await db
      .from('runtime_config')
      .select('key, value')
      .in('key', ['active_provider', 'provider_quota', 'checkApiQuota'])
      .order('key', { ascending: true });

    expect(error).toBeFalsy();
    expect(Array.isArray(data)).toBe(true);

    const map = new Map<string, any>();
    (data || []).forEach(r => map.set(r.key, r.value));

    const activeProvider = map.get('active_provider');
    const quota = map.get('provider_quota');
    const checkApiQuota = map.get('checkApiQuota');

    expect(typeof activeProvider).toBe('string');
    expect(activeProvider.length).toBeGreaterThan(0);

    expect(quota).toBeDefined();
    if (quota) {
      // allow object or JSON string
      const q = typeof quota === 'string' ? JSON.parse(quota) : quota;
      expect(typeof q.limitPerHour).toBe('number');
      expect(q.limitPerHour).toBeGreaterThan(0);
    }

    expect(checkApiQuota === true || checkApiQuota === 'true').toBe(true);
  });
});

