import { RouteOptimizer } from '@/ml/ensemble/phase23-route-optimizer';
import type { Logger } from '@/utils/logger';

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setAttribute: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn()
      }))
    }))
  }
}));

function createMockLogger(): Logger {
  const baseLogger: any = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    setLevel: jest.fn(),
    activity: jest.fn(),
    child: jest.fn()
  };
  baseLogger.child.mockReturnValue(baseLogger);
  return baseLogger as Logger;
}

function createMockSupabase(records: any[] = []) {
  const limitMock = jest.fn().mockResolvedValue({ data: records, error: null });
  const orderMock = jest.fn(() => ({ limit: limitMock }));
  const eqMock = jest.fn(() => ({ order: orderMock }));
  const inMock = jest.fn(() => ({ eq: eqMock }));
  const selectMock = jest.fn(() => ({ in: inMock }));
  const fromMock = jest.fn(() => ({ select: selectMock }));

  const supabase = { from: fromMock } as any;
  return { supabase, fromMock, limitMock };
}

describe('RouteOptimizer', () => {
  const validTenantId = '550e8400-e29b-41d4-a716-446655440000';

  it('throws when modelIds are empty', async () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);

    await expect(
      optimizer.optimizeRouting([], [1, 2, 3], validTenantId)
    ).rejects.toThrow('No models provided');
  });

  it('throws when features are empty', async () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);

    await expect(
      optimizer.optimizeRouting(['model_a'], [], validTenantId)
    ).rejects.toThrow('No features provided');
  });

  it('throws when tenantId is invalid UUID', async () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);

    await expect(
      optimizer.optimizeRouting(['model_a'], [0.1, 0.2], 'not-a-uuid')
    ).rejects.toThrow('Invalid tenant ID');
  });

  it('fetches routing decisions and caches result', async () => {
    const records = [
      { model_id: 'model_a', confidence_score: 0.9 },
      { model_id: 'model_b', confidence_score: 0.7 }
    ];
    const { supabase, limitMock } = createMockSupabase(records);
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);

    const modelIds = ['model_a', 'model_b'];
    const features = [0.1, 0.2, 0.3];

    const first = await optimizer.optimizeRouting(modelIds, features, validTenantId);
    expect(first).toHaveLength(2);
    expect(first[0]).toEqual(
      expect.objectContaining({
        modelId: expect.any(String),
        allocation: expect.any(Number),
        confidence: expect.any(Number),
        reason: expect.any(String)
      })
    );
    expect(limitMock).toHaveBeenCalledTimes(1);

    const second = await optimizer.optimizeRouting(modelIds, features, validTenantId);
    expect(second).toEqual(first);
    // Second call should be served from cache and not hit the database again
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it('provides allocation reasons for high, medium and low confidence', () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);
    const getReason = (optimizer as any).getAllocationReason.bind(optimizer);

    expect(getReason(0.95)).toBe('High confidence model');
    expect(getReason(0.87)).toBe('Medium confidence model');
    expect(getReason(0.5)).toBe('Low confidence model - reduced allocation');
  });

  it('LRU cache expires entries when TTL elapses', () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);
    const cache: any = (optimizer as any).cache;

    cache.set('key', [
      { modelId: 'm1', allocation: 1, confidence: 1, reason: 'test' }
    ]);

    const internalCache: Map<string, any> = cache.cache;
    const entry = internalCache.get('key');
    const ttlMs: number = cache.ttlMs;

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(entry.timestamp + ttlMs + 1);

    const result = cache.get('key');

    expect(result).toBeNull();
    expect(cache.size()).toBe(0);

    nowSpy.mockRestore();
  });

  it('LRU cache evicts least recently used entry when capacity is exceeded', () => {
    const { supabase } = createMockSupabase();
    const optimizer = new RouteOptimizer(createMockLogger(), supabase);
    const cache: any = (optimizer as any).cache;

    cache.maxSize = 1;

    cache.set('a', [
      { modelId: 'mA', allocation: 1, confidence: 0.9, reason: 'test' }
    ]);
    cache.set('b', [
      { modelId: 'mB', allocation: 1, confidence: 0.9, reason: 'test' }
    ]);

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).not.toBeNull();
  });
});

