/**
 * Secret Drift Guard - Hot-reloadable secret management for FeedAgent
 * Prevents API key rotation downtime and provides fallback mechanisms
 */

import crypto from 'crypto';
// Note: Using console.log instead of Logger to avoid import issues

export interface SecretConfig {
  odds_api_key: string;
  optimal_api_key: string;
  [key: string]: string;
}

export interface SecretMetadata {
  hash: string;
  lastUpdated: Date;
  version: number;
}

class SecretDriftGuard {
  private currentSecrets: SecretConfig;
  private previousSecrets: SecretConfig | null = null;
  private secretMetadata: Map<string, SecretMetadata> = new Map();
  // Use console logging instead of Logger

  constructor() {
    this.currentSecrets = this.loadSecretsFromEnv();
    this.computeAndEmitHashes();
  }

  /**
   * Load secrets from environment variables
   */
  private loadSecretsFromEnv(): SecretConfig {
    return {
      odds_api_key: process.env.ODDS_API_KEY || '8014c48eb8a05f289de049c0961ac4cf',
      optimal_api_key: process.env.OPTIMAL_API_KEY || 'optimalbet_LZsTNl2SGX0o9Bz9GhLurvSTQuAMQapp'
    };
  }

  /**
   * Compute SHA-256 short hash for secrets
   */
  private computeHash(secret: string): string {
    return crypto.createHash('sha256')
      .update(secret)
      .digest('hex')
      .substring(0, 8); // Short hash for logging/identification
  }

  /**
   * Compute hashes for all secrets and emit to Command Center
   */
  private computeAndEmitHashes(): void {
    Object.entries(this.currentSecrets).forEach(([key, value]) => {
      const hash = this.computeHash(value);
      const metadata: SecretMetadata = {
        hash,
        lastUpdated: new Date(),
        version: (this.secretMetadata.get(key)?.version || 0) + 1
      };
      
      this.secretMetadata.set(key, metadata);
      
      console.log(`Secret ${key} loaded`, {
        hash,
        version: metadata.version,
        timestamp: metadata.lastUpdated.toISOString()
      });
    });

    // Emit to Command Center (would integrate with actual telemetry)
    this.emitToCommandCenter();
  }

  /**
   * Emit secret hashes to Command Center for monitoring
   */
  private emitToCommandCenter(): void {
    const secretHashes = Object.fromEntries(
      Array.from(this.secretMetadata.entries()).map(([key, metadata]) => [
        key,
        {
          hash: metadata.hash,
          version: metadata.version,
          lastUpdated: metadata.lastUpdated.toISOString()
        }
      ])
    );

    // TODO: Integrate with actual Command Center telemetry endpoint
    console.log('Secret hashes emitted to Command Center', { secretHashes });
  }

  /**
   * Hot-reload secrets without container restart
   */
  async reloadSecrets(newSecrets?: Partial<SecretConfig>): Promise<{
    success: boolean;
    updated: string[];
    failed: string[];
    error?: string;
  }> {
    try {
      console.log('Starting secret hot-reload...');
      
      // Store current secrets as previous
      this.previousSecrets = { ...this.currentSecrets };
      
      // Load new secrets (from env or provided)
      const newSecretConfig = newSecrets 
        ? { ...this.currentSecrets, ...newSecrets }
        : this.loadSecretsFromEnv();
      
      const updated: string[] = [];
      const failed: string[] = [];
      
      // Test each new secret
      for (const [key, newValue] of Object.entries(newSecretConfig)) {
        if (newValue !== this.currentSecrets[key]) {
          const testResult = await this.testSecret(key, newValue);
          
          if (testResult.success) {
            this.currentSecrets[key] = newValue;
            updated.push(key);
            console.log(`Secret ${key} successfully updated`);
          } else {
            failed.push(key);
            console.error(`Secret ${key} test failed: ${testResult.error}`);
          }
        }
      }
      
      // Recompute hashes for updated secrets
      if (updated.length > 0) {
        this.computeAndEmitHashes();
      }
      
      return {
        success: failed.length === 0,
        updated,
        failed
      };
      
    } catch (error) {
      console.error('Secret reload failed:', error);
      
      // Restore previous secrets on failure
      if (this.previousSecrets) {
        this.currentSecrets = this.previousSecrets;
        console.log('Restored previous secrets after reload failure');
      }
      
      return {
        success: false,
        updated: [],
        failed: Object.keys(newSecrets || this.currentSecrets),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test a secret by making a validation API call
   */
  private async testSecret(key: string, value: string): Promise<{ success: boolean; error?: string }> {
    try {
      switch (key) {
        case 'odds_api_key':
          return await this.testOddsApiKey(value);
        case 'optimal_api_key':
          return await this.testOptimalApiKey(value);
        default:
          return { success: true }; // Unknown key, assume valid
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Odds API key validity
   */
  private async testOddsApiKey(key: string): Promise<{ success: boolean; error?: string }> {
    const timeout = 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${key}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        return { success: true };
      } else if (response.status === 401) {
        return { success: false, error: 'Invalid API key' };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Test Optimal API key validity
   */
  private async testOptimalApiKey(key: string): Promise<{ success: boolean; error?: string }> {
    const timeout = 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch('https://api.optimalbet.com/api/sports', {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        return { success: true };
      } else if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Invalid API key' };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get current secret with fallback capability
   */
  getSecret(key: keyof SecretConfig): string {
    const current = this.currentSecrets[key];
    if (current) return current;

    // Fallback to previous secret if current fails
    if (this.previousSecrets && this.previousSecrets[key]) {
      console.warn(`Using fallback secret for ${key}`);
      return this.previousSecrets[key];
    }

    throw new Error(`Secret ${key} not found and no fallback available`);
  }

  /**
   * Get secret metadata for monitoring
   */
  getSecretMetadata(): Record<string, SecretMetadata> {
    return Object.fromEntries(this.secretMetadata.entries());
  }

  /**
   * Health check for secret management
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'failed';
    secrets: Record<string, { status: string; hash: string; lastTested?: string }>;
  }> {
    const secrets: Record<string, { status: string; hash: string; lastTested?: string }> = {};
    let overallStatus: 'healthy' | 'degraded' | 'failed' = 'healthy';

    for (const [key, value] of Object.entries(this.currentSecrets)) {
      const metadata = this.secretMetadata.get(key);
      const testResult = await this.testSecret(key, value);
      
      secrets[key] = {
        status: testResult.success ? 'healthy' : 'failed',
        hash: metadata?.hash || 'unknown',
        lastTested: new Date().toISOString()
      };

      if (!testResult.success) {
        overallStatus = overallStatus === 'healthy' ? 'degraded' : 'failed';
      }
    }

    return { status: overallStatus, secrets };
  }
}

// Singleton instance
export const secretDriftGuard = new SecretDriftGuard();