export declare class EnhancedMonitoringSystem {
    private metricStreams;
    private alertThresholds;
    private logger;
    constructor();
    private initializeMonitoring;
    monitorMetric(metricName: string, value: number): Promise<void>;
    private handleThresholdBreach;
    private triggerRecoveryProcedure;
    private handleModelAccuracyDrop;
    private handleLatencySpike;
    private handleDataQualityIssue;
    private handleRiskExposureBreach;
    private switchToBackupModel;
    private initiateModelRetraining;
    private scaleComputeResources;
    private optimizeSystemPerformance;
    private switchToBackupDataSource;
    private validateDataPipeline;
    private reducePositionSizes;
    private rebalancePortfolio;
    private setupMetricStream;
    private isThresholdBreached;
    private updateMetricStream;
    private sendAlertNotifications;
    triggerAlert(alertType: string, data: any): Promise<void>;
}
//# sourceMappingURL=enhanced-monitoring.d.ts.map