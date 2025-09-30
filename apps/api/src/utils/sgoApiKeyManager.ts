/**
 * SGO API Key Manager
 *
 * Centralized management for Sports Game Odds API authentication.
 * Handles API key retrieval, validation, fallback mechanisms, and rate limiting.
 */

import { env } from '../config/env';
import { logger } from '../shared/logger';

export interface SGOApiConfig {
  apiKey: string;
  isValidated: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  lastUsed?: Date;
}

class SGOApiKeyManager {
  private config: SGOApiConfig | null = null;
  private lastValidation: Date | null = null;
  private validationCacheDuration = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the SGO API key with fallback support
   */
  getSGOApiKey(): string {
    // Try primary environment variable first
    const primaryKey = env.SGO_API_KEY;
    if (primaryKey && primaryKey.trim() !== '') {
      logger.debug('Using SGO_API_KEY from environment');
      return primaryKey.trim();
    }

    // Fallback to legacy environment variable names
    const fallbackKeys = [
      process.env.SPORTSGAMEODDS_KEY,
      process.env.SPORTSGAMEODDS_API_KEY,
      process.env.SGO_KEY
    ];

    for (const key of fallbackKeys) {
      if (key && key.trim() !== '') {
        logger.warn(`Using fallback SGO API key from legacy environment variable`);
        return key.trim();
      }
    }

    // No API key found
    throw new Error('SGO API key not found. Please set SGO_API_KEY or SPORTSGAMEODDS_KEY environment variable.');
  }

  /**
   * Validate API key format and basic structure
   */
  validateApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const trimmedKey = apiKey.trim();

    // Basic format validation - adjust based on actual SGO API key format
    if (trimmedKey.length < 10) {
      return false;
    }

    // Check for common invalid values
    const invalidKeys = [
      'your_sgo_api_key_here',
      'test_key',
      'mock_key',
      'placeholder'
    ];

    if (invalidKeys.includes(trimmedKey.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Get validated SGO API configuration
   */
  async getSGOApiConfig(): Promise<SGOApiConfig> {
    // Check if we have a cached valid configuration
    if (this.config && this.lastValidation &&
        (Date.now() - this.lastValidation.getTime()) < this.validationCacheDuration) {
      return this.config;
    }

    try {
      const apiKey = this.getSGOApiKey();

      if (!this.validateApiKeyFormat(apiKey)) {
        throw new Error('SGO API key format is invalid');
      }

      // Create configuration
      this.config = {
        apiKey,
        isValidated: true,
        lastUsed: new Date()
      };

      this.lastValidation = new Date();

      logger.info('SGO API key validated successfully');
      return this.config;

    } catch (error) {
      logger.error('SGO API key validation failed:', error);

      // Return invalidated configuration for graceful degradation
      this.config = {
        apiKey: '',
        isValidated: false
      };

      throw error;
    }
  }

  /**
   * Update rate limit information from API response headers
   */
  updateRateLimitInfo(headers: Record<string, string>): void {
    if (!this.config) return;

    // Common rate limit header patterns
    const rateLimitHeaders = [
      'x-ratelimit-remaining',
      'x-rate-limit-remaining',
      'ratelimit-remaining',
      'x-ratelimit-limit'
    ];

    const resetHeaders = [
      'x-ratelimit-reset',
      'x-rate-limit-reset',
      'ratelimit-reset'
    ];

    // Extract rate limit remaining
    for (const header of rateLimitHeaders) {
      const value = headers[header.toLowerCase()];
      if (value && !isNaN(parseInt(value))) {
        this.config.rateLimitRemaining = parseInt(value);
        break;
      }
    }

    // Extract rate limit reset time
    for (const header of resetHeaders) {
      const value = headers[header.toLowerCase()];
      if (value && !isNaN(parseInt(value))) {
        this.config.rateLimitReset = parseInt(value);
        break;
      }
    }

    logger.debug('Rate limit info updated:', {
      remaining: this.config.rateLimitRemaining,
      reset: this.config.rateLimitReset
    });
  }

  /**
   * Check if we're approaching rate limits
   */
  isNearRateLimit(): boolean {
    if (!this.config?.rateLimitRemaining) {
      return false;
    }

    // Conservative threshold - warn when less than 10% remaining
    const threshold = 10;
    return this.config.rateLimitRemaining <= threshold;
  }

  /**
   * Get rate limit status for monitoring
   */
  getRateLimitStatus(): {
    remaining?: number;
    reset?: number;
    nearLimit: boolean;
    lastUsed?: Date;
  } {
    return {
      remaining: this.config?.rateLimitRemaining,
      reset: this.config?.rateLimitReset,
      nearLimit: this.isNearRateLimit(),
      lastUsed: this.config?.lastUsed
    };
  }

  /**
   * Reset configuration (force re-validation)
   */
  reset(): void {
    this.config = null;
    this.lastValidation = null;
    logger.debug('SGO API key manager reset');
  }
}

// Export singleton instance
export const sgoApiKeyManager = new SGOApiKeyManager();

// Convenience function for backward compatibility
export function getSGOApiKey(): string {
  return sgoApiKeyManager.getSGOApiKey();
}

// Enhanced function with validation
export async function getValidatedSGOApiKey(): Promise<string> {
  const config = await sgoApiKeyManager.getSGOApiConfig();
  return config.apiKey;
}