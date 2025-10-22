import axios from 'axios';
import { Logger } from '../../apps/api/src/services/logger';

interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

interface Anomaly {
  metric: string;
  timestamp: Date;
  value: number;
  expected: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  message: string;
}

interface AnomalyRule {
  metric: string;
  type: 'threshold' | 'rate' | 'pattern' | 'outlier';
  config: any;
  sensitivity: number;
}

export class AnomalyDetector {
  private logger: Logger;
  private prometheusUrl: string;
  private alertmanagerUrl: string;
  private historicalData: Map<string, number[]> = new Map();
  private anomalyRules: AnomalyRule[] = [];
  
  constructor(
    prometheusUrl: string,
    alertmanagerUrl: string,
    sensitivity: 'low' | 'medium' | 'high' = 'medium'
  ) {
    this.logger = new Logger('AnomalyDetector');
    this.prometheusUrl = prometheusUrl;
    this.alertmanagerUrl = alertmanagerUrl;
    
    this.initializeRules(sensitivity);
  }

  /**
   * Initialize anomaly detection rules
   */
  private initializeRules(sensitivity: string): void {
    const sensitivityMultiplier = {
      low: 3,
      medium: 2,
      high: 1.5,
    }[sensitivity] || 2;

    this.anomalyRules = [
      // Response time anomalies
      {
        metric: 'api_request_duration_seconds',
        type: 'outlier',
        config: {
          stdDevMultiplier: sensitivityMultiplier,
          minSamples: 100,
        },
        sensitivity: 0.8,
      },
      
      // Error rate spikes
      {
        metric: 'http_requests_total{status=~"5.."}',
        type: 'rate',
        config: {
          rateIncrease: 2, // 2x normal rate
          timeWindow: 300, // 5 minutes
        },
        sensitivity: 0.9,
      },
      
      // Queue depth anomalies
      {
        metric: 'queue_depth_total',
        type: 'threshold',
        config: {
          dynamicThreshold: true,
          percentile: 95,
          multiplier: sensitivityMultiplier,
        },
        sensitivity: 0.7,
      },
      
      // Memory leak detection
      {
        metric: 'process_resident_memory_bytes',
        type: 'pattern',
        config: {
          pattern: 'increasing',
          minDuration: 1800, // 30 minutes
          minIncrease: 0.1, // 10%
        },
        sensitivity: 0.85,
      },
      
      // Database connection anomalies
      {
        metric: 'database_connections_active',
        type: 'outlier',
        config: {
          iqrMultiplier: sensitivityMultiplier,
          useMAD: true, // Median Absolute Deviation
        },
        sensitivity: 0.75,
      },
      
      // Cache hit rate drops
      {
        metric: 'cache_hit_rate',
        type: 'threshold',
        config: {
          threshold: 70, // Below 70% is anomalous
          direction: 'below',
        },
        sensitivity: 0.6,
      },
    ];
  }

  /**
   * Run anomaly detection
   */
  async detect(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const rule of this.anomalyRules) {
      try {
        const detectedAnomalies = await this.checkRule(rule);
        anomalies.push(...detectedAnomalies);
      } catch (error) {
        this.logger.error(`Error checking rule for ${rule.metric}:`, error);
      }
    }

    // Correlate anomalies
    const correlatedAnomalies = this.correlateAnomalies(anomalies);
    
