/**
 * AlertAgent V2 — Cooldown Manager
 *
 * In-process TTL cache for per-alert-type cooldown enforcement.
 * NOTE: This is local-only (single process). For distributed deployments
 * a shared cache (Redis / DB) should replace this.
 * TODO: Replace with distributed cache for multi-instance deployments.
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import { AlertType, CooldownWindowsConfig, DEFAULT_COOLDOWN_WINDOWS } from './types';

interface CooldownEntry {
  expiresAt: number; // epoch ms
}

export class CooldownManager {
  /** Map<alert_key, CooldownEntry> */
  private cache: Map<string, CooldownEntry> = new Map();
  private windows: CooldownWindowsConfig;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(windows?: Partial<CooldownWindowsConfig>) {
    this.windows = { ...DEFAULT_COOLDOWN_WINDOWS, ...windows };
    // Run cleanup every 60 seconds to evict expired entries
    this.cleanupIntervalId = setInterval(() => this.evictExpired(), 60_000);
  }

  /**
   * Check if an alert key is currently in cooldown.
   * Returns true if the key should be suppressed.
   */
  isInCooldown(alertKey: string): boolean {
    const entry = this.cache.get(alertKey);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(alertKey);
      return false;
    }
    return true;
  }

  /**
   * Record an alert key with cooldown TTL based on alert type.
   */
  setCooldown(alertKey: string, alertType: AlertType): void {
    // eslint-disable-next-line security/detect-object-injection
    const windowMs = this.windows[alertType] ?? DEFAULT_COOLDOWN_WINDOWS.line_movement;
    this.cache.set(alertKey, { expiresAt: Date.now() + windowMs });
  }

  /**
   * Check cooldown AND set it in one atomic-like operation.
   * Returns true if the alert is allowed (not in cooldown).
   * Returns false if the alert is suppressed (in cooldown).
   */
  tryAcquire(alertKey: string, alertType: AlertType): boolean {
    if (this.isInCooldown(alertKey)) {
      return false;
    }
    this.setCooldown(alertKey, alertType);
    return true;
  }

  /**
   * Get the cooldown window (ms) for a given alert type.
   */
  getWindowMs(alertType: AlertType): number {
    // eslint-disable-next-line security/detect-object-injection
    return this.windows[alertType] ?? DEFAULT_COOLDOWN_WINDOWS.line_movement;
  }

  /**
   * Get cache size (for monitoring / testing).
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cooldowns (for testing).
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop the background cleanup interval.
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.cache.clear();
  }

  /**
   * Evict expired entries from the cache.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
