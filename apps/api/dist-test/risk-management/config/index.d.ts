/**
 * Risk Management Configuration
 *
 * Configuration types and default settings for the Phase 7 Risk Management system.
 * Provides production-ready defaults with environment-based overrides.
 */
import { RiskManagementConfig, KellyConfig, CorrelationConfig, PortfolioConfig, AlertConfig, MonitoringConfig, RiskProfile } from '../types';
export declare const DEFAULT_KELLY_CONFIG: KellyConfig;
export declare const DEFAULT_CORRELATION_CONFIG: CorrelationConfig;
export declare const DEFAULT_PORTFOLIO_CONFIG: PortfolioConfig;
export declare const DEFAULT_ALERT_CONFIG: AlertConfig;
export declare const DEFAULT_MONITORING_CONFIG: MonitoringConfig;
export declare const CONSERVATIVE_RISK_PROFILE: Partial<RiskProfile>;
export declare const MODERATE_RISK_PROFILE: Partial<RiskProfile>;
export declare const AGGRESSIVE_RISK_PROFILE: Partial<RiskProfile>;
export declare class RiskManagementConfigFactory {
    /**
     * Create complete risk management configuration
     */
    static createConfig(overrides?: Partial<RiskManagementConfig>): RiskManagementConfig;
    /**
     * Create risk profile from template
     */
    static createRiskProfile(template: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE', overrides?: Partial<RiskProfile>): RiskProfile;
    /**
     * Create configuration from environment variables
     */
    static createFromEnvironment(): RiskManagementConfig;
    /**
     * Validate configuration
     */
    static validateConfig(config: RiskManagementConfig): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Get production-ready configuration
     */
    static getProductionConfig(): RiskManagementConfig;
    /**
     * Get development configuration
     */
    static getDevelopmentConfig(): RiskManagementConfig;
}
export declare const PRODUCTION_CONFIG: RiskManagementConfig;
export declare const DEVELOPMENT_CONFIG: RiskManagementConfig;
export { RiskManagementConfig, KellyConfig, CorrelationConfig, PortfolioConfig, AlertConfig, MonitoringConfig, RiskProfile };
//# sourceMappingURL=index.d.ts.map