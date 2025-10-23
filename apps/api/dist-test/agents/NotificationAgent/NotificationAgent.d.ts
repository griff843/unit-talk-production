import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../BaseAgent/types';
export interface NotificationPayload {
    type: 'email' | 'sms' | 'slack';
    recipient: string;
    subject?: string;
    message: string;
    metadata?: Record<string, any>;
}
export declare class NotificationAgent extends BaseAgent {
    private static instance;
    private isInitialized;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    static getInstance(config: BaseAgentConfig, deps: BaseAgentDependencies): NotificationAgent;
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<HealthCheckResult>;
    collectMetrics(): Promise<any>;
    sendNotification(payload: NotificationPayload): Promise<void>;
    sendBatchNotifications(payloads: NotificationPayload[]): Promise<void>;
    private validatePayload;
    private sendEmail;
    private sendSMS;
    private sendSlack;
}
//# sourceMappingURL=NotificationAgent.d.ts.map