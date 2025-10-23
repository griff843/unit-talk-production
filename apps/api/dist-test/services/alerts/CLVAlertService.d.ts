/**
 * CLV Alert Service
 * Monitors CLV performance and alerts admin when thresholds are breached
 * Private alerts only - never shown to public users
 *
 * @module CLVAlertService
 */
export interface AlertThresholds {
    critical: {
        clv: number;
        duration: number;
    };
    warning: {
        clv: number;
        duration: number;
    };
    investigate: {
        clv: number;
        duration: number;
    };
}
export interface CLVAlert {
    id: string;
    level: 'critical' | 'warning' | 'investigate';
    message: string;
    details: {
        currentCLV: number;
        duration: number;
        trend: 'improving' | 'stable' | 'declining';
        affectedMarkets?: string[];
        affectedBooks?: string[];
    };
    createdAt: Date;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
}
export declare class CLVAlertService {
    private static instance;
    private logger;
    private thresholds;
    private alertChannels;
    private constructor();
    static getInstance(): CLVAlertService;
    /**
     * Main monitoring function - should run every hour
     */
    monitorCLV(): Promise<void>;
    /**
     * Check critical threshold
     */
    private checkCriticalThreshold;
    /**
     * Check warning threshold
     */
    private checkWarningThreshold;
    /**
     * Check investigate threshold
     */
    private checkInvestigateThreshold;
    /**
     * Check for rapid CLV decline
     */
    private checkRapidDecline;
    /**
     * Check market-specific CLV issues
     */
    private checkMarketSpecificIssues;
    /**
     * Check book-specific CLV issues
     */
    private checkBookSpecificIssues;
    /**
     * Check if similar alert already exists
     */
    private getExistingAlert;
    /**
     * Create and send alert
     */
    private createAndSendAlert;
    /**
     * Send alert to configured channels
     */
    private sendAlert;
    /**
     * Format alert message
     */
    private formatAlertMessage;
    /**
     * Send Discord alert
     */
    private sendDiscordAlert;
    /**
     * Send email alert
     */
    private sendEmailAlert;
    /**
     * Send SMS alert
     */
    private sendSMSAlert;
    /**
     * Send Slack alert
     */
    private sendSlackAlert;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, userId: string): Promise<void>;
    /**
     * Get active alerts
     */
    getActiveAlerts(): Promise<CLVAlert[]>;
    /**
     * Update alert thresholds
     */
    updateThresholds(newThresholds: Partial<AlertThresholds>): void;
}
export declare const clvAlertService: CLVAlertService;
//# sourceMappingURL=CLVAlertService.d.ts.map