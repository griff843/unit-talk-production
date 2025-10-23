/**
 * Phase 9: Emergency System
 *
 * Comprehensive emergency controls with stop-loss triggers, circuit breakers,
 * automated emergency procedures, and contact protocols for live testing safety.
 */
import { EventEmitter } from 'events';
import { EmergencySystem as IEmergencySystem, StopLossTrigger, CircuitBreaker, EmergencyProcedure, ContactProtocol, EmergencyAction, LiveTestingConfig } from '../types';
export declare class EmergencySystem extends EventEmitter implements IEmergencySystem {
    private logger;
    stopLossTriggers: StopLossTrigger[];
    circuitBreakers: CircuitBreaker[];
    emergencyProcedures: EmergencyProcedure[];
    contactProtocols: ContactProtocol[];
    private config;
    private systemState;
    private emergencyHistory;
    private monitoringInterval;
    private activeContacts;
    constructor(config: LiveTestingConfig);
    private initializeEmergencySystem;
    private initializeStopLossTriggers;
    private initializeCircuitBreakers;
    private initializeEmergencyProcedures;
    private initializeContactProtocols;
    private startEmergencyMonitoring;
    updateTriggerValue(triggerType: string, value: number): void;
    private checkStopLossTriggers;
    private checkCircuitBreakers;
    private activateStopLossTrigger;
    private activateCircuitBreaker;
    private executeEmergencyAction;
    private pauseBetting;
    private emergencyStop;
    private reduceExposure;
    private notifyOperator;
    private executeEmergencyProcedure;
    private executeEmergencyStep;
    private performStepAction;
    private initiateContactProtocol;
    private contactPerson;
    private generateContactMessage;
    private sendEmail;
    private sendSMS;
    private sendDiscordMessage;
    private makePhoneCall;
    resumeBetting(reason: string): void;
    clearEmergencyMode(operatorId: string): void;
    private resetCircuitBreaker;
    private processEmergencyQueue;
    private shouldAutoResolve;
    private determineSeverity;
    getSystemStatus(): {
        emergencyMode: boolean;
        bettingPaused: boolean;
        activeTriggersCount: number;
        activeBreakerCount: number;
        unresolvedEventsCount: number;
        operatorNotified: boolean;
        emergencyContactsReached: boolean;
    };
    getEmergencyHistory(limit?: number): EmergencyEvent[];
    acknowledgeEmergencyEvent(eventId: string, operatorId: string): boolean;
    forceResolveEmergencyEvent(eventId: string, operatorId: string, reason: string): boolean;
    stop(): void;
}
interface EmergencyEvent {
    id: string;
    type: string;
    triggerName: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp: string;
    value: number;
    threshold: number;
    action: EmergencyAction;
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionReason?: string;
    acknowledged?: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
}
export {};
//# sourceMappingURL=EmergencySystem.d.ts.map