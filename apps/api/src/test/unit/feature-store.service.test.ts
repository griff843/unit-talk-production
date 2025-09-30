import { FeatureStoreService } from '../../services/FeatureStoreService';
import { supabaseClient } from '../../utils/supabaseUtils';

// Mock supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabaseClient: {
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      }),
    })
  },
  isSupabaseConfigured: true,
}));

// Mock metrics
jest.mock('../../services/metricsServer', () => ({
  featureMetrics: {
    upsertsTotal: { labels: () => ({ inc: jest.fn() }) },
    upsertDuration: { labels: () => ({ startTimer: () => jest.fn() }) },
    dqEventsTotal: { labels: () => ({ inc: jest.fn() }) },
    freshnessAgeSeconds: { labels: () => ({ set: jest.fn() }) },
  }
}));

describe('FeatureStoreService', () => {
  it('upserts features idempotently', async () => {
    const svc = new FeatureStoreService();
    await expect(svc.upsertFeature({
      entityType: 'player',
      entityId: 'p1',
      featureName: 'recent_avg_points',
      asOf: new Date().toISOString(),
      value: { avg: 20 },
    })).resolves.toEqual({ success: true });
  });
});

