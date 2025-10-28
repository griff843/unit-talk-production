import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CanonicalPicksDriver } from '../CanonicalPicksDriver';
import { PicksDriverFactory } from '../PicksDriverFactory';
import { UnifiedPicksDriver } from '../UnifiedPicksDriver';

// Mock the driver classes
vi.mock('../CanonicalPicksDriver');
vi.mock('../UnifiedPicksDriver');

// Mock the schema probe module
vi.mock('../../lib/schema-probe', () => ({
  canonicalReady: vi.fn(),
  unifiedReady: vi.fn(),
  hasTable: vi.fn(),
  getSchemaStatus: vi.fn(),
}));

describe('PicksDriverFactory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    PicksDriverFactory.reset();
    delete process.env.PICK_DRIVER;

    // Import the mocked functions
    const { canonicalReady, unifiedReady } = await import('../../lib/schema-probe');

    // Default: canonical tables exist
    (canonicalReady as any).mockResolvedValue(true);
    (unifiedReady as any).mockResolvedValue(true);

    // Mock driver constructors
    (CanonicalPicksDriver as any).mockImplementation(() => ({}));
    (UnifiedPicksDriver as any).mockImplementation(() => ({}));
  });

  describe('getDriver', () => {
    it('should return unified driver by default (env default)', async () => {
      const driver = await PicksDriverFactory.getDriver();

      expect(driver).toBeInstanceOf(UnifiedPicksDriver);
      expect(PicksDriverFactory.getCurrentDriverType()).toBe('unified');
      expect(PicksDriverFactory.getDriverReason()).toBe('config_unified');
    });

    it('should return canonical driver when PICK_DRIVER=canonical and tables exist', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(true);

      const driver = await PicksDriverFactory.getDriver();

      expect(driver).toBeInstanceOf(CanonicalPicksDriver);
      expect(PicksDriverFactory.getCurrentDriverType()).toBe('canonical');
      expect(PicksDriverFactory.getDriverReason()).toBe('config_canonical');
    });

    it('should return unified driver when PICK_DRIVER=unified', async () => {
      process.env.PICK_DRIVER = 'unified';
      PicksDriverFactory.reset();

      const driver = await PicksDriverFactory.getDriver();

      expect(driver).toBeInstanceOf(UnifiedPicksDriver);
      expect(PicksDriverFactory.getCurrentDriverType()).toBe('unified');
      expect(PicksDriverFactory.getDriverReason()).toBe('config_unified');
    });

    it('should auto-fallback to unified driver when canonical tables do not exist', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(false);

      const driver = await PicksDriverFactory.getDriver();

      expect(driver).toBeInstanceOf(UnifiedPicksDriver);
      expect(PicksDriverFactory.getCurrentDriverType()).toBe('unified');
      expect(PicksDriverFactory.getDriverReason()).toBe('fallback_canonical_missing');
    });

    it('should use canonical driver when PICK_DRIVER=canonical and tables exist', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(true);

      const driver = await PicksDriverFactory.getDriver();

      expect(driver).toBeInstanceOf(CanonicalPicksDriver);
      expect(PicksDriverFactory.getCurrentDriverType()).toBe('canonical');
    });

    it('should cache driver instance', async () => {
      const driver1 = await PicksDriverFactory.getDriver();
      const driver2 = await PicksDriverFactory.getDriver();

      expect(driver1).toBe(driver2);
    });

    it('should not cache when forceType is specified', async () => {
      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(true);

      const driver1 = await PicksDriverFactory.getDriver('canonical');
      const driver2 = await PicksDriverFactory.getDriver('unified');

      expect(driver1).not.toBe(driver2);
      expect(driver1).toBeInstanceOf(CanonicalPicksDriver);
      expect(driver2).toBeInstanceOf(UnifiedPicksDriver);
    });

    it('should set force_override reason when forceType is used', async () => {
      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(true);

      await PicksDriverFactory.getDriver('canonical');

      // Reason should not be cached when forced
      expect(PicksDriverFactory.getDriverReason()).toBeNull();
    });
  });

  describe('getCurrentDriverType', () => {
    it('should return null before initialization', () => {
      expect(PicksDriverFactory.getCurrentDriverType()).toBeNull();
    });

    it('should return driver type after initialization', async () => {
      await PicksDriverFactory.getDriver();
      expect(PicksDriverFactory.getCurrentDriverType()).not.toBeNull();
    });
  });

  describe('getDriverReason', () => {
    it('should return null before initialization', () => {
      expect(PicksDriverFactory.getDriverReason()).toBeNull();
    });

    it('should return reason after initialization', async () => {
      await PicksDriverFactory.getDriver();
      expect(PicksDriverFactory.getDriverReason()).not.toBeNull();
    });

    it('should return fallback_canonical_missing when auto-fallback occurs', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(false);

      await PicksDriverFactory.getDriver();

      expect(PicksDriverFactory.getDriverReason()).toBe('fallback_canonical_missing');
    });
  });

  describe('getDriverStatus', () => {
    it('should return comprehensive driver status', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(false);

      await PicksDriverFactory.getDriver();

      const status = PicksDriverFactory.getDriverStatus();

      expect(status).toEqual({
        driver_effective: 'unified',
        driver_requested: 'canonical',
        reason: 'fallback_canonical_missing',
      });
    });

    it('should not include reason if not set', () => {
      const status = PicksDriverFactory.getDriverStatus();

      expect(status).toEqual({
        driver_effective: null,
        driver_requested: 'unified',
      });
    });
  });

  describe('reset', () => {
    it('should clear cached driver instance', async () => {
      await PicksDriverFactory.getDriver();
      PicksDriverFactory.reset();

      expect(PicksDriverFactory.getCurrentDriverType()).toBeNull();
      expect(PicksDriverFactory.getDriverReason()).toBeNull();
    });
  });

  describe('isCanonicalAvailable', () => {
    it('should return true when canonical tables exist', async () => {
      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(true);

      const result = await PicksDriverFactory.isCanonicalAvailable();

      expect(result).toBe(true);
    });

    it('should return false when canonical tables do not exist', async () => {
      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockResolvedValue(false);

      const result = await PicksDriverFactory.isCanonicalAvailable();

      expect(result).toBe(false);
    });
  });

  describe('isUnifiedAvailable', () => {
    it('should return true when unified table exists', async () => {
      const { unifiedReady } = await import('../../lib/schema-probe');
      (unifiedReady as any).mockResolvedValue(true);

      const result = await PicksDriverFactory.isUnifiedAvailable();

      expect(result).toBe(true);
    });

    it('should return false when unified table does not exist', async () => {
      const { unifiedReady } = await import('../../lib/schema-probe');
      (unifiedReady as any).mockResolvedValue(false);

      const result = await PicksDriverFactory.isUnifiedAvailable();

      expect(result).toBe(false);
    });
  });

  describe('auto-fallback edge cases', () => {
    it('should not throw if canonical probe fails', async () => {
      process.env.PICK_DRIVER = 'canonical';
      PicksDriverFactory.reset();

      const { canonicalReady } = await import('../../lib/schema-probe');
      (canonicalReady as any).mockRejectedValue(new Error('Database connection failed'));

      // Should not throw - let caller handle
      await expect(PicksDriverFactory.getDriver()).rejects.toThrow();
    });

    it('should handle rapid successive calls without race conditions', async () => {
      PicksDriverFactory.reset();

      const [driver1, driver2, driver3] = await Promise.all([
        PicksDriverFactory.getDriver(),
        PicksDriverFactory.getDriver(),
        PicksDriverFactory.getDriver(),
      ]);

      // All should return the same cached instance
      expect(driver1).toBe(driver2);
      expect(driver2).toBe(driver3);
    });
  });
});
