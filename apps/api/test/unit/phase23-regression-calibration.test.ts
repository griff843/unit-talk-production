import {
  ElasticNetCLVRegressor,
  DriftCalibrator,
  AgreementScorer,
  type RegressionMetrics,
  type DriftAlert
} from '@/ml/ensemble/phase23-regression-calibration';
import type { Logger } from '@/utils/logger';

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

describe('ElasticNetCLVRegressor', () => {
  it('computes regression metrics for valid inputs', () => {
    const logger = createMockLogger();
    const regressor = new ElasticNetCLVRegressor(logger);

    const X: readonly (readonly number[])[] = [[1, 2], [2, 3], [3, 4]];
    const y: readonly number[] = [1, 2, 3];

    const metrics: RegressionMetrics = regressor.fit(X, y);

    expect(metrics).toEqual(
      expect.objectContaining({
        mse: expect.any(Number),
        rmse: expect.any(Number),
        mae: expect.any(Number),
        r2: expect.any(Number),
        accuracy: expect.any(Number)
      })
    );
    expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(metrics.accuracy).toBeLessThanOrEqual(1);
  });

  it('throws when X and y length mismatch', () => {
    const logger = createMockLogger();
    const regressor = new ElasticNetCLVRegressor(logger);

    const X: readonly (readonly number[])[] = [[1, 2], [2, 3]];
    const y: readonly number[] = [1];

    expect(() => regressor.fit(X, y)).toThrow('X and y length mismatch');
    expect((logger as any).error).toHaveBeenCalled();
  });

  it('predict returns constant baseline values', () => {
    const regressor = new ElasticNetCLVRegressor(createMockLogger());
    const X: readonly (readonly number[])[] = [[1, 2], [3, 4], [5, 6]];

    const predictions = regressor.predict(X);

    expect(predictions).toHaveLength(3);
    predictions.forEach(value => {
      expect(value).toBeCloseTo(0.5, 5);
    });
  });
});

describe('DriftCalibrator', () => {
  it('returns null when there are not enough samples', () => {
    const calibrator = new DriftCalibrator(createMockLogger());
    const scores = [0.4, 0.5, 0.6];

    const result = calibrator.detectDrift(scores);
    expect(result).toBeNull();
  });

  it('emits critical alert when smoothed score exceeds critical threshold', () => {
    const calibrator = new DriftCalibrator(createMockLogger());
    const scores = new Array(10).fill(0.9);

    const result = calibrator.detectDrift(scores) as DriftAlert | null;

    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
    expect(result?.score).toBeGreaterThanOrEqual(0.7);
  });

  it('uses previous smoothed score for subsequent calls', () => {
    const calibrator = new DriftCalibrator(createMockLogger());
    const lowScores = new Array(10).fill(0.2);
    const highScores = new Array(10).fill(1.0);

    const first = calibrator.detectDrift(lowScores);
    const second = calibrator.detectDrift(highScores);

    // First call should not trigger alert due to low scores
    expect(first).toBeNull();
    // Second call should still be below warning threshold because of EWMA smoothing
    expect(second).toBeNull();
  });
});

describe('AgreementScorer', () => {
  it('returns 1.0 when fewer than two predictions are provided', () => {
    const scorer = new AgreementScorer(createMockLogger());
    const predictions = new Map<string, number>([['model_a', 0.5]]);

    const score = scorer.scoreAgreement(predictions);
    expect(score).toBe(1.0);
  });

  it('returns 1.0 when all predictions are identical', () => {
    const scorer = new AgreementScorer(createMockLogger());
    const predictions = new Map<string, number>([['model_a', 1], ['model_b', 1]]);

    const score = scorer.scoreAgreement(predictions);
    expect(score).toBe(1.0);
  });

  it('returns value between 0 and 1 for varying predictions', () => {
    const scorer = new AgreementScorer(createMockLogger());
    const predictions = new Map<string, number>([['model_a', 0], ['model_b', 1]]);

    const score = scorer.scoreAgreement(predictions);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns neutral score when an error occurs', () => {
    const scorer = new AgreementScorer(createMockLogger());
    const badPredictions: any = {
      size: 2,
      values: () => {
        throw new Error('boom');
      }
    };

    const score = scorer.scoreAgreement(badPredictions as Map<string, number>);
    expect(score).toBe(0.5);
  });
});

