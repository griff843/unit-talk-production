/**
 * Automated Risk Controls
 *
 * Professional-grade automated risk control system implementing circuit breakers,
 * position limits, emergency stops, and automated portfolio adjustments.
 * Designed to protect against catastrophic losses and maintain risk discipline.
 */
import { Position, RiskControlAction, AlertConfig } from '../types';
export interface CircuitBreakerStatus {
    type: 'EXPOSURE' | 'DRAWDOWN' | 'VAR' | 'CORRELATION';
    isTriggered: boolean;
    threshold: number;
    currentValue: number;
    triggeredAt?: string;
    duration: number;
    actionsBlocked: string[];
}
export interface RiskControlEvent {
    id: string;
    type: 'CIRCUIT_BREAKER' | 'POSITION_LIMIT' | 'EMERGENCY_STOP' | 'AUTO_ADJUSTMENT';
    action: RiskControlAction;
    triggeredBy: string;
    executedAt: string;
    success: boolean;
    impact: {
        positionsAffected: number;
        exposureReduced: number;
        riskReduction: number;
    };
    overrideRequired: boolean;
}
export interface EmergencyStopStatus {
    isActive: boolean;
    triggeredAt?: string;
    reason: string;
    severity: 'HIGH' | 'CRITICAL';
    estimatedDuration: number;
    actionsBlocked: string[];
    overrideCode?: string;
}
export declare class AutomatedRiskControls {
    private logger;
    private config;
    private riskEngine;
    private circuitBreakers;
    private emergencyStop;
    private controlHistory;
    private readonly MAX_HISTORY_SIZE;
    private readonly CIRCUIT_BREAKER_THRESHOLDS;
    constructor(config: AlertConfig, riskEngine: any);
    /**
     * Evaluate position for risk control triggers
     */
    evaluatePosition(position: Position): Promise<RiskControlAction[]>;
    /**
     * Execute risk control action
     */
    executeAction(action: RiskControlAction): Promise<boolean>;
    /**
     * Trigger emergency stop
     */
    triggerEmergencyStop(reason: string, severity?: 'HIGH' | 'CRITICAL'): Promise<void>;
    /**
     * Override emergency stop with code
     */
    overrideEmergencyStop(overrideCode: string, operatorId: string): Promise<boolean>;
    /**
     * Get current system status
     */
    getSystemStatus(): {
        emergencyStop: EmergencyStopStatus;
        circuitBreakers: CircuitBreakerStatus[];
        recentEvents: RiskControlEvent[];
        systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    };
    /**
     * Initialize circuit breakers
     */
    private initializeCircuitBreakers;
    /**
     * Check position-level limits
     */
    private checkPositionLimits;
    /**
     * Check portfolio-level limits
     */
    private checkPortfolioLimits;
    /**
     * Check and update circuit breakers
     */
    private checkCircuitBreakers;
    /**
     * Reduce position size
     */
    private reducePosition;
    /**
     * Hedge position
     */
    private hedgePosition;
    /**
     * Halt trading
     */
    private haltTrading;
    /**
     * Reduce overall exposure
     */
    private reduceExposure;
    /**
     * Rebalance portfolio
     */
    private rebalancePortfolio;
    /**
     * Check if action is emergency override
     */
    private isEmergencyOverride;
    /**
     * Generate emergency stop override code
     */
    private generateOverrideCode;
    /**
     * Get control event type from action type
     */
    private getControlEventType;
    /**
     * Add control event to history
     */
    private addControlEvent;
    /**
     * Notify stakeholders of emergency stop
     */
    private notifyEmergencyStop;
}
//# sourceMappingURL=AutomatedRiskControls.d.ts.map