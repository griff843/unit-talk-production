"use strict";
/**
 * Risk Management Configuration
 *
 * Configuration types and default settings for the Phase 7 Risk Management system.
 * Provides production-ready defaults with environment-based overrides.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVELOPMENT_CONFIG = exports.PRODUCTION_CONFIG = exports.RiskManagementConfigFactory = exports.AGGRESSIVE_RISK_PROFILE = exports.MODERATE_RISK_PROFILE = exports.CONSERVATIVE_RISK_PROFILE = exports.DEFAULT_MONITORING_CONFIG = exports.DEFAULT_ALERT_CONFIG = exports.DEFAULT_PORTFOLIO_CONFIG = exports.DEFAULT_CORRELATION_CONFIG = exports.DEFAULT_KELLY_CONFIG = void 0;
// ========================================
// Default Configurations
// ========================================
exports.DEFAULT_KELLY_CONFIG = {
    defaultMultiplier: 0.25, // Conservative 25% Kelly
    maxKellyFraction: 0.25, // Never exceed 25% of bankroll
    minEdgeThreshold: 0.02, // Minimum 2% edge required
    confidenceAdjustment: true, // Enable confidence-based adjustments
    correlationAdjustment: true, // Enable correlation-based adjustments
    bankrollFrequency: 'DAILY' // Update bankroll daily
};
exports.DEFAULT_CORRELATION_CONFIG = {
    calculationMethod: 'PEARSON', // Pearson correlation coefficient
    windowSize: 252, // 1 year of trading days
    updateFrequency: 4, // Update every 4 hours
    significanceThreshold: 0.5, // 50% correlation significance threshold
    clusteringEnabled: true // Enable correlation clustering
};
exports.DEFAULT_PORTFOLIO_CONFIG = {
    maxPositions: 50, // Maximum 50 simultaneous positions
    rebalanceFrequency: 'DAILY', // Rebalance daily
    optimizationTarget: 'SHARPE', // Optimize for Sharpe ratio
    constraintsEnabled: true, // Enable optimization constraints
    liquidityRequirement: 0.8 // 80% minimum liquidity requirement
};
exports.DEFAULT_ALERT_CONFIG = {
    enabledTypes: ['EXPOSURE', 'CORRELATION', 'DRAWDOWN', 'VAR', 'CONCENTRATION', 'KELLY', 'VOLATILITY'],
    severityThresholds: {
        LOW: 0.05,
        MEDIUM: 0.10,
        HIGH: 0.15,
        CRITICAL: 0.20
    },
    notificationChannels: ['DISCORD', 'WEBHOOK'],
    autoResolution: true, // Enable automatic alert resolution
    suppressionDuration: 60 // Suppress similar alerts for 1 hour
};
exports.DEFAULT_MONITORING_CONFIG = {
    updateFrequency: 30, // Update every 30 seconds
    dashboardRefresh: 5, // Refresh dashboard every 5 seconds
    metricsRetention: 365, // Retain metrics for 1 year
    enableRealTimeAlerts: true, // Enable real-time alerting
    performanceTracking: true // Enable performance tracking
};
// ========================================
// Risk Profile Templates
// ========================================
exports.CONSERVATIVE_RISK_PROFILE = {
    maxBetPercentage: 0.03, // 3% max per bet
    maxDailyExposure: 0.15, // 15% max daily exposure
    maxWeeklyExposure: 0.50, // 50% max weekly exposure
    maxGameExposure: 0.10, // 10% max per game
    maxPlayerExposure: 0.05, // 5% max per player
    maxSportExposure: 0.25, // 25% max per sport
    kellyMultiplier: 0.20, // 20% Kelly multiplier
    riskTolerance: 'CONSERVATIVE',
    correlationLimits: {
        maxGameCorrelation: 0.10,
        maxPlayerCorrelation: 0.05,
        maxSportCorrelation: 0.25,
        maxTimeCorrelation: 0.30,
        maxPositionCorrelation: 0.60
    },
    varianceTargets: {
        dailyVarianceLimit: 0.02,
        weeklyVarianceLimit: 0.08,
        monthlyVarianceLimit: 0.15,
        maxVolatility: 0.10,
        targetSharpeRatio: 2.0
    },
    drawdownTriggers: {
        maxDrawdown: 0.10,
        emergencyStopDrawdown: 0.15,
        positionReductionDrawdown: 0.08,
        alertDrawdown: 0.05
    }
};
exports.MODERATE_RISK_PROFILE = {
    maxBetPercentage: 0.05, // 5% max per bet
    maxDailyExposure: 0.25, // 25% max daily exposure
    maxWeeklyExposure: 0.70, // 70% max weekly exposure
    maxGameExposure: 0.15, // 15% max per game
    maxPlayerExposure: 0.08, // 8% max per player
    maxSportExposure: 0.30, // 30% max per sport
    kellyMultiplier: 0.25, // 25% Kelly multiplier
    riskTolerance: 'MODERATE',
    correlationLimits: {
        maxGameCorrelation: 0.15,
        maxPlayerCorrelation: 0.08,
        maxSportCorrelation: 0.30,
        maxTimeCorrelation: 0.40,
        maxPositionCorrelation: 0.70
    },
    varianceTargets: {
        dailyVarianceLimit: 0.04,
        weeklyVarianceLimit: 0.12,
        monthlyVarianceLimit: 0.20,
        maxVolatility: 0.15,
        targetSharpeRatio: 1.5
    },
    drawdownTriggers: {
        maxDrawdown: 0.15,
        emergencyStopDrawdown: 0.20,
        positionReductionDrawdown: 0.10,
        alertDrawdown: 0.08
    }
};
exports.AGGRESSIVE_RISK_PROFILE = {
    maxBetPercentage: 0.08, // 8% max per bet
    maxDailyExposure: 0.40, // 40% max daily exposure
    maxWeeklyExposure: 0.85, // 85% max weekly exposure
    maxGameExposure: 0.20, // 20% max per game
    maxPlayerExposure: 0.12, // 12% max per player
    maxSportExposure: 0.40, // 40% max per sport
    kellyMultiplier: 0.30, // 30% Kelly multiplier
    riskTolerance: 'AGGRESSIVE',
    correlationLimits: {
        maxGameCorrelation: 0.20,
        maxPlayerCorrelation: 0.12,
        maxSportCorrelation: 0.40,
        maxTimeCorrelation: 0.50,
        maxPositionCorrelation: 0.80
    },
    varianceTargets: {
        dailyVarianceLimit: 0.08,
        weeklyVarianceLimit: 0.18,
        monthlyVarianceLimit: 0.30,
        maxVolatility: 0.25,
        targetSharpeRatio: 1.2
    },
    drawdownTriggers: {
        maxDrawdown: 0.20,
        emergencyStopDrawdown: 0.25,
        positionReductionDrawdown: 0.15,
        alertDrawdown: 0.12
    }
};
// ========================================
// Configuration Factory
// ========================================
class RiskManagementConfigFactory {
    /**
     * Create complete risk management configuration
     */
    static createConfig(overrides) {
        const baseConfig = {
            kelly: exports.DEFAULT_KELLY_CONFIG,
            correlation: exports.DEFAULT_CORRELATION_CONFIG,
            portfolio: exports.DEFAULT_PORTFOLIO_CONFIG,
            alerts: exports.DEFAULT_ALERT_CONFIG,
            monitoring: exports.DEFAULT_MONITORING_CONFIG
        };
        if (!overrides)
            return baseConfig;
        return {
            kelly: { ...baseConfig.kelly, ...overrides.kelly },
            correlation: { ...baseConfig.correlation, ...overrides.correlation },
            portfolio: { ...baseConfig.portfolio, ...overrides.portfolio },
            alerts: { ...baseConfig.alerts, ...overrides.alerts },
            monitoring: { ...baseConfig.monitoring, ...overrides.monitoring }
        };
    }
    /**
     * Create risk profile from template
     */
    static createRiskProfile(template, overrides) {
        const templates = {
            CONSERVATIVE: exports.CONSERVATIVE_RISK_PROFILE,
            MODERATE: exports.MODERATE_RISK_PROFILE,
            AGGRESSIVE: exports.AGGRESSIVE_RISK_PROFILE
        };
        const baseProfile = templates[template];
        const profileId = `risk-profile-${template.toLowerCase()}-${Date.now()}`;
        const profile = {
            id: profileId,
            bankroll: 10000, // Default $10,000 bankroll
            maxBetPercentage: 0.05,
            maxDailyExposure: 0.25,
            maxWeeklyExposure: 0.70,
            maxGameExposure: 0.15,
            maxPlayerExposure: 0.08,
            maxSportExposure: 0.30,
            correlationLimits: {
                maxGameCorrelation: 0.15,
                maxPlayerCorrelation: 0.08,
                maxSportCorrelation: 0.30,
                maxTimeCorrelation: 0.40,
                maxPositionCorrelation: 0.70
            },
            varianceTargets: {
                dailyVarianceLimit: 0.04,
                weeklyVarianceLimit: 0.12,
                monthlyVarianceLimit: 0.20,
                maxVolatility: 0.15,
                targetSharpeRatio: 1.5
            },
            drawdownTriggers: {
                maxDrawdown: 0.15,
                emergencyStopDrawdown: 0.20,
                positionReductionDrawdown: 0.10,
                alertDrawdown: 0.08
            },
            kellyMultiplier: 0.25,
            riskTolerance: 'MODERATE',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            ...baseProfile,
            ...overrides
        };
        return profile;
    }
    /**
     * Create configuration from environment variables
     */
    static createFromEnvironment() {
        const config = this.createConfig();
        // Override with environment variables if present
        if (process.env.KELLY_MULTIPLIER) {
            config.kelly.defaultMultiplier = parseFloat(process.env.KELLY_MULTIPLIER);
        }
        if (process.env.MAX_KELLY_FRACTION) {
            config.kelly.maxKellyFraction = parseFloat(process.env.MAX_KELLY_FRACTION);
        }
        if (process.env.MIN_EDGE_THRESHOLD) {
            config.kelly.minEdgeThreshold = parseFloat(process.env.MIN_EDGE_THRESHOLD);
        }
        if (process.env.CORRELATION_THRESHOLD) {
            config.correlation.significanceThreshold = parseFloat(process.env.CORRELATION_THRESHOLD);
        }
        if (process.env.MAX_POSITIONS) {
            config.portfolio.maxPositions = parseInt(process.env.MAX_POSITIONS);
        }
        if (process.env.RISK_UPDATE_FREQUENCY) {
            config.monitoring.updateFrequency = parseInt(process.env.RISK_UPDATE_FREQUENCY);
        }
        return config;
    }
    /**
     * Validate configuration
     */
    static validateConfig(config) {
        const errors = [];
        const warnings = [];
        // Validate Kelly configuration
        if (config.kelly.defaultMultiplier <= 0 || config.kelly.defaultMultiplier > 1) {
            errors.push('Kelly multiplier must be between 0 and 1');
        }
        if (config.kelly.maxKellyFraction <= 0 || config.kelly.maxKellyFraction > 0.5) {
            errors.push('Max Kelly fraction must be between 0 and 0.5');
        }
        if (config.kelly.minEdgeThreshold < 0) {
            errors.push('Min edge threshold cannot be negative');
        }
        // Validate correlation configuration
        if (config.correlation.windowSize < 30) {
            warnings.push('Correlation window size less than 30 days may be unreliable');
        }
        if (config.correlation.significanceThreshold < 0 || config.correlation.significanceThreshold > 1) {
            errors.push('Correlation significance threshold must be between 0 and 1');
        }
        // Validate portfolio configuration
        if (config.portfolio.maxPositions < 1) {
            errors.push('Max positions must be at least 1');
        }
        if (config.portfolio.maxPositions > 100) {
            warnings.push('Max positions over 100 may impact performance');
        }
        // Validate monitoring configuration
        if (config.monitoring.updateFrequency < 1) {
            errors.push('Update frequency must be at least 1 second');
        }
        if (config.monitoring.updateFrequency > 300) {
            warnings.push('Update frequency over 5 minutes may miss critical events');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Get production-ready configuration
     */
    static getProductionConfig() {
        return this.createConfig({
            kelly: {
                ...exports.DEFAULT_KELLY_CONFIG,
                defaultMultiplier: 0.20, // Even more conservative for production
                maxKellyFraction: 0.20
            },
            monitoring: {
                ...exports.DEFAULT_MONITORING_CONFIG,
                updateFrequency: 15, // 15-second updates in production
                dashboardRefresh: 10 // 10-second dashboard refresh
            },
            alerts: {
                ...exports.DEFAULT_ALERT_CONFIG,
                notificationChannels: ['DISCORD', 'EMAIL', 'WEBHOOK'],
                suppressionDuration: 30 // 30-minute suppression
            }
        });
    }
    /**
     * Get development configuration
     */
    static getDevelopmentConfig() {
        return this.createConfig({
            monitoring: {
                ...exports.DEFAULT_MONITORING_CONFIG,
                updateFrequency: 60, // 1-minute updates in development
                dashboardRefresh: 30, // 30-second dashboard refresh
                metricsRetention: 30 // 30-day retention for development
            },
            alerts: {
                ...exports.DEFAULT_ALERT_CONFIG,
                notificationChannels: ['DISCORD'],
                autoResolution: false // Manual resolution in development
            }
        });
    }
}
exports.RiskManagementConfigFactory = RiskManagementConfigFactory;
// ========================================
// Export commonly used configurations
// ========================================
exports.PRODUCTION_CONFIG = RiskManagementConfigFactory.getProductionConfig();
exports.DEVELOPMENT_CONFIG = RiskManagementConfigFactory.getDevelopmentConfig();
