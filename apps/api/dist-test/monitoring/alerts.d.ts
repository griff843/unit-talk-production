export interface AlertRule {
    id: string;
    name: string;
    condition: string;
    threshold: number;
    severity: 'info' | 'warning' | 'critical';
    enabled: boolean;
    cooldownMinutes: number;
    channels: string[];
    tags: string[];
    description: string;
}
export interface Alert {
    id: string;
    ruleId: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    value: number;
    threshold: number;
    status: 'active' | 'resolved' | 'acknowledged';
    channels: string[];
    tags: string[];
    metadata: Record<string, any>;
    cooldownMinutes?: number;
}
export interface AlertChannel {
    id: string;
    name: string;
    type: 'discord' | 'slack' | 'email' | 'webhook' | 'sms';
    config: Record<string, any>;
    enabled: boolean;
    severityFilter: ('info' | 'warning' | 'critical')[];
}
export interface NotificationTemplate {
    id: string;
    name: string;
    channel: string;
    severity: string;
    template: string;
    variables: string[];
}
export type AlertTemplate = NotificationTemplate | {
    title: string;
    body: string;
};
export declare class EnhancedAlertManager {
    private rules;
    private channels;
    private templates;
    private activeAlerts;
    private alertHistory;
    private cooldowns;
    private escalationChains;
    constructor();
    getTemplate(channelType: string, severity: string): AlertTemplate;
    renderAlertMessage(alert: Alert, template: AlertTemplate): string;
    initializeDefaultRules(): void;
    initializeDefaultChannels(): void;
    initializeDefaultTemplates(): void;
    startAlertProcessor(): void;
    sendAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void>;
    sendSMSAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void>;
    sendEmailAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void>;
    sendDiscordAlert(channel: AlertChannel, message: string, alert: Alert): Promise<void>;
    sendWebhookAlert(channel: AlertChannel, alert: Alert): Promise<void>;
    sendNotifications(alert: Alert): Promise<void>;
    createAlert(alert: Alert): Promise<void>;
    resolveAlert(alertId: string): void;
    getActiveAlerts(): Alert[];
    getAlertHistory(): Alert[];
}
export declare const alertManager: EnhancedAlertManager;
//# sourceMappingURL=alerts.d.ts.map