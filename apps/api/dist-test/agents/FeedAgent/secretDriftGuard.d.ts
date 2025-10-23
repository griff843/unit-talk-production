/**
 * Secret Drift Guard - Hot-reloadable secret management for FeedAgent
 * Prevents API key rotation downtime and provides fallback mechanisms
 */
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
export declare class SecretDriftGuard {
    private currentSecrets;
    private previousSecrets;
    private secretMetadata;
    constructor();
    /**
     * Load secrets from environment variables
     */
    private loadSecretsFromEnv;
    /**
     * Compute SHA-256 short hash for secrets
     */
    private computeHash;
    /**
     * Compute hashes for all secrets and emit to Command Center
     */
    private computeAndEmitHashes;
    /**
     * Emit secret hashes to Command Center for monitoring
     */
    private emitToCommandCenter;
    /**
     * Hot-reload secrets without container restart
     */
    reloadSecrets(newSecrets?: Partial<SecretConfig>): Promise<{
        success: boolean;
        updated: string[];
        failed: string[];
        error?: string;
    }>;
    /**
     * Test a secret by making a validation API call
     */
    private testSecret;
    /**
     * Test Odds API key validity
     */
    private testOddsApiKey;
    /**
     * Test Optimal API key validity
     */
    private testOptimalApiKey;
    /**
     * Get current secret with fallback capability
     */
    getSecret(key: keyof SecretConfig): string;
    /**
     * Get secret metadata for monitoring
     */
    getSecretMetadata(): Record<string, SecretMetadata>;
    /**
     * Health check for secret management
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'failed';
        secrets: Record<string, {
            status: string;
            hash: string;
            lastTested?: string;
        }>;
    }>;
}
export declare const secretDriftGuard: SecretDriftGuard;
//# sourceMappingURL=secretDriftGuard.d.ts.map