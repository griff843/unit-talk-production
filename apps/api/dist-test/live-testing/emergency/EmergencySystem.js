"use strict";
/**
 * Phase 9: Emergency System
 *
 * Comprehensive emergency controls with stop-loss triggers, circuit breakers,
 * automated emergency procedures, and contact protocols for live testing safety.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergencySystem = void 0;
const events_1 = require("events");
const logger_1 = require("@shared/logger");
class EmergencySystem extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.logger = new logger_1.Logger('EmergencySystem');
        this.emergencyHistory = [];
        this.activeContacts = new Map();
        this.config = config;
        this.initializeEmergencySystem();
        this.startEmergencyMonitoring();
    }
    // ========================================
    // Initialization
    // ========================================
    initializeEmergencySystem() {
        this.systemState = {
            emergencyMode: false,
            pauseBetting: false,
            systemErrors: 0,
            lastErrorTime: null,
            operatorNotified: false,
            emergencyContactsReached: false
        };
        this.initializeStopLossTriggers();
        this.initializeCircuitBreakers();
        this.initializeEmergencyProcedures();
        this.initializeContactProtocols();
        this.logger.info('Emergency system initialized', {
            stopLossTriggers: this.stopLossTriggers.length,
            circuitBreakers: this.circuitBreakers.length,
            emergencyProcedures: this.emergencyProcedures.length,
            contactProtocols: this.contactProtocols.length
        });
    }
    initializeStopLossTriggers() {
        this.stopLossTriggers = [
            {
                name: 'Daily Loss Limit',
                type: 'DAILY_LOSS',
                threshold: this.config.globalLimits.maxDailyRisk * 0.5, // 50% of daily limit
                currentValue: 0,
                enabled: true,
                triggered: false,
                action: {
                    type: 'PAUSE_BETTING',
                    immediate: true,
                    reversible: true,
                    parameters: { duration: 3600000 } // 1 hour pause
                }
            },
            {
                name: 'Portfolio Drawdown',
                type: 'TOTAL_DRAWDOWN',
                threshold: 0.1, // 10% portfolio drawdown
                currentValue: 0,
                enabled: true,
                triggered: false,
                action: {
                    type: 'EMERGENCY_STOP',
                    immediate: true,
                    reversible: false,
                    parameters: { reason: 'Portfolio drawdown limit exceeded' }
                }
            },
            {
                name: 'Consecutive Losses',
                type: 'CONSECUTIVE_LOSSES',
                threshold: 7, // 7 consecutive losses
                currentValue: 0,
                enabled: true,
                triggered: false,
                action: {
                    type: 'PAUSE_BETTING',
                    immediate: true,
                    reversible: true,
                    parameters: { duration: 1800000 } // 30 minute pause
                }
            },
            {
                name: 'System Error Cascade',
                type: 'SYSTEM_ERROR',
                threshold: 5, // 5 consecutive system errors
                currentValue: 0,
                enabled: true,
                triggered: false,
                action: {
                    type: 'EMERGENCY_STOP',
                    immediate: true,
                    reversible: false,
                    parameters: { reason: 'System error cascade detected' }
                }
            }
        ];
    }
    initializeCircuitBreakers() {
        this.circuitBreakers = [
            {
                name: 'API Error Rate',
                condition: 'API errors > 50% in 5 minutes',
                threshold: 0.5,
                currentValue: 0,
                windowSize: 5, // 5 minutes
                enabled: true,
                triggered: false,
                cooldownPeriod: 15, // 15 minutes
                action: {
                    type: 'PAUSE_BETTING',
                    immediate: true,
                    reversible: true,
                    parameters: { reason: 'High API error rate' }
                }
            },
            {
                name: 'Rapid Loss Rate',
                condition: 'Portfolio loss > 5% in 30 minutes',
                threshold: 0.05,
                currentValue: 0,
                windowSize: 30, // 30 minutes
                enabled: true,
                triggered: false,
                cooldownPeriod: 60, // 1 hour cooldown
                action: {
                    type: 'REDUCE_EXPOSURE',
                    immediate: true,
                    reversible: true,
                    parameters: { reductionFactor: 0.5 } // Reduce bet sizes by 50%
                }
            },
            {
                name: 'Market Anomaly',
                condition: 'Unusual market behavior detected',
                threshold: 0.8, // Anomaly score > 0.8
                currentValue: 0,
                windowSize: 10, // 10 minutes
                enabled: true,
                triggered: false,
                cooldownPeriod: 30, // 30 minutes
                action: {
                    type: 'PAUSE_BETTING',
                    immediate: true,
                    reversible: true,
                    parameters: { reason: 'Market anomaly detected' }
                }
            },
            {
                name: 'Kelly Violation Rate',
                condition: 'Kelly violations > 30% in 1 hour',
                threshold: 0.3,
                currentValue: 0,
                windowSize: 60, // 1 hour
                enabled: true,
                triggered: false,
                cooldownPeriod: 120, // 2 hours
                action: {
                    type: 'REDUCE_EXPOSURE',
                    immediate: true,
                    reversible: true,
                    parameters: { reductionFactor: 0.7 } // Reduce bet sizes by 30%
                }
            }
        ];
    }
    initializeEmergencyProcedures() {
        this.emergencyProcedures = [
            {
                triggerType: 'DAILY_LOSS',
                steps: [
                    {
                        order: 1,
                        action: 'PAUSE_ALL_BETTING',
                        description: 'Immediately pause all betting activities',
                        automated: true,
                        timeoutSeconds: 30,
                        rollbackPossible: true
                    },
                    {
                        order: 2,
                        action: 'NOTIFY_OPERATOR',
                        description: 'Send immediate notification to operator',
                        automated: true,
                        timeoutSeconds: 60,
                        rollbackPossible: false
                    },
                    {
                        order: 3,
                        action: 'GENERATE_LOSS_REPORT',
                        description: 'Generate detailed loss analysis report',
                        automated: true,
                        timeoutSeconds: 300,
                        rollbackPossible: false
                    },
                    {
                        order: 4,
                        action: 'MANUAL_REVIEW_REQUIRED',
                        description: 'Require manual review before resuming',
                        automated: false,
                        rollbackPossible: false
                    }
                ],
                priority: 'HIGH',
                autoExecute: true
            },
            {
                triggerType: 'TOTAL_DRAWDOWN',
                steps: [
                    {
                        order: 1,
                        action: 'EMERGENCY_STOP',
                        description: 'Emergency stop all systems',
                        automated: true,
                        timeoutSeconds: 10,
                        rollbackPossible: false
                    },
                    {
                        order: 2,
                        action: 'CLOSE_ALL_POSITIONS',
                        description: 'Attempt to close all open positions',
                        automated: true,
                        timeoutSeconds: 120,
                        rollbackPossible: false
                    },
                    {
                        order: 3,
                        action: 'EMERGENCY_CONTACT',
                        description: 'Contact emergency contacts immediately',
                        automated: true,
                        timeoutSeconds: 180,
                        rollbackPossible: false
                    },
                    {
                        order: 4,
                        action: 'PRESERVE_CAPITAL',
                        description: 'Implement capital preservation mode',
                        automated: true,
                        timeoutSeconds: 60,
                        rollbackPossible: false
                    }
                ],
                priority: 'CRITICAL',
                autoExecute: true
            },
            {
                triggerType: 'SYSTEM_ERROR',
                steps: [
                    {
                        order: 1,
                        action: 'DIAGNOSTIC_SCAN',
                        description: 'Run comprehensive system diagnostic',
                        automated: true,
                        timeoutSeconds: 180,
                        rollbackPossible: false
                    },
                    {
                        order: 2,
                        action: 'ISOLATE_ERRORS',
                        description: 'Isolate error sources and affected systems',
                        automated: true,
                        timeoutSeconds: 120,
                        rollbackPossible: false
                    },
                    {
                        order: 3,
                        action: 'PAUSE_AFFECTED_SYSTEMS',
                        description: 'Pause systems affected by errors',
                        automated: true,
                        timeoutSeconds: 60,
                        rollbackPossible: true
                    },
                    {
                        order: 4,
                        action: 'TECHNICAL_SUPPORT',
                        description: 'Contact technical support team',
                        automated: true,
                        timeoutSeconds: 300,
                        rollbackPossible: false
                    }
                ],
                priority: 'HIGH',
                autoExecute: true
            }
        ];
    }
    initializeContactProtocols() {
        this.contactProtocols = [
            {
                triggerSeverity: 'LOW',
                contacts: [
                    {
                        name: 'System Operator',
                        role: 'Primary Operator',
                        primary: true,
                        email: 'operator@unittalk.com',
                        discordId: 'operator123',
                        timezone: 'America/New_York'
                    }
                ],
                escalationDelay: 15, // 15 minutes
                methods: ['DISCORD', 'EMAIL']
            },
            {
                triggerSeverity: 'MEDIUM',
                contacts: [
                    {
                        name: 'System Operator',
                        role: 'Primary Operator',
                        primary: true,
                        email: 'operator@unittalk.com',
                        phone: '+1234567890',
                        discordId: 'operator123',
                        timezone: 'America/New_York'
                    },
                    {
                        name: 'Technical Lead',
                        role: 'Technical Support',
                        primary: false,
                        email: 'tech@unittalk.com',
                        discordId: 'tech456',
                        timezone: 'America/New_York'
                    }
                ],
                escalationDelay: 10, // 10 minutes
                methods: ['DISCORD', 'SMS', 'EMAIL']
            },
            {
                triggerSeverity: 'HIGH',
                contacts: [
                    {
                        name: 'System Operator',
                        role: 'Primary Operator',
                        primary: true,
                        email: 'operator@unittalk.com',
                        phone: '+1234567890',
                        discordId: 'operator123',
                        timezone: 'America/New_York'
                    },
                    {
                        name: 'Technical Lead',
                        role: 'Technical Support',
                        primary: false,
                        email: 'tech@unittalk.com',
                        phone: '+1234567891',
                        discordId: 'tech456',
                        timezone: 'America/New_York'
                    },
                    {
                        name: 'Risk Manager',
                        role: 'Risk Management',
                        primary: false,
                        email: 'risk@unittalk.com',
                        phone: '+1234567892',
                        timezone: 'America/New_York'
                    }
                ],
                escalationDelay: 5, // 5 minutes
                methods: ['CALL', 'SMS', 'DISCORD', 'EMAIL']
            },
            {
                triggerSeverity: 'CRITICAL',
                contacts: [
                    {
                        name: 'Emergency Response Team',
                        role: 'Emergency Response',
                        primary: true,
                        email: 'emergency@unittalk.com',
                        phone: '+1234567893',
                        timezone: 'America/New_York'
                    },
                    {
                        name: 'System Operator',
                        role: 'Primary Operator',
                        primary: false,
                        email: 'operator@unittalk.com',
                        phone: '+1234567890',
                        discordId: 'operator123',
                        timezone: 'America/New_York'
                    },
                    {
                        name: 'Technical Lead',
                        role: 'Technical Support',
                        primary: false,
                        email: 'tech@unittalk.com',
                        phone: '+1234567891',
                        discordId: 'tech456',
                        timezone: 'America/New_York'
                    }
                ],
                escalationDelay: 2, // 2 minutes
                methods: ['CALL', 'SMS', 'DISCORD']
            }
        ];
    }
    startEmergencyMonitoring() {
        // Monitor triggers and circuit breakers every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.checkStopLossTriggers();
            this.checkCircuitBreakers();
            this.processEmergencyQueue();
        }, 30000);
    }
    // ========================================
    // Trigger Monitoring and Processing
    // ========================================
    updateTriggerValue(triggerType, value) {
        // Update stop loss triggers
        const stopLossTrigger = this.stopLossTriggers.find(t => t.type === triggerType);
        if (stopLossTrigger) {
            stopLossTrigger.currentValue = value;
            if (!stopLossTrigger.triggered && stopLossTrigger.enabled && value >= stopLossTrigger.threshold) {
                this.activateStopLossTrigger(stopLossTrigger);
            }
        }
        // Update circuit breakers
        const circuitBreaker = this.circuitBreakers.find(cb => cb.condition.includes(triggerType));
        if (circuitBreaker) {
            circuitBreaker.currentValue = value;
            if (!circuitBreaker.triggered && circuitBreaker.enabled && value >= circuitBreaker.threshold) {
                this.activateCircuitBreaker(circuitBreaker);
            }
        }
    }
    checkStopLossTriggers() {
        for (const trigger of this.stopLossTriggers) {
            if (!trigger.enabled || trigger.triggered)
                continue;
            if (trigger.currentValue >= trigger.threshold) {
                this.activateStopLossTrigger(trigger);
            }
        }
    }
    checkCircuitBreakers() {
        for (const breaker of this.circuitBreakers) {
            if (!breaker.enabled || breaker.triggered)
                continue;
            if (breaker.currentValue >= breaker.threshold) {
                this.activateCircuitBreaker(breaker);
            }
        }
    }
    activateStopLossTrigger(trigger) {
        trigger.triggered = true;
        const emergencyEvent = {
            id: `stop_loss_${Date.now()}`,
            type: 'STOP_LOSS_TRIGGER',
            triggerName: trigger.name,
            severity: this.determineSeverity(trigger.type),
            timestamp: new Date().toISOString(),
            value: trigger.currentValue,
            threshold: trigger.threshold,
            action: trigger.action,
            resolved: false
        };
        this.emergencyHistory.push(emergencyEvent);
        this.logger.error('Stop loss trigger activated', {
            triggerName: trigger.name,
            type: trigger.type,
            currentValue: trigger.currentValue,
            threshold: trigger.threshold,
            action: trigger.action.type
        });
        this.executeEmergencyAction(trigger.action, emergencyEvent);
        this.emit('stopLossTrigger', emergencyEvent);
    }
    activateCircuitBreaker(breaker) {
        breaker.triggered = true;
        const emergencyEvent = {
            id: `circuit_breaker_${Date.now()}`,
            type: 'CIRCUIT_BREAKER',
            triggerName: breaker.name,
            severity: 'MEDIUM',
            timestamp: new Date().toISOString(),
            value: breaker.currentValue,
            threshold: breaker.threshold,
            action: breaker.action,
            resolved: false
        };
        this.emergencyHistory.push(emergencyEvent);
        this.logger.warn('Circuit breaker activated', {
            breakerName: breaker.name,
            condition: breaker.condition,
            currentValue: breaker.currentValue,
            threshold: breaker.threshold,
            cooldownPeriod: breaker.cooldownPeriod
        });
        this.executeEmergencyAction(breaker.action, emergencyEvent);
        // Schedule circuit breaker reset
        setTimeout(() => {
            this.resetCircuitBreaker(breaker);
        }, breaker.cooldownPeriod * 60 * 1000);
        this.emit('circuitBreaker', emergencyEvent);
    }
    // ========================================
    // Emergency Action Execution
    // ========================================
    async executeEmergencyAction(action, event) {
        try {
            switch (action.type) {
                case 'PAUSE_BETTING':
                    await this.pauseBetting(action.parameters);
                    break;
                case 'EMERGENCY_STOP':
                    await this.emergencyStop(action.parameters);
                    break;
                case 'REDUCE_EXPOSURE':
                    await this.reduceExposure(action.parameters);
                    break;
                case 'NOTIFY_OPERATOR':
                    await this.notifyOperator(event);
                    break;
                default:
                    this.logger.error('Unknown emergency action type', { actionType: action.type });
            }
            // Execute emergency procedures
            const procedure = this.emergencyProcedures.find(p => p.triggerType === event.type);
            if (procedure && procedure.autoExecute) {
                await this.executeEmergencyProcedure(procedure, event);
            }
            // Initiate contact protocols
            await this.initiateContactProtocol(event.severity, event);
        }
        catch (error) {
            this.logger.error('Failed to execute emergency action', {
                actionType: action.type,
                error: error.message,
                eventId: event.id
            });
        }
    }
    async pauseBetting(parameters) {
        this.systemState.pauseBetting = true;
        const duration = parameters?.duration || 3600000; // Default 1 hour
        const reason = parameters?.reason || 'Emergency trigger activated';
        this.logger.warn('Betting paused by emergency system', {
            duration: duration / 60000, // Convert to minutes
            reason
        });
        this.emit('bettingPaused', { duration, reason });
        // Schedule automatic resume if reversible
        if (parameters?.reversible !== false) {
            setTimeout(() => {
                this.resumeBetting('Auto-resume after pause duration');
            }, duration);
        }
    }
    async emergencyStop(parameters) {
        this.systemState.emergencyMode = true;
        this.systemState.pauseBetting = true;
        const reason = parameters?.reason || 'Emergency stop activated';
        this.logger.error('Emergency stop activated', { reason });
        this.emit('emergencyStop', { reason, timestamp: new Date().toISOString() });
        // Close all open positions if possible
        this.emit('closeAllPositions');
        // Preserve capital
        this.emit('preserveCapital');
    }
    async reduceExposure(parameters) {
        const reductionFactor = parameters?.reductionFactor || 0.5;
        const reason = parameters?.reason || 'Risk reduction triggered';
        this.logger.warn('Exposure reduction activated', {
            reductionFactor,
            reason
        });
        this.emit('reduceExposure', { reductionFactor, reason });
    }
    async notifyOperator(event) {
        this.systemState.operatorNotified = true;
        this.logger.info('Operator notification sent', {
            eventId: event.id,
            eventType: event.type,
            severity: event.severity
        });
        this.emit('operatorNotification', event);
    }
    // ========================================
    // Emergency Procedures
    // ========================================
    async executeEmergencyProcedure(procedure, event) {
        this.logger.info('Executing emergency procedure', {
            triggerType: procedure.triggerType,
            priority: procedure.priority,
            steps: procedure.steps.length
        });
        for (const step of procedure.steps) {
            try {
                await this.executeEmergencyStep(step, event);
                this.logger.info('Emergency step completed', {
                    order: step.order,
                    action: step.action,
                    automated: step.automated
                });
                // If step is not automated, wait for manual intervention
                if (!step.automated) {
                    this.logger.warn('Manual intervention required', {
                        step: step.order,
                        action: step.action,
                        description: step.description
                    });
                    this.emit('manualInterventionRequired', {
                        step,
                        event,
                        procedure
                    });
                    break; // Stop automatic execution
                }
            }
            catch (error) {
                this.logger.error('Emergency step failed', {
                    order: step.order,
                    action: step.action,
                    error: error.message
                });
                // If step has timeout and fails, continue to next step
                if (step.timeoutSeconds) {
                    continue;
                }
                else {
                    break; // Stop execution on critical failure
                }
            }
        }
    }
    async executeEmergencyStep(step, event) {
        const timeout = step.timeoutSeconds ? step.timeoutSeconds * 1000 : 60000; // Default 1 minute
        return Promise.race([
            this.performStepAction(step, event),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Step timeout: ${step.action}`)), timeout))
        ]);
    }
    async performStepAction(step, event) {
        switch (step.action) {
            case 'PAUSE_ALL_BETTING':
                await this.pauseBetting();
                break;
            case 'EMERGENCY_STOP':
                await this.emergencyStop();
                break;
            case 'CLOSE_ALL_POSITIONS':
                this.emit('closeAllPositions');
                break;
            case 'NOTIFY_OPERATOR':
                await this.notifyOperator(event);
                break;
            case 'GENERATE_LOSS_REPORT':
                this.emit('generateLossReport', event);
                break;
            case 'EMERGENCY_CONTACT':
                await this.initiateContactProtocol('CRITICAL', event);
                break;
            case 'PRESERVE_CAPITAL':
                this.emit('preserveCapital');
                break;
            case 'DIAGNOSTIC_SCAN':
                this.emit('runDiagnostic', event);
                break;
            case 'ISOLATE_ERRORS':
                this.emit('isolateErrors', event);
                break;
            case 'PAUSE_AFFECTED_SYSTEMS':
                this.emit('pauseAffectedSystems', event);
                break;
            case 'TECHNICAL_SUPPORT':
                await this.initiateContactProtocol('HIGH', event);
                break;
            default:
                this.logger.warn('Unknown emergency step action', { action: step.action });
        }
    }
    // ========================================
    // Contact Protocols
    // ========================================
    async initiateContactProtocol(severity, event) {
        const protocol = this.contactProtocols.find(p => p.triggerSeverity === severity);
        if (!protocol) {
            this.logger.error('No contact protocol found for severity', { severity });
            return;
        }
        this.logger.info('Initiating contact protocol', {
            severity,
            contactCount: protocol.contacts.length,
            methods: protocol.methods,
            escalationDelay: protocol.escalationDelay
        });
        for (const contact of protocol.contacts) {
            try {
                await this.contactPerson(contact, protocol.methods, event);
                // Record contact attempt
                const attempts = this.activeContacts.get(contact.name) || [];
                attempts.push({
                    timestamp: new Date().toISOString(),
                    methods: protocol.methods,
                    success: true,
                    eventId: event.id
                });
                this.activeContacts.set(contact.name, attempts);
                this.logger.info('Contact attempt successful', {
                    contactName: contact.name,
                    role: contact.role,
                    methods: protocol.methods
                });
                // If primary contact reached, mark as successful
                if (contact.primary) {
                    this.systemState.emergencyContactsReached = true;
                    return;
                }
            }
            catch (error) {
                this.logger.error('Contact attempt failed', {
                    contactName: contact.name,
                    error: error.message
                });
                // Record failed attempt
                const attempts = this.activeContacts.get(contact.name) || [];
                attempts.push({
                    timestamp: new Date().toISOString(),
                    methods: protocol.methods,
                    success: false,
                    eventId: event.id,
                    error: error.message
                });
                this.activeContacts.set(contact.name, attempts);
            }
            // Wait escalation delay before trying next contact (if not primary)
            if (!contact.primary && protocol.escalationDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, protocol.escalationDelay * 60 * 1000));
            }
        }
    }
    async contactPerson(contact, methods, event) {
        const message = this.generateContactMessage(contact, event);
        for (const method of methods) {
            try {
                switch (method) {
                    case 'EMAIL':
                        if (contact.email) {
                            await this.sendEmail(contact.email, `Emergency Alert: ${event.type}`, message);
                        }
                        break;
                    case 'SMS':
                        if (contact.phone) {
                            await this.sendSMS(contact.phone, message);
                        }
                        break;
                    case 'DISCORD':
                        if (contact.discordId) {
                            await this.sendDiscordMessage(contact.discordId, message);
                        }
                        break;
                    case 'CALL':
                        if (contact.phone) {
                            await this.makePhoneCall(contact.phone, message);
                        }
                        break;
                }
                this.logger.info('Contact method executed', {
                    method,
                    contactName: contact.name,
                    eventId: event.id
                });
            }
            catch (error) {
                this.logger.error('Contact method failed', {
                    method,
                    contactName: contact.name,
                    error: error.message
                });
            }
        }
    }
    generateContactMessage(contact, event) {
        return `
EMERGENCY ALERT - Unit Talk Live Testing System

Contact: ${contact.name} (${contact.role})
Event: ${event.type}
Severity: ${event.severity}
Time: ${event.timestamp}

Trigger: ${event.triggerName}
Current Value: ${event.value}
Threshold: ${event.threshold}

Action Taken: ${event.action.type}

Please respond immediately to acknowledge this alert.

Event ID: ${event.id}
    `.trim();
    }
    // ========================================
    // Communication Methods (Placeholder implementations)
    // ========================================
    async sendEmail(email, subject, message) {
        // Placeholder implementation
        this.logger.info('Email sent', { email, subject });
        this.emit('emailSent', { email, subject, message });
    }
    async sendSMS(phone, message) {
        // Placeholder implementation
        this.logger.info('SMS sent', { phone });
        this.emit('smsSent', { phone, message });
    }
    async sendDiscordMessage(discordId, message) {
        // Placeholder implementation
        this.logger.info('Discord message sent', { discordId });
        this.emit('discordMessageSent', { discordId, message });
    }
    async makePhoneCall(phone, message) {
        // Placeholder implementation
        this.logger.info('Phone call initiated', { phone });
        this.emit('phoneCallInitiated', { phone, message });
    }
    // ========================================
    // System State Management
    // ========================================
    resumeBetting(reason) {
        if (!this.systemState.emergencyMode) {
            this.systemState.pauseBetting = false;
            this.logger.info('Betting resumed', { reason });
            this.emit('bettingResumed', { reason, timestamp: new Date().toISOString() });
        }
        else {
            this.logger.warn('Cannot resume betting - system in emergency mode');
        }
    }
    clearEmergencyMode(operatorId) {
        this.systemState.emergencyMode = false;
        this.systemState.pauseBetting = false;
        this.systemState.operatorNotified = false;
        this.systemState.emergencyContactsReached = false;
        // Reset all triggers
        for (const trigger of this.stopLossTriggers) {
            trigger.triggered = false;
            trigger.currentValue = 0;
        }
        this.logger.info('Emergency mode cleared', { operatorId });
        this.emit('emergencyModeCleared', { operatorId, timestamp: new Date().toISOString() });
    }
    resetCircuitBreaker(breaker) {
        breaker.triggered = false;
        breaker.currentValue = 0;
        this.logger.info('Circuit breaker reset', {
            breakerName: breaker.name,
            cooldownCompleted: true
        });
        this.emit('circuitBreakerReset', breaker);
    }
    processEmergencyQueue() {
        // Process any pending emergency events
        const unresolved = this.emergencyHistory.filter(event => !event.resolved);
        for (const event of unresolved) {
            // Check if event should auto-resolve
            if (this.shouldAutoResolve(event)) {
                event.resolved = true;
                event.resolvedAt = new Date().toISOString();
                this.logger.info('Emergency event auto-resolved', {
                    eventId: event.id,
                    type: event.type
                });
                this.emit('emergencyEventResolved', event);
            }
        }
    }
    shouldAutoResolve(event) {
        // Auto-resolve events after certain conditions are met
        const eventAge = Date.now() - new Date(event.timestamp).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        // Auto-resolve old events
        if (eventAge > maxAge) {
            return true;
        }
        // Auto-resolve circuit breaker events after cooldown
        if (event.type === 'CIRCUIT_BREAKER') {
            const breaker = this.circuitBreakers.find(cb => cb.name === event.triggerName);
            if (breaker && !breaker.triggered) {
                return true;
            }
        }
        return false;
    }
    // ========================================
    // Utility Methods
    // ========================================
    determineSeverity(triggerType) {
        switch (triggerType) {
            case 'TOTAL_DRAWDOWN':
            case 'SYSTEM_ERROR':
                return 'CRITICAL';
            case 'DAILY_LOSS':
                return 'HIGH';
            case 'CONSECUTIVE_LOSSES':
                return 'MEDIUM';
            default:
                return 'LOW';
        }
    }
    // ========================================
    // Public Methods
    // ========================================
    getSystemStatus() {
        const activeTriggers = this.stopLossTriggers.filter(t => t.triggered).length;
        const activeBreakers = this.circuitBreakers.filter(cb => cb.triggered).length;
        const unresolvedEvents = this.emergencyHistory.filter(e => !e.resolved).length;
        return {
            emergencyMode: this.systemState.emergencyMode,
            bettingPaused: this.systemState.pauseBetting,
            activeTriggersCount: activeTriggers,
            activeBreakerCount: activeBreakers,
            unresolvedEventsCount: unresolvedEvents,
            operatorNotified: this.systemState.operatorNotified,
            emergencyContactsReached: this.systemState.emergencyContactsReached
        };
    }
    getEmergencyHistory(limit = 50) {
        return this.emergencyHistory
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }
    acknowledgeEmergencyEvent(eventId, operatorId) {
        const event = this.emergencyHistory.find(e => e.id === eventId);
        if (!event) {
            return false;
        }
        event.acknowledged = true;
        event.acknowledgedBy = operatorId;
        event.acknowledgedAt = new Date().toISOString();
        this.logger.info('Emergency event acknowledged', {
            eventId,
            operatorId,
            eventType: event.type
        });
        this.emit('emergencyEventAcknowledged', event);
        return true;
    }
    forceResolveEmergencyEvent(eventId, operatorId, reason) {
        const event = this.emergencyHistory.find(e => e.id === eventId);
        if (!event) {
            return false;
        }
        event.resolved = true;
        event.resolvedAt = new Date().toISOString();
        event.resolvedBy = operatorId;
        event.resolutionReason = reason;
        this.logger.info('Emergency event force resolved', {
            eventId,
            operatorId,
            reason,
            eventType: event.type
        });
        this.emit('emergencyEventForceResolved', event);
        return true;
    }
    // ========================================
    // Cleanup
    // ========================================
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.logger.info('Emergency system stopped');
    }
}
exports.EmergencySystem = EmergencySystem;
