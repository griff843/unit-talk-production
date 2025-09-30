import { AlertSystem } from '../../apps/api/src/services/AlertSystem';

describe('Alerts.cooldown live dedupe', () => {
  const unified_id = `jest-alert-${Date.now()}`;

  const url = process.env.SUPABASE_URL as string;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!url || !service) {
    it('skipped (missing SUPABASE_URL/SERVICE)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  test('dedupes identical alert back-to-back', async () => {
    const alerts = new AlertSystem();

    const first = await alerts.queueAlert({ unified_id, type: 'line_movement', signal_strength: 0.9 });
    const second = await alerts.queueAlert({ unified_id, type: 'line_movement', signal_strength: 0.9 });

    expect(first.success).toBe(true);
    expect(first.queued).toBe(true);

    expect(second.success).toBe(true);
    expect(second.queued).toBe(false);
    expect((second.reason || '').toLowerCase()).toMatch(/duplicate|cooldown/);
  });
});

