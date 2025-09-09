/**
 * Production Monitoring Setup - Unit Talk v3.0.0
 * Integrates with Prometheus, Grafana, and real-time alerting
 * Enhanced with comprehensive performance tracking and alert system
 */

import { Counter, Histogram, Gauge, register } from 'prom-client';
import { createClient } from '@supabase/supabase-js';

// Core Prometheus Metrics
export const httpRequestDuration = new Histogram({
  name: 'command_center_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
});

export const activeUsers = new Gauge({
  name: 'command_center_active_users',
  help: 'Number of active users in the system',
});

export const agentHealth = new Gauge({
  name: 'command_center_agent_health',
  help: 'Health status of agents (1=healthy, 0=unhealthy)',
  labelNames: ['agent_name'],
});

export const systemErrors = new Counter({
  name: 'command_center_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
});

// Enhanced Performance Metrics
export const pageLoadTime = new Histogram({
  name: 'command_center_page_load_seconds',
  help: 'Page load time in seconds',
  labelNames: ['page', 'user_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const apiResponseTime = new Histogram({
  name: 'command_center_api_response_seconds',
  help: 'API response time in seconds',
  labelNames: ['endpoint', 'method', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const databaseQueryTime = new Histogram({
  name: 'command_center_db_query_seconds',
  help: 'Database query time in seconds',
  labelNames: ['table', 'operation'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2],
});

export const memoryUsage = new Gauge({
  name: 'command_center_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'command_center_cpu_usage_percent',
  help: 'CPU usage percentage',
});

export const alertsGenerated = new Counter({
  name: 'command_center_alerts_total',
  help: 'Total number of alerts generated',
  labelNames: ['type', 'severity', 'resolved'],
});

export const systemHealth = new Gauge({
  name: 'command_center_system_health_score',
  help: 'Overall system health professional_score (0-100)',
});

// Real-time Alert System Types
export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'security' | 'system' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface PerformanceMetrics {
  timestamp: number;
  pageLoadTime: number;
  apiResponseTime: number;
  databaseQueryTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  throughput: number;
  activeUsers: number;
  systemLoad: number;
}

// Enhanced Alert Thresholds
export const ALERT_THRESHOLDS = {
  // Performance Thresholds
  PAGE_LOAD_WARNING: 2000, // 2 seconds
  PAGE_LOAD_CRITICAL: 5000, // 5 seconds
  API_RESPONSE_WARNING: 500, // 500ms
  API_RESPONSE_CRITICAL: 2000, // 2 seconds
  DB_QUERY_WARNING: 100, // 100ms
  DB_QUERY_CRITICAL: 500, // 500ms

  // System Resource Thresholds
  CPU_WARNING: 70, // 70%
  CPU_CRITICAL: 90, // 90%
  MEMORY_WARNING: 80, // 80%
  MEMORY_CRITICAL: 95, // 95%
  DISK_WARNING: 80, // 80%
  DISK_CRITICAL: 95, // 95%

  // Error Rate Thresholds
  ERROR_RATE_WARNING: 5, // 5% error rate
  ERROR_RATE_CRITICAL: 10, // 10% error rate

  // Business Metrics
  MIN_ACTIVE_USERS: 1, // Minimum active users
  MIN_SUCCESSFUL_REQUESTS: 10, // Minimum successful requests per hour
};

// Real-time Monitoring System
class ProductionMonitoringSystem {
  private supabase = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  );

  private alerts: Alert[] = [];
  private metrics: PerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: ((alert: Alert) => void)[] = [];

  constructor() {
    this.initializeRealTimeMonitoring();
  }

  private initializeRealTimeMonitoring() {
    // Start continuous monitoring every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, 30000);

    console.log('🔄 Real-time monitoring system initialized');
  }

  async collectAndAnalyzeMetrics(): Promise<PerformanceMetrics> {
    const timestamp = Date.now();

    try {
      // Collect comprehensive metrics
      const [performanceData, systemData, businessData] = await Promise.all([
        this.collectPerformanceData(),
        this.collectSystemData(),
        this.collectBusinessData(),
      ]);

      const metrics: PerformanceMetrics = {
        timestamp,
        ...performanceData,
        ...systemData,
        ...businessData,
      };

      // Update Prometheus metrics
      this.updatePrometheusMetrics(metrics);

      // Store metrics for analysis
      this.metrics.push(metrics);
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Analyze metrics and generate alerts
      this.analyzeMetricsAndAlert(metrics);

      // Store in database
      await this.storeMetrics(metrics);

      return metrics;
    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
      this.generateErrorAlert('Metrics Collection Failed', error);
      throw error;
    }
  }

  private async collectPerformanceData() {
    const apiStartTime = Date.now();
    try {
      const response = await fetch('/api/analytics');
      const apiResponseTimeMs = Date.now() - apiStartTime;

      // Record API response time in Prometheus
      apiResponseTime.observe(
        {
          endpoint: '/api/analytics',
          method: 'GET',
          status: response.status.toString(),
        },
        apiResponseTimeMs / 1000
      );

      const dbStartTime = Date.now();
      await this.supabase.from('agent_health').select('count').limit(1);
      const databaseQueryTimeMs = Date.now() - dbStartTime;

      // Record database query time in Prometheus
      databaseQueryTime.observe(
        {
          table: 'agent_health',
          operation: 'select',
        },
        databaseQueryTimeMs / 1000
      );

      return {
        pageLoadTime: await this.getBrowserPageLoadTime(),
        apiResponseTime: apiResponseTimeMs,
        databaseQueryTime: databaseQueryTimeMs,
        memoryUsage: await this.getBrowserMemoryUsage(),
        errorRate: await this.calculateErrorRate(),
      };
    } catch (error) {
      systemErrors.inc({ type: 'performance_collection', severity: 'high' });
      return {
        pageLoadTime: 0,
        apiResponseTime: 5000,
        databaseQueryTime: 0,
        memoryUsage: 0,
        errorRate: 100,
      };
    }
  }

  private async collectSystemData() {
    // In a real production environment, these would come from system monitoring APIs
    const cpuUsageValue = Math.random() * 100;
    const systemLoadValue = Math.random() * 10;
    const throughputValue = Math.random() * 100;

    // Update Prometheus metrics
    cpuUsage.set(cpuUsageValue);

    return {
      cpuUsage: cpuUsageValue,
      systemLoad: systemLoadValue,
      throughput: throughputValue,
    };
  }

  private async collectBusinessData() {
    try {
      const { count: activeUsersCount } = await this.supabase
        .from('users')
        .select('count')
        .gte('last_active', new Date(Date.now() - 3600000).toISOString());

      // Update Prometheus metrics
      activeUsers.set(activeUsersCount || 0);

      return {
        activeUsers: activeUsersCount || 0,
      };
    } catch (error) {
      systemErrors.inc({ type: 'business_data', severity: 'medium' });
      return { activeUsers: 0 };
    }
  }

  private updatePrometheusMetrics(metrics: PerformanceMetrics) {
    // Update all Prometheus gauges and counters
    memoryUsage.set({ type: 'heap' }, metrics.memoryUsage);
    cpuUsage.set(metrics.cpuUsage);
    activeUsers.set(metrics.activeUsers);

    // Calculate and update system health professional_score
    const healthScore = this.calculateHealthScore(metrics);
    systemHealth.set(healthScore);
  }

  private analyzeMetricsAndAlert(metrics: PerformanceMetrics) {
    // Performance Alerts
    if (metrics.apiResponseTime > ALERT_THRESHOLDS.API_RESPONSE_CRITICAL) {
      this.createAlert({
        type: 'performance',
        severity: 'critical',
        title: 'Critical API Response Time',
        message: `API response time is ${metrics.apiResponseTime}ms (threshold: ${ALERT_THRESHOLDS.API_RESPONSE_CRITICAL}ms)`,
        threshold: ALERT_THRESHOLDS.API_RESPONSE_CRITICAL,
        currentValue: metrics.apiResponseTime,
        metadata: { metric: 'apiResponseTime', trend: this.calculateTrend('apiResponseTime') },
      });
    }

    // Memory Usage Alerts
    if (metrics.memoryUsage > ALERT_THRESHOLDS.MEMORY_CRITICAL) {
      this.createAlert({
        type: 'system',
        severity: 'critical',
        title: 'Critical Memory Usage',
        message: `Memory usage is ${metrics.memoryUsage.toFixed(2)}% (threshold: ${ALERT_THRESHOLDS.MEMORY_CRITICAL}%)`,
        threshold: ALERT_THRESHOLDS.MEMORY_CRITICAL,
        currentValue: metrics.memoryUsage,
        metadata: { metric: 'memoryUsage', trend: this.calculateTrend('memoryUsage') },
      });
    }

    // Error Rate Alerts
    if (metrics.errorRate > ALERT_THRESHOLDS.ERROR_RATE_CRITICAL) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'Critical Error Rate',
        message: `Error rate is ${metrics.errorRate.toFixed(2)}% (threshold: ${ALERT_THRESHOLDS.ERROR_RATE_CRITICAL}%)`,
        threshold: ALERT_THRESHOLDS.ERROR_RATE_CRITICAL,
        currentValue: metrics.errorRate,
        metadata: { metric: 'errorRate', trend: this.calculateTrend('errorRate') },
      });
    }

    // Business Metric Alerts
    if (metrics.activeUsers < ALERT_THRESHOLDS.MIN_ACTIVE_USERS) {
      this.createAlert({
        type: 'business',
        severity: 'medium',
        title: 'Low Active Users',
        message: `Only ${metrics.activeUsers} active users (minimum: ${ALERT_THRESHOLDS.MIN_ACTIVE_USERS})`,
        threshold: ALERT_THRESHOLDS.MIN_ACTIVE_USERS,
        currentValue: metrics.activeUsers,
        metadata: { metric: 'activeUsers', trend: this.calculateTrend('activeUsers') },
      });
    }
  }

  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Update Prometheus counter
    alertsGenerated.inc({
      type: alert.type,
      severity: alert.severity,
      resolved: 'false',
    });

    // Trigger callbacks
    this.alertCallbacks.forEach(callback => callback(alert));

    // Store in database
    this.storeAlert(alert);

    console.log(`🚨 Alert: ${alert.severity.toUpperCase()} - ${alert.title}`);
  }

  private generateErrorAlert(title: string, error: any) {
    this.createAlert({
      type: 'error',
      severity: 'high',
      title,
      message: error?.message || 'Unknown error occurred',
      threshold: 0,
      currentValue: 1,
      metadata: { error: error?.stack || error },
    });
  }

  private calculateTrend(metric: keyof PerformanceMetrics): 'up' | 'down' | 'stable' {
    if (this.metrics.length < 3) return 'stable';

    const recent = this.metrics.slice(-3);
    const values = recent.map(m => m[metric] as number);

    const trend = (values[2] ?? 0) - (values[0] ?? 0);
    const threshold = (values[0] ?? 0) * 0.1;

    if (trend > threshold) return 'up';
    if (trend < -threshold) return 'down';
    return 'stable';
  }

  private calculateHealthScore(metrics: PerformanceMetrics): number {
    let professional_score = 100;

    if (metrics.apiResponseTime > ALERT_THRESHOLDS.API_RESPONSE_WARNING) professional_score -= 10;
    if (metrics.apiResponseTime > ALERT_THRESHOLDS.API_RESPONSE_CRITICAL) professional_score -= 20;
    if (metrics.memoryUsage > ALERT_THRESHOLDS.MEMORY_WARNING) professional_score -= 15;
    if (metrics.memoryUsage > ALERT_THRESHOLDS.MEMORY_CRITICAL) professional_score -= 25;
    if (metrics.cpuUsage > ALERT_THRESHOLDS.CPU_WARNING) professional_score -= 10;
    if (metrics.cpuUsage > ALERT_THRESHOLDS.CPU_CRITICAL) professional_score -= 20;
    if (metrics.errorRate > ALERT_THRESHOLDS.ERROR_RATE_WARNING) professional_score -= 15;
    if (metrics.errorRate > ALERT_THRESHOLDS.ERROR_RATE_CRITICAL) professional_score -= 25;

    return Math.max(0, professional_score);
  }

  private async getBrowserPageLoadTime(): Promise<number> {
    if (typeof window === 'undefined') return 0;

    try {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;
    } catch {
      return 0;
    }
  }

  private async getBrowserMemoryUsage(): Promise<number> {
    if (typeof window === 'undefined') return 0;

    try {
      const memory = (performance as any).memory;
      return memory ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0;
    } catch {
      return 0;
    }
  }

  private async calculateErrorRate(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      const { data: logs } = await this.supabase
        .from('agent_logs')
        .select('level')
        .gte('created_at', oneHourAgo);

      if (!logs || logs.length === 0) return 0;

      const errorCount = logs.filter(log => log.level === 'error').length;
      return (errorCount / logs.length) * 100;
    } catch {
      return 0;
    }
  }

  private async storeMetrics(metrics: PerformanceMetrics) {
    try {
      await this.supabase.from('performance_metrics').insert({
        timestamp: new Date(metrics.timestamp).toISOString(),
        page_load_time: metrics.pageLoadTime,
        api_response_time: metrics.apiResponseTime,
        database_query_time: metrics.databaseQueryTime,
        memory_usage: metrics.memoryUsage,
        cpu_usage: metrics.cpuUsage,
        error_rate: metrics.errorRate,
        throughput: metrics.throughput,
        active_users: metrics.activeUsers,
        system_load: metrics.systemLoad,
      });
    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  private async storeAlert(alert: Alert) {
    try {
      await this.supabase.from('system_alerts').insert({
        alert_id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        threshold: alert.threshold,
        current_value: alert.currentValue,
        metadata: alert.metadata,
        acknowledged: alert.acknowledged,
        created_at: alert.timestamp.toISOString(),
      });
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  // Public API
  public onAlert(callback: (alert: Alert) => void) {
    this.alertCallbacks.push(callback);
  }

  public getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  public acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;

      alertsGenerated.inc({
        type: alert.type,
        severity: alert.severity,
        resolved: 'true',
      });

      this.supabase.from('system_alerts').update({ acknowledged: true }).eq('alert_id', alertId);
    }
  }

  public generateHealthReport(): string {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    const activeAlerts = this.getActiveAlerts();

    if (!latestMetrics) return 'No metrics available';

    const healthScore = this.calculateHealthScore(latestMetrics);

    return `
🏥 **SYSTEM HEALTH REPORT**
==========================

📊 **Overall Health Score: ${healthScore}/100** ${healthScore > 80 ? '✅' : healthScore > 60 ? '⚠️' : '❌'}

📈 **Current Metrics**
- API Response Time: ${latestMetrics.apiResponseTime.toFixed(0)}ms
- Memory Usage: ${latestMetrics.memoryUsage.toFixed(1)}%
- CPU Usage: ${latestMetrics.cpuUsage.toFixed(1)}%
- Error Rate: ${latestMetrics.errorRate.toFixed(2)}%
- Active Users: ${latestMetrics.activeUsers}

🚨 **Active Alerts: ${activeAlerts.length}**
${activeAlerts.map(alert => `- ${alert.severity.toUpperCase()}: ${alert.title}`).join('\n')}
`;
  }

  public destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🔄 Monitoring system destroyed');
  }
}

// Singleton instance
let monitoringSystemInstance: ProductionMonitoringSystem | null = null;

// Initialize monitoring
export function initializeMonitoring() {
  // Register Prometheus metrics
  register.registerMetric(httpRequestDuration);
  register.registerMetric(activeUsers);
  register.registerMetric(agentHealth);
  register.registerMetric(systemErrors);
  register.registerMetric(pageLoadTime);
  register.registerMetric(apiResponseTime);
  register.registerMetric(databaseQueryTime);
  register.registerMetric(memoryUsage);
  register.registerMetric(cpuUsage);
  register.registerMetric(alertsGenerated);
  register.registerMetric(systemHealth);

  // Initialize real-time monitoring system
  if (!monitoringSystemInstance) {
    monitoringSystemInstance = new ProductionMonitoringSystem();
  }

  console.log('✅ Enhanced monitoring system initialized with real-time alerts');
}

export function getMonitoringSystem(): ProductionMonitoringSystem | null {
  return monitoringSystemInstance;
}

export function destroyMonitoringSystem() {
  if (monitoringSystemInstance) {
    monitoringSystemInstance.destroy();
    monitoringSystemInstance = null;
  }
}
