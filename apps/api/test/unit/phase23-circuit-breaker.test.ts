import { CircuitBreaker, retryWithBackoff } from '@/ml/ensemble/phase23-circuit-breaker';
import type { Logger } from '@/utils/logger';

describe('CircuitBreaker', () => {
  let logger: Logger;
  let breaker: CircuitBreaker;

  beforeEach(() => {
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
    logger = baseLogger as Logger;

    // Use very small timeout to avoid slow tests
    breaker = new CircuitBreaker(logger, 'test-service', {
      timeout: 5,
      resetTimeout: 5,
      errorThresholdPercentage: 50
    });
  });

  it('executes function successfully when circuit is closed', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await breaker.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe('closed');
  });

  it('opens circuit after failures exceed threshold', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
  });

  it('rejects calls immediately when circuit is open and reset timeout not reached', async () => {
    const now = Date.now();
    (breaker as any).state = 'open';
    (breaker as any).lastFailureTime = now;

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is open');
  });

  it('allows half-open reset after timeout and closes again on success', async () => {
    // simulate an open circuit whose reset timeout has elapsed
    (breaker as any).state = 'open';
    (breaker as any).lastFailureTime = Date.now() - 1000;

    const fn = jest.fn().mockResolvedValue('ok');
    const result = await breaker.execute(fn);

    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('retries failed operations with backoff and eventually succeeds', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce('ok');

    // Use a breaker configured so a single failure does not open the circuit
    const retryingBreaker = new CircuitBreaker(logger, 'test-service', {
      timeout: 5,
      resetTimeout: 5,
      errorThresholdPercentage: 101
    });

    // Override private sleep to avoid real time delays
    (retryingBreaker as any).sleep = jest.fn().mockResolvedValue(undefined);

    const result = await retryingBreaker.executeWithRetry(fn, 2);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect((retryingBreaker as any).sleep).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries without additional sleep on last attempt', async () => {
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(new Error('permanent'));

    const retryingBreaker = new CircuitBreaker(logger, 'test-service', {
      timeout: 5,
      resetTimeout: 5,
      errorThresholdPercentage: 101
    });

    (retryingBreaker as any).sleep = jest.fn().mockResolvedValue(undefined);

    await expect(retryingBreaker.executeWithRetry(fn, 1)).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
    expect((retryingBreaker as any).sleep).not.toHaveBeenCalled();
  });

  it('can be reset back to closed state', () => {
    (breaker as any).state = 'open';
    (breaker as any).failureCount = 5;
    (breaker as any).successCount = 2;

    breaker.reset();

    expect(breaker.getState()).toBe('closed');
    expect((breaker as any).failureCount).toBe(0);
    expect((breaker as any).successCount).toBe(0);
  });
});

describe('retryWithBackoff', () => {
  it('resolves when function succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and throws the last error after max retries', async () => {
    const error = new Error('backoff-fail');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow('backoff-fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws generic error when configured with zero retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('should-not-be-called'));

    await expect(retryWithBackoff(fn, 0, 1)).rejects.toThrow('Failed after 0 retries');
    expect(fn).not.toHaveBeenCalled();
  });
});