    // Send alerts for significant anomalies
    for (const anomaly of correlatedAnomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        await this.sendAlert(anomaly);
      }
    }

    return correlatedAnomalies;
  }

  /**
   * Check a specific rule
   */
  private async checkRule(rule: AnomalyRule): Promise<Anomaly[]> {
    const data = await this.fetchMetricData(rule.metric);
    
    if (data.length === 0) return [];

    // Update historical data
    this.updateHistoricalData(rule.metric, data);

    switch (rule.type) {
      case 'outlier':
        return this.detectOutliers(rule, data);
      case 'rate':
        return this.detectRateAnomalies(rule, data);
      case 'threshold':
        return this.detectThresholdAnomalies(rule, data);
      case 'pattern':
        return this.detectPatternAnomalies(rule, data);
      default:
        return [];
    }
  }

  /**
   * Fetch metric data from Prometheus
   */
  private async fetchMetricData(metric: string, duration: string = '1h'): Promise<Metric[]> {
    try {
      const response = await axios.get(`${this.prometheusUrl}/api/v1/query_range`, {
        params: {
          query: metric,
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString(),
          step: '15s',
        },
      });

      if (response.data.status !== 'success') {
        throw new Error(`Prometheus query failed: ${response.data.error}`);
      }

      const metrics: Metric[] = [];
      
      for (const result of response.data.data.result) {
        for (const [timestamp, value] of result.values) {
          metrics.push({
            name: result.metric.__name__ || metric,
            value: parseFloat(value),
            timestamp: timestamp * 1000,
            labels: result.metric,
          });
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to fetch metric ${metric}:`, error);
      return [];
    }
  }

  /**
   * Detect outliers using statistical methods
   */
  private detectOutliers(rule: AnomalyRule, data: Metric[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.map(d => d.value);
    
    if (values.length < rule.config.minSamples) return anomalies;

    if (rule.config.useMAD) {
      // Median Absolute Deviation method
      const median = this.calculateMedian(values);
      const mad = this.calculateMAD(values, median);
      const threshold = mad * rule.config.iqrMultiplier;

      for (let i = 0; i < data.length; i++) {
        const deviation = Math.abs(data[i].value - median);
        if (deviation > threshold) {
          anomalies.push(this.createAnomaly(
            rule.metric,
            data[i],
            median,
            deviation / mad,
            rule.sensitivity
          ));
        }
      }
    } else {
      // Standard deviation method
      const mean = this.calculateMean(values);
      const stdDev = this.calculateStdDev(values, mean);
      const threshold = stdDev * rule.config.stdDevMultiplier;

      for (let i = 0; i < data.length; i++) {
        const deviation = Math.abs(data[i].value - mean);
        if (deviation > threshold) {
          anomalies.push(this.createAnomaly(
            rule.metric,
            data[i],
            mean,
            deviation / stdDev,
            rule.sensitivity
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect rate-based anomalies
   */
  private detectRateAnomalies(rule: AnomalyRule, data: Metric[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const windowSize = rule.config.timeWindow * 1000; // Convert to ms
    
    // Calculate rates over time windows
    const now = Date.now();
    const currentWindowStart = now - windowSize;
    const previousWindowStart = currentWindowStart - windowSize;
    
    const currentRate = this.calculateRate(data, currentWindowStart, now);
    const previousRate = this.calculateRate(data, previousWindowStart, currentWindowStart);
    
    if (previousRate > 0 && currentRate / previousRate > rule.config.rateIncrease) {
      anomalies.push({
        metric: rule.metric,
        timestamp: new Date(),
        value: currentRate,
        expected: previousRate,
        deviation: (currentRate / previousRate) - 1,
        severity: this.calculateSeverity((currentRate / previousRate) - 1),
        confidence: rule.sensitivity,
        message: `Rate increased by ${((currentRate / previousRate - 1) * 100).toFixed(0)}%`,
      });
    }
    
    return anomalies;
  }

  /**
   * Detect threshold-based anomalies
   */
  private detectThresholdAnomalies(rule: AnomalyRule, data: Metric[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.map(d => d.value);
    
    let threshold = rule.config.threshold;
    
    if (rule.config.dynamicThreshold) {
      // Calculate dynamic threshold based on historical data
      const historical = this.historicalData.get(rule.metric) || values;
      threshold = this.calculatePercentile(historical, rule.config.percentile) * rule.config.multiplier;
    }
    
    for (const metric of data) {
      const breached = rule.config.direction === 'below' 
        ? metric.value < threshold
        : metric.value > threshold;
        
      if (breached) {
        anomalies.push(this.createAnomaly(
          rule.metric,
          metric,
          threshold,
          Math.abs(metric.value - threshold) / threshold,
          rule.sensitivity
        ));
      }
    }
    
    return anomalies;
  }

  /**
   * Detect pattern-based anomalies
   */
  private detectPatternAnomalies(rule: AnomalyRule, data: Metric[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (rule.config.pattern === 'increasing') {
      // Check for monotonic increase
      const duration = data[data.length - 1].timestamp - data[0].timestamp;
      
      if (duration >= rule.config.minDuration * 1000) {
        const startValue = data[0].value;
        const endValue = data[data.length - 1].value;
        const increase = (endValue - startValue) / startValue;
        
        if (increase >= rule.config.minIncrease) {
          let isIncreasing = true;
          for (let i = 1; i < data.length; i++) {
            if (data[i].value < data[i - 1].value * 0.95) { // Allow 5% fluctuation
              isIncreasing = false;
              break;
            }
          }
          
          if (isIncreasing) {
            anomalies.push({
              metric: rule.metric,
              timestamp: new Date(),
              value: endValue,
              expected: startValue,
              deviation: increase,
              severity: 'high',
              confidence: rule.sensitivity,
              message: `Continuous increase detected: ${(increase * 100).toFixed(0)}% over ${rule.config.minDuration / 60} minutes`,
            });
          }
        }
      }
    }
    
    return anomalies;
  }

  /**
   * Correlate anomalies across metrics
   */
  private correlateAnomalies(anomalies: Anomaly[]): Anomaly[] {
    const correlated = [...anomalies];
    
    // Group anomalies by time window (1 minute)
    const timeGroups = new Map<number, Anomaly[]>();
    
    for (const anomaly of anomalies) {
      const bucket = Math.floor(anomaly.timestamp.getTime() / 60000);
      if (!timeGroups.has(bucket)) {
        timeGroups.set(bucket, []);
      }
      timeGroups.get(bucket)!.push(anomaly);
    }
    
    // Look for correlated anomalies
    for (const [bucket, group] of timeGroups) {
      if (group.length > 1) {
        // Multiple anomalies in the same time window
        const hasHighSeverity = group.some(a => a.severity === 'high' || a.severity === 'critical');
        
        // Upgrade severity if multiple anomalies occur together
        if (hasHighSeverity) {
          for (const anomaly of group) {
            if (anomaly.severity === 'medium') {
              anomaly.severity = 'high';
              anomaly.message += ' (correlated with other anomalies)';
            }
          }
        }
      }
    }
    
    return correlated;
  }

  /**
   * Update historical data
   */
  private updateHistoricalData(metric: string, data: Metric[]): void {
    const values = data.map(d => d.value);
    const historical = this.historicalData.get(metric) || [];
    
    // Keep last 7 days of data (assuming 15s intervals)
    const maxSize = 7 * 24 * 60 * 4; // 7 days * 24 hours * 60 minutes * 4 (15s intervals)
    
    historical.push(...values);
    if (historical.length > maxSize) {
      historical.splice(0, historical.length - maxSize);
    }
    
    this.historicalData.set(metric, historical);
  }

  /**
   * Create anomaly object
   */
  private createAnomaly(
    metric: string,
    data: Metric,
    expected: number,
    deviationScore: number,
    confidence: number
  ): Anomaly {
    const severity = this.calculateSeverity(deviationScore);
    
    return {
      metric,
      timestamp: new Date(data.timestamp),
      value: data.value,
      expected,
      deviation: deviationScore,
      severity,
      confidence,
      message: `${metric} anomaly detected: ${data.value.toFixed(2)} (expected: ${expected.toFixed(2)})`,
    };
  }

  /**
   * Calculate severity based on deviation
   */
  private calculateSeverity(deviation: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviation > 5) return 'critical';
    if (deviation > 3) return 'high';
    if (deviation > 2) return 'medium';
    return 'low';
  }

  /**
   * Send alert to Alertmanager
   */
  private async sendAlert(anomaly: Anomaly): Promise<void> {
    try {
      const alert = {
        labels: {
          alertname: 'AnomalyDetected',
          severity: anomaly.severity,
          metric: anomaly.metric,
        },
        annotations: {
          summary: anomaly.message,
          description: `Anomaly detected in ${anomaly.metric}. Value: ${anomaly.value}, Expected: ${anomaly.expected}, Deviation: ${anomaly.deviation.toFixed(2)}σ`,
          confidence: anomaly.confidence.toString(),
        },
        startsAt: anomaly.timestamp.toISOString(),
        endsAt: new Date(anomaly.timestamp.getTime() + 300000).toISOString(), // 5 minutes
      };
      
      await axios.post(`${this.alertmanagerUrl}/api/v1/alerts`, [alert]);
      
      this.logger.info(`Alert sent for ${anomaly.metric} anomaly`);
    } catch (error) {
      this.logger.error('Failed to send alert:', error);
    }
  }

  // Statistical utility functions
  
  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculateMAD(values: number[], median: number): number {
    const absoluteDeviations = values.map(v => Math.abs(v - median));
    return this.calculateMedian(absoluteDeviations);
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }
  
  private calculateRate(data: Metric[], startTime: number, endTime: number): number {
    const windowData = data.filter(d => d.timestamp >= startTime && d.timestamp <= endTime);
    if (windowData.length === 0) return 0;
    
    const duration = (endTime - startTime) / 1000; // seconds
    return windowData.reduce((sum, d) => sum + d.value, 0) / duration;
  }
}

// Main execution
async function main() {
  const detector = new AnomalyDetector(
    process.env.PROMETHEUS_URL || 'http://prometheus:9090',
    process.env.ALERTMANAGER_URL || 'http://alertmanager:9093',
    (process.env.SENSITIVITY as any) || 'medium'
  );

  const interval = parseInt(process.env.DETECTION_INTERVAL || '60') * 1000;

  const logger = new Logger('AnomalyDetectorMain');
  logger.info(`Starting anomaly detection with ${interval / 1000}s interval`);

  // Run detection loop
  setInterval(async () => {
    try {
      const anomalies = await detector.detect();
      
      if (anomalies.length > 0) {
        logger.info(`Detected ${anomalies.length} anomalies`);
        for (const anomaly of anomalies) {
          logger.info(`  - ${anomaly.metric}: ${anomaly.message}`);
        }
      }
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
    }
  }, interval);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down anomaly detector...');
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default AnomalyDetector;