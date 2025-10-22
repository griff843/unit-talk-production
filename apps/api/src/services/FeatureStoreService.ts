/**
 * Feature Store Service
 * 
 * Manages feature flags and configuration for the application.
 * Provides a centralized service for feature toggles and A/B testing.
 * 
 * @module services/FeatureStoreService
 * @since Phase 4 - Compile Green Stabilization
 */

import { env } from '../config/env';

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
}

/**
 * Feature Store Service for managing feature flags
 */
export class FeatureStoreService {
  private features: Map<string, FeatureFlag>;

  constructor() {
    this.features = new Map();
    this.initializeDefaultFeatures();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFeatures(): void {
    // Default features - can be overridden by environment or database
    this.setFeature({
      name: 'professional_grading',
      enabled: true,
      description: 'Enable professional grading system v2025'
    });

    this.setFeature({
      name: 'alert_system',
      enabled: true,
      description: 'Enable real-time alert system for hedges/middles/injuries'
    });

    this.setFeature({
      name: 'smart_form_bridge',
      enabled: true,
      description: 'Enable smart form to Discord bridge'
    });

    this.setFeature({
      name: 'temporal_workflows',
      enabled: true,
      description: 'Enable Temporal workflow orchestration'
    });
  }

  /**
   * Set or update a feature flag
   * 
   * @param feature - Feature flag configuration
   */
  setFeature(feature: FeatureFlag): void {
    this.features.set(feature.name, feature);
  }

  /**
   * Check if a feature is enabled
   * 
   * @param featureName - Name of the feature to check
   * @returns True if the feature is enabled
   */
  isEnabled(featureName: string): boolean {
    const feature = this.features.get(featureName);
    return feature?.enabled ?? false;
  }

  /**
   * Get a feature flag configuration
   * 
   * @param featureName - Name of the feature
   * @returns Feature flag configuration or undefined
   */
  getFeature(featureName: string): FeatureFlag | undefined {
    return this.features.get(featureName);
  }

  /**
   * Get all feature flags
   * 
   * @returns Array of all feature flags
   */
  getAllFeatures(): FeatureFlag[] {
    return Array.from(this.features.values());
  }

  /**
   * Enable a feature
   * 
   * @param featureName - Name of the feature to enable
   */
  enable(featureName: string): void {
    const feature = this.features.get(featureName);
    if (feature) {
      feature.enabled = true;
    }
  }

  /**
   * Disable a feature
   * 
   * @param featureName - Name of the feature to disable
   */
  disable(featureName: string): void {
    const feature = this.features.get(featureName);
    if (feature) {
      feature.enabled = false;
    }
  }

  /**
   * Check if a feature should be enabled for a specific user
   * (for gradual rollout/A/B testing)
   * 
   * @param featureName - Name of the feature
   * @param userId - User ID to check
   * @returns True if the feature should be enabled for this user
   */
  isEnabledForUser(featureName: string, userId: string): boolean {
    const feature = this.features.get(featureName);
    if (!feature || !feature.enabled) {
      return false;
    }

    // If no rollout percentage, feature is enabled for all
    if (!feature.rolloutPercentage) {
      return true;
    }

    // Simple hash-based rollout
    const hash = this.hashUserId(userId);
    return hash < feature.rolloutPercentage;
  }

  /**
   * Simple hash function for user ID
   * 
   * @param userId - User ID to hash
   * @returns Hash value between 0 and 100
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 100);
  }
}

/**
 * Singleton instance of FeatureStoreService
 */
let featureStoreInstance: FeatureStoreService | null = null;

/**
 * Get or create the singleton FeatureStoreService instance
 * 
 * @returns FeatureStoreService instance
 */
export function getFeatureStore(): FeatureStoreService {
  if (!featureStoreInstance) {
    featureStoreInstance = new FeatureStoreService();
  }
  return featureStoreInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetFeatureStore(): void {
  featureStoreInstance = null;
}

export default FeatureStoreService;

