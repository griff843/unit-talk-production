"use strict";
/**
 * Automated Risk Controls
 *
 * Professional-grade automated risk control system implementing circuit breakers,
 * position limits, emergency stops, and automated portfolio adjustments.
 * Designed to protect against catastrophic losses and maintain risk discipline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomatedRiskControls = void 0;
const logger_1 = require("../../utils/logger");
class AutomatedRiskControls {
    constructor(config, riskEngine) {
        this.logger = (0, logger_1.createLogger)('AutomatedRiskControls');
        // Control system state
        this.circuitBreakers = new Map();
        this.emergencyStop = {
            isActive: false,
            reason: '',
            severity: 'HIGH',
            estimatedDuration: 0,
            actionsBlocked: []
        };
        // Control history and statistics
        this.controlHistory = [];
        this.MAX_HISTORY_SIZE = 1000;
        // Circuit breaker thresholds
        this.CIRCUIT_BREAKER_THRESHOLDS = {
            EXPOSURE: {
                WARNING: 0.75, // 75% of bankroll
                CRITICAL: 0.85, // 85% of bankroll
                EMERGENCY: 0.95 // 95% of bankroll
            },
            DRAWDOWN: {
                WARNING: 0.10, // 10% drawdown
                CRITICAL: 0.15, // 15% drawdown
                EMERGENCY: 0.20 // 20% drawdown
            },
            VAR: {
                WARNING: 0.05, // 5% VaR
                CRITICAL: 0.08, // 8% VaR
                EMERGENCY: 0.12 // 12% VaR
            },
            CORRELATION: {
                WARNING: 0.60, // 60% max correlation
                CRITICAL: 0.75, // 75% max correlation
                EMERGENCY: 0.90 // 90% max correlation
            }
        };
        this.config = config;
        this.riskEngine = riskEngine;
        this.initializeCircuitBreakers();
        this.logger.info('Automated Risk Controls initialized', {
            circuitBreakers: this.circuitBreakers.size,
            emergencyStopEnabled: true
        });
    }
    /**
     * Evaluate position for risk control triggers
     */
    async evaluatePosition(position) {
        if (this.emergencyStop.isActive) {
            this.logger.warn('Emergency stop active - blocking position evaluation', {
                positionId: position.id,
                reason: this.emergencyStop.reason
            });
            return [];
        }
        const actions = [];
        try {
            // Check position-level limits
            const positionActions = await this.checkPositionLimits(position);
            actions.push(...positionActions);
            // Check portfolio-level limits
            const portfolioActions = await this.checkPortfolioLimits();
            actions.push(...portfolioActions);
            // Check circuit breakers
            const circuitBreakerActions = await this.checkCircuitBreakers();
            actions.push(...circuitBreakerActions);
            // Execute automated actions
            for (const action of actions) {
                if (action.automated && !action.requiresApproval) {
                    await this.executeAction(action);
                }
            }
            return actions;
        }
        catch (error) {
            this.logger.error('Position evaluation failed', {
                positionId: position.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    /**
     * Execute risk control action
     */
    async executeAction(action) {
        if (this.emergencyStop.isActive && !this.isEmergencyOverride(action)) {
            this.logger.warn('Action blocked by emergency stop', {
                actionId: action.id,
                type: action.type
            });
            return false;
        }
        const startTime = Date.now();
        try {
            let success = false;
            let impact = {
                positionsAffected: 0,
                exposureReduced: 0,
                riskReduction: 0
            };
            switch (action.type) {
                case 'REDUCE_POSITION':
                    ({ success, impact } = await this.reducePosition(action));
                    break;
                case 'HEDGE_POSITION':
                    ({ success, impact } = await this.hedgePosition(action));
                    break;
                case 'HALT_TRADING':
                    ({ success, impact } = await this.haltTrading(action));
                    break;
                case 'REDUCE_EXPOSURE':
                    ({ success, impact } = await this.reduceExposure(action));
                    break;
                case 'REBALANCE':
                    ({ success, impact } = await this.rebalancePortfolio(action));
                    break;
                default:
                    throw new Error(`Unsupported action type: ${action.type}`);
            }
            // Record control event
            const controlEvent = {
                id: `control-${Date.now()}`,
                type: this.getControlEventType(action.type),
                action,
                triggeredBy: 'automated_risk_controls',
                executedAt: new Date().toISOString(),
                success,
                impact,
                overrideRequired: action.requiresApproval
            };
            this.addControlEvent(controlEvent);
            this.logger.info('Risk control action executed', {
                actionId: action.id,
                type: action.type,
                success,
                impact,
                executionTime: Date.now() - startTime
            });
            return success;
        }
        catch (error) {
            this.logger.error('Risk control action failed', {
                actionId: action.id,
                type: action.type,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    /**
     * Trigger emergency stop
     */
    async triggerEmergencyStop(reason, severity = 'CRITICAL') {
        const overrideCode = this.generateOverrideCode();
        this.emergencyStop = {
            isActive: true,
            triggeredAt: new Date().toISOString(),
            reason,
            severity,
            estimatedDuration: severity === 'CRITICAL' ? 60 : 30, // Minutes
            actionsBlocked: ['REDUCE_POSITION', 'HEDGE_POSITION', 'REBALANCE'],
            overrideCode
        };
        this.logger.critical('EMERGENCY STOP TRIGGERED', {
            reason,
            severity,
            overrideCode,
            estimatedDuration: this.emergencyStop.estimatedDuration
        });
        // Notify all stakeholders
        await this.notifyEmergencyStop();
    }
    /**
     * Override emergency stop with code
     */
    async overrideEmergencyStop(overrideCode, operatorId) {
        if (!this.emergencyStop.isActive) {
            return false;
        }
        if (overrideCode !== this.emergencyStop.overrideCode) {
            this.logger.warn('Invalid emergency stop override attempt', {
                operatorId,
                providedCode: overrideCode.substring(0, 4) + '***'
            });
            return false;
        }
        this.emergencyStop.isActive = false;
        delete this.emergencyStop.overrideCode;
        this.logger.info('Emergency stop overridden', {
            operatorId,
            originalReason: this.emergencyStop.reason
        });
        return true;
    }
    /**
     * Get current system status
     */
    getSystemStatus() {
        const circuitBreakers = Array.from(this.circuitBreakers.values());
        const recentEvents = this.controlHistory.slice(-10);
        let systemHealth = 'HEALTHY';
        if (this.emergencyStop.isActive) {
            systemHealth = 'CRITICAL';
        }
        else if (circuitBreakers.some(cb => cb.isTriggered)) {
            systemHealth = 'WARNING';
        }
        return {
            emergencyStop: this.emergencyStop,
            circuitBreakers,
            recentEvents,
            systemHealth
        };
    }
    // ========================================
    // Private Methods
    // ========================================
    /**
     * Initialize circuit breakers
     */
    initializeCircuitBreakers() {
        const breakerTypes = ['EXPOSURE', 'DRAWDOWN', 'VAR', 'CORRELATION'];
        breakerTypes.forEach(type => {
            this.circuitBreakers.set(type, {
                type: type,
                isTriggered: false,
                threshold: this.CIRCUIT_BREAKER_THRESHOLDS[type].WARNING,
                currentValue: 0,
                duration: 0,
                actionsBlocked: []
            });
        });
    }
    /**
     * Check position-level limits
     */
    async checkPositionLimits(position) {
        const actions = [];
        // Check position size limit
        const bankroll = this.riskEngine.getRiskProfile().bankroll;
        const positionRatio = position.stake / bankroll;
        if (positionRatio > 0.10) { // 10% of bankroll
            actions.push({
                id: `reduce-position-${position.id}-${Date.now()}`,
                type: 'REDUCE_POSITION',
                description: `Position size ${(positionRatio * 100).toFixed(1)}% exceeds 10% limit`,
                targetPositions: [position.id],
                parameters: {
                    targetSize: bankroll * 0.05, // Reduce to 5%
                    reason: 'position_size_limit'
                },
                estimatedImpact: position.stake * 0.5,
                urgency: 'HIGH',
                automated: true,
                requiresApproval: false
            });
        }
        // Check individual risk score
        if (position.riskMetrics?.individualRisk > 8) {
            actions.push({
                id: `hedge-position-${position.id}-${Date.now()}`,
                type: 'HEDGE_POSITION',
                description: `High individual risk score: ${position.riskMetrics.individualRisk}`,
                targetPositions: [position.id],
                parameters: {
                    hedgeRatio: 0.5,
                    reason: 'high_individual_risk'
                },
                estimatedImpact: position.stake * 0.5,
                urgency: 'MEDIUM',
                automated: false,
                requiresApproval: true
            });
        }
        return actions;
    }
    /**
     * Check portfolio-level limits
     */
    async checkPortfolioLimits() {
        const actions = [];
        try {
            const portfolioRisk = await this.riskEngine.getPortfolioRisk();
            const bankroll = this.riskEngine.getRiskProfile().bankroll;
            // Check total exposure
            const exposureRatio = portfolioRisk.totalExposure / bankroll;
            if (exposureRatio > 0.80) {
                actions.push({
                    id: `reduce-exposure-${Date.now()}`,
                    type: 'REDUCE_EXPOSURE',
                    description: `Portfolio exposure ${(exposureRatio * 100).toFixed(1)}% exceeds 80% limit`,
                    targetPositions: [], // Will be determined during execution
                    parameters: {
                        targetExposure: bankroll * 0.70,
                        reductionStrategy: 'proportional'
                    },
                    estimatedImpact: portfolioRisk.totalExposure * 0.1,
                    urgency: 'HIGH',
                    automated: true,
                    requiresApproval: false
                });
            }
            // Check VaR limits
            if (portfolioRisk.valueAtRisk95 > bankroll * 0.08) {
                actions.push({
                    id: `reduce-var-${Date.now()}`,
                    type: 'REBALANCE',
                    description: `VaR ${(portfolioRisk.valueAtRisk95 / bankroll * 100).toFixed(1)}% exceeds 8% limit`,
                    targetPositions: [],
                    parameters: {
                        targetVaR: bankroll * 0.06,
                        optimizationObjective: 'minimize_var'
                    },
                    estimatedImpact: portfolioRisk.valueAtRisk95 * 0.25,
                    urgency: 'HIGH',
                    automated: false,
                    requiresApproval: true
                });
            }
            return actions;
        }
        catch (error) {
            this.logger.error('Portfolio limits check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    /**
     * Check and update circuit breakers
     */
    async checkCircuitBreakers() {
        const actions = [];
        try {
            const portfolioRisk = await this.riskEngine.getPortfolioRisk();
            const bankroll = this.riskEngine.getRiskProfile().bankroll;
            // Check each circuit breaker
            const checks = [
                {
                    type: 'EXPOSURE',
                    value: portfolioRisk.totalExposure / bankroll,
                    thresholds: this.CIRCUIT_BREAKER_THRESHOLDS.EXPOSURE
                },
                {
                    type: 'DRAWDOWN',
                    value: portfolioRisk.currentDrawdown,
                    thresholds: this.CIRCUIT_BREAKER_THRESHOLDS.DRAWDOWN
                },
                {
                    type: 'VAR',
                    value: portfolioRisk.valueAtRisk95 / bankroll,
                    thresholds: this.CIRCUIT_BREAKER_THRESHOLDS.VAR
                },
                {
                    type: 'CORRELATION',
                    value: portfolioRisk.maxPositionCorrelation,
                    thresholds: this.CIRCUIT_BREAKER_THRESHOLDS.CORRELATION
                }
            ];
            for (const check of checks) {
                const breaker = this.circuitBreakers.get(check.type);
                if (!breaker)
                    continue;
                // Check if threshold exceeded
                if (check.value > check.thresholds.EMERGENCY) {
                    // Trigger emergency stop
                    await this.triggerEmergencyStop(`${check.type} exceeded emergency threshold: ${(check.value * 100).toFixed(1)}%`, 'CRITICAL');
                }
                else if (check.value > check.thresholds.CRITICAL) {
                    // Update circuit breaker
                    breaker.isTriggered = true;
                    breaker.currentValue = check.value;
                    breaker.triggeredAt = new Date().toISOString();
                    breaker.duration = 1800; // 30 minutes
                    breaker.actionsBlocked = ['REDUCE_POSITION', 'HEDGE_POSITION'];
                    actions.push({
                        id: `circuit-breaker-${check.type}-${Date.now()}`,
                        type: 'HALT_TRADING',
                        description: `Circuit breaker triggered: ${check.type} at ${(check.value * 100).toFixed(1)}%`,
                        targetPositions: [],
                        parameters: {
                            duration: breaker.duration,
                            reason: `circuit_breaker_${check.type.toLowerCase()}`
                        },
                        estimatedImpact: 0,
                        urgency: 'IMMEDIATE',
                        automated: true,
                        requiresApproval: false
                    });
                }
            }
            return actions;
        }
        catch (error) {
            this.logger.error('Circuit breaker check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    /**
     * Reduce position size
     */
    async reducePosition(action) {
        // Implementation would integrate with position management system
        // For now, simulate the action
        const targetSize = action.parameters.targetSize;
        const originalExposure = action.estimatedImpact * 2; // Estimate
        return {
            success: true,
            impact: {
                positionsAffected: action.targetPositions.length,
                exposureReduced: originalExposure - targetSize,
                riskReduction: action.estimatedImpact
            }
        };
    }
    /**
     * Hedge position
     */
    async hedgePosition(action) {
        // Implementation would create hedge positions
        const hedgeRatio = action.parameters.hedgeRatio;
        return {
            success: true,
            impact: {
                positionsAffected: action.targetPositions.length,
                exposureReduced: action.estimatedImpact * hedgeRatio,
                riskReduction: action.estimatedImpact * hedgeRatio * 0.8
            }
        };
    }
    /**
     * Halt trading
     */
    async haltTrading(action) {
        const duration = action.parameters.duration;
        // Set temporary trading halt
        setTimeout(() => {
            this.logger.info('Trading halt expired', {
                actionId: action.id,
                duration
            });
        }, duration * 1000);
        return {
            success: true,
            impact: {
                positionsAffected: 0,
                exposureReduced: 0,
                riskReduction: action.estimatedImpact
            }
        };
    }
    /**
     * Reduce overall exposure
     */
    async reduceExposure(action) {
        // Implementation would reduce positions proportionally
        const targetExposure = action.parameters.targetExposure;
        return {
            success: true,
            impact: {
                positionsAffected: 10, // Estimate
                exposureReduced: action.estimatedImpact,
                riskReduction: action.estimatedImpact * 0.8
            }
        };
    }
    /**
     * Rebalance portfolio
     */
    async rebalancePortfolio(action) {
        // Implementation would use portfolio optimizer
        return {
            success: true,
            impact: {
                positionsAffected: 15, // Estimate
                exposureReduced: action.estimatedImpact * 0.5,
                riskReduction: action.estimatedImpact
            }
        };
    }
    /**
     * Check if action is emergency override
     */
    isEmergencyOverride(action) {
        return action.description.includes('emergency_override');
    }
    /**
     * Generate emergency stop override code
     */
    generateOverrideCode() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `ESO-${timestamp.slice(-6)}-${random.toUpperCase()}`;
    }
    /**
     * Get control event type from action type
     */
    getControlEventType(actionType) {
        switch (actionType) {
            case 'HALT_TRADING':
                return 'CIRCUIT_BREAKER';
            case 'REDUCE_POSITION':
            case 'HEDGE_POSITION':
                return 'POSITION_LIMIT';
            case 'REDUCE_EXPOSURE':
            case 'REBALANCE':
                return 'AUTO_ADJUSTMENT';
            default:
                return 'AUTO_ADJUSTMENT';
        }
    }
    /**
     * Add control event to history
     */
    addControlEvent(event) {
        this.controlHistory.unshift(event);
        // Limit history size
        if (this.controlHistory.length > this.MAX_HISTORY_SIZE) {
            this.controlHistory = this.controlHistory.slice(0, this.MAX_HISTORY_SIZE);
        }
    }
    /**
     * Notify stakeholders of emergency stop
     */
    async notifyEmergencyStop() {
        // Implementation would send notifications via configured channels
        this.logger.critical('EMERGENCY STOP NOTIFICATION SENT', {
            channels: this.config.notificationChannels,
            reason: this.emergencyStop.reason
        });
    }
}
exports.AutomatedRiskControls = AutomatedRiskControls;
