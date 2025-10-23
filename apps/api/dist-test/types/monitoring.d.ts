export declare enum AlertLevel {
    CRITICAL = "CRITICAL",
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}
export declare enum SystemComponent {
    ML = "ML",
    RISK = "RISK",
    DATA = "DATA",
    INFRASTRUCTURE = "INFRASTRUCTURE"
}
export interface MetricStream {
    component: SystemComponent;
    alertLevel: AlertLevel;
    threshold: number;
    values: number[];
    timestamps: string[];
    maxSize: number;
}
export interface Alert {
    id: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: string;
    severity: AlertLevel;
    component: SystemComponent;
    message?: string;
    context?: Record<string, any>;
}
export interface RecoveryAction {
    id: string;
    alertId: string;
    action: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startTime: string;
    endTime?: string;
    result?: string;
    error?: string;
}
export interface MonitoringConfig {
    metrics: {
        [key: string]: {
            component: SystemComponent;
            alertLevel: AlertLevel;
            threshold: number;
            description: string;
        };
    };
    streams: {
        maxSize: number;
        retentionPeriod: string;
    };
    alerts: {
        channels: string[];
        retryPolicy: {
            maxAttempts: number;
            backoffMs: number;
        };
    };
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'critical';
    components: {
        [key in SystemComponent]: {
            status: 'healthy' | 'degraded' | 'critical';
            metrics: {
                [key: string]: number;
            };
            lastUpdate: string;
        };
    };
    timestamp: string;
}
export interface SystemStatus {
    status: 'healthy' | 'degraded' | 'error' | 'initializing' | 'ready';
    components: {
        monitoring: string;
        ml: string;
        risk: string;
    };
    lastUpdate: string;
    metrics?: {
        prediction: {
            accuracy: number;
            latency: number;
        };
        risk: {
            exposure: number;
            violations: number;
        };
        system: {
            uptime: number;
            memory: any;
        };
    };
}
//# sourceMappingURL=monitoring.d.ts.map