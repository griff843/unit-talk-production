import { WeightConvergenceEngine, type ConvergenceMetrics } from '@/ml/ensemble/phase23-weight-convergence';
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

function createMockSupabase(insertResult: { error: any } = { error: null }) {
  const insertMock = jest.fn().mockResolvedValue(insertResult);
  const fromMock = jest.fn(() => ({ insert: insertMock }));
  const supabase = { from: fromMock } as any;
  return { supabase, fromMock, insertMock };
}

describe('WeightConvergenceEngine', () => {
  it('analyzeConvergence returns converged metrics for stable history', () => {
    const engine = new WeightConvergenceEngine(createMockLogger(), {} as any);
    const weights = new Map<string, number>([['model_a', 0.5], ['model_b', 0.5]]);
    const history = [
      { modelId: 'model_a', weight: 0.5, timestamp: new Date() },
      { modelId: 'model_a', weight: 0.5, timestamp: new Date() },
      { modelId: 'model_a', weight: 0.5, timestamp: new Date() }
    ];

    const metrics = engine.analyzeConvergence(weights, history);

    expect(metrics.variance).toBeCloseTo(0, 5);
    expect(metrics.oscillationScore).toBeCloseTo(0, 5);
    expect(metrics.isConverged).toBe(true);
    expect(metrics.convergenceRate).toBeGreaterThanOrEqual(0);
    expect(metrics.stabilityScore).toBeGreaterThan(0);
  });

  it('applyEMASmoothing uses previous smoothed weights', () => {
    const engine = new WeightConvergenceEngine(createMockLogger(), {} as any);
    const weights1 = new Map<string, number>([['model_a', 0]]);
    const weights2 = new Map<string, number>([['model_a', 1]]);

    const first = engine.applyEMASmoothing(weights1);
    const second = engine.applyEMASmoothing(weights2);

    expect(first.get('model_a')).toBeCloseTo(0, 5);
    // Default alpha is 0.3, so second smoothed value should move towards 1
    expect(second.get('model_a')).toBeGreaterThan(0);
    expect(second.get('model_a')).toBeLessThanOrEqual(1);
  });

  it('isConverged requires stability score above threshold', () => {
    const engine = new WeightConvergenceEngine(createMockLogger(), {} as any);

    const unstable: ConvergenceMetrics = {
      variance: 0,
      oscillationScore: 0,
      stabilityScore: 0.5,
      isConverged: true,
      convergenceRate: 1
    };

    const stable: ConvergenceMetrics = {
      variance: 0,
      oscillationScore: 0,
      stabilityScore: 0.9,
      isConverged: true,
      convergenceRate: 1
    };

    expect(engine.isConverged(unstable)).toBe(false);
    expect(engine.isConverged(stable)).toBe(true);
  });

  it('captureSnapshot writes to database and logs on success', async () => {
    const { supabase, insertMock } = createMockSupabase();
    const logger = createMockLogger();
    const engine = new WeightConvergenceEngine(logger, supabase);

    const weights = new Map<string, number>([
      ['model_a', 0.6],
      ['model_b', 0.4]
    ]);
    const metrics: ConvergenceMetrics = {
      variance: 0.001,
      oscillationScore: 0.01,
      stabilityScore: 0.9,
      isConverged: true,
      convergenceRate: 0.8
    };

    await engine.captureSnapshot(weights, metrics, 'tenant-123');

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect((logger as any).info).toHaveBeenCalled();
  });

  it('captureSnapshot logs error when database insert fails', async () => {
    const error = new Error('db error');
    const { supabase, insertMock } = createMockSupabase({ error });
    const logger = createMockLogger();
    const engine = new WeightConvergenceEngine(logger, supabase);

    const weights = new Map<string, number>([['model_a', 0.6]]);
    const metrics: ConvergenceMetrics = {
      variance: 0.1,
      oscillationScore: 0.2,
      stabilityScore: 0.7,
      isConverged: false,
      convergenceRate: 0.3
    };

    await engine.captureSnapshot(weights, metrics, 'tenant-123');

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect((logger as any).error).toHaveBeenCalled();
  });

  it('addWeightHistory bounds history size to prevent unbounded growth', () => {
    const engine = new WeightConvergenceEngine(createMockLogger(), {} as any);

    for (let i = 0; i < 1010; i++) {
      engine.addWeightHistory('model_a', i / 100);
    }

    const history = (engine as any).weightHistory.get('model_a') as any[];
    expect(history.length).toBeLessThanOrEqual(1000);
  });
});

