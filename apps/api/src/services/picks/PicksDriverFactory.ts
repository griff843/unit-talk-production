import { canonicalReady } from '../../lib/schema-probe';
import { logger } from '../../shared/logger';

import { CanonicalPicksDriver } from './CanonicalPicksDriver';
import { UnifiedPicksDriver } from './UnifiedPicksDriver';

import type { IPicksDriver } from './types';

/**
 * Driver type configuration
 */
export type DriverType = 'unified' | 'canonical';

/**
 * Driver selection reason for observability
 */
export type DriverReason =
  | 'config_unified'
  | 'config_canonical'
  | 'fallback_canonical_missing'
  | 'force_override';

/**
 * PicksDriverFactory - Creates appropriate driver based on configuration
 *
 * Supports runtime DDL checks and automatic fallback to unified driver
 * if canonical tables are not available. Uses lightweight schema probes
 * instead of driver instantiation for startup performance.
 */
export class PicksDriverFactory {
  private static instance: IPicksDriver | null = null;
  private static driverType: DriverType | null = null;
  private static driverReason: DriverReason | null = null;

  /**
   * Get the configured picks driver with automatic fallback
   *
   * Flow:
   * 1. Check requested driver type (env var or default)
   * 2. If canonical requested, probe schema first
   * 3. If canonical tables missing, auto-fallback to unified
   * 4. Log decision with reason for observability
   *
   * @param forceType - Force a specific driver type (for testing)
   */
  static async getDriver(forceType?: DriverType): Promise<IPicksDriver> {
    // Return cached instance if available and no force type
    if (this.instance && !forceType) {
      return this.instance;
    }

    // Get driver type from environment or use default
    const requestedType: DriverType = (forceType ||
      process.env.PICK_DRIVER ||
      'unified') as DriverType;

    logger.info('Initializing picks driver', { requestedType, forced: !!forceType });

    // Create driver based on type with automatic fallback
    let driver: IPicksDriver;
    let effectiveType: DriverType;
    let reason: DriverReason;

    if (requestedType === 'canonical') {
      // Probe schema before driver instantiation to avoid errors
      const isCanonicalReady = await canonicalReady();

      if (!isCanonicalReady) {
        logger.warn(
          {
            event: 'driver_auto_fallback',
            from: 'canonical',
            to: 'unified',
            reason: 'Canonical tables (picks, pick_publish) missing',
          },
          'Canonical tables missing; falling back to unified'
        );
        driver = new UnifiedPicksDriver();
        effectiveType = 'unified';
        reason = 'fallback_canonical_missing';
      } else {
        driver = new CanonicalPicksDriver();
        effectiveType = 'canonical';
        reason = forceType ? 'force_override' : 'config_canonical';
      }
    } else {
      driver = new UnifiedPicksDriver();
      effectiveType = 'unified';
      reason = forceType ? 'force_override' : 'config_unified';
    }

    // Cache the instance if not forced
    if (!forceType) {
      this.instance = driver;
      this.driverType = effectiveType;
      this.driverReason = reason;
    }

    logger.info('Picks driver initialized successfully', {
      requestedType,
      effectiveType,
      reason,
      cached: !forceType,
    });

    return driver;
  }

  /**
   * Get the current driver type
   */
  static getCurrentDriverType(): DriverType | null {
    return this.driverType;
  }

  /**
   * Get the driver selection reason
   */
  static getDriverReason(): DriverReason | null {
    return this.driverReason;
  }

  /**
   * Get driver status for health/status endpoints
   */
  static getDriverStatus(): {
    driver_effective: DriverType | null;
    driver_requested: string;
    reason?: DriverReason;
  } {
    const requested = process.env.PICK_DRIVER || 'unified';
    return {
      driver_effective: this.driverType,
      driver_requested: requested,
      ...(this.driverReason && { reason: this.driverReason }),
    };
  }

  /**
   * Reset the cached driver (for testing)
   */
  static reset(): void {
    this.instance = null;
    this.driverType = null;
    this.driverReason = null;
  }

  /**
   * Check if canonical driver is available (uses lightweight schema probe)
   */
  static async isCanonicalAvailable(): Promise<boolean> {
    return canonicalReady();
  }

  /**
   * Check if unified driver is available (uses lightweight schema probe)
   */
  static async isUnifiedAvailable(): Promise<boolean> {
    const { unifiedReady } = await import('../../lib/schema-probe');
    return unifiedReady();
  }
}
