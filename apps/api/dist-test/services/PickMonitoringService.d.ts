/**
 * Pick Monitoring Service
 * Real-time monitoring of active picks with odds tracking and alert generation
 */
export interface MonitoredPick {
    id: string;
    propId: string;
    tier: string;
    status: 'active' | 'suspended' | 'cancelled' | 'settled';
    gameTime: Date;
    sport: string;
    playerName: string;
    statType: string;
    line: number;
    initialOdds: number;
    currentOdds: number;
    lastUpdate: Date;
    monitoringConfig: MonitoringConfig;
    alertHistory: Alert[];
    metrics: PickMetrics;
}
export interface MonitoringConfig {
    oddsMovementThreshold: number;
    volumeThreshold: number;
    steamThreshold: number;
    clvThreshold: number;
    marketDepthThreshold: number;
    updateFrequency: number;
    alertCooldown: number;
    autoRecheckEnabled: boolean;
    suspensionEnabled: boolean;
}
export interface Alert {
    id: string;
    pickId: string;
    type: 'odds_movement' | 'volume_spike' | 'steam_alert' | 'clv_change' | 'market_depth' | 'system_alert';
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    message: string;
    data: Record<string, any>;
    acknowledged: boolean;
    actionRequired: boolean;
    autoResolved: boolean;
}
export interface PickMetrics {
    totalUpdates: number;
    oddsChanges: number;
    maxOddsMovement: number;
    avgVolume: number;
    maxVolume: number;
    steamEvents: number;
    alertsGenerated: number;
    uptimePercentage: number;
    lastSuccessfulUpdate: Date;
    errorCount: number;
}
declare class PickMonitoringService {
    private static instance;
    private logger;
    private monitoredPicks;
    private monitoringActive;
    private updateInterval;
    private readonly DEFAULT_CONFIG;
    private constructor();
    static getInstance(): PickMonitoringService;
    /**
     * Start monitoring service
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop monitoring service
     */
    stopMonitoring(): void;
    /**
     * Add a pick to monitoring
     */
    addPickToMonitoring(pick: any, config?: Partial<MonitoringConfig>): Promise<void>;
    /**
     * Remove pick from monitoring
     */
    removePickFromMonitoring(pickId: string): void;
    /**
     * Update pick configuration
     */
    updatePickConfig(pickId: string, config: Partial<MonitoringConfig>): boolean;
    /**
     * Start monitoring loop
     */
    private startMonitoringLoop;
    /**
     * Update all monitored picks
     */
    private updateAllPicks;
    /**
     * Update a single monitored pick
     */
    private updateSinglePick;
    /**
     * Check for alerts based on updated data
     */
    private checkForAlerts;
    /**
     * Generate an alert
     */
    private generateAlert;
    /**
     * Handle critical alerts
     */
    private handleCriticalAlert;
    /**
     * Suspend a pick
     */
    private suspendPick;
    /**
     * Helper methods
     */
    private fetchLatestOddsData;
    private calculateOddsMovement;
    private calculateCLVChange;
    private loadActivePicks;
    private storePickUpdate;
    private storeAlert;
    /**
     * Get monitoring statistics
     */
    getMonitoringStats(): {
        totalPicks: number;
        activePicks: number;
        suspendedPicks: number;
        totalUpdates: number;
        totalAlerts: number;
        avgUptimePercentage: number;
        alertBreakdown: Record<string, number>;
    };
    /**
     * Get monitored pick details
     */
    getMonitoredPick(pickId: string): MonitoredPick | undefined;
    /**
     * Get all monitored picks
     */
    getAllMonitoredPicks(): MonitoredPick[];
}
export declare const pickMonitoringService: PickMonitoringService;
export {};
//# sourceMappingURL=PickMonitoringService.d.ts.map