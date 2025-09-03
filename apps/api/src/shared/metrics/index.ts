import { logger } from '../../services/logging';

export class MetricsService {
  private logger = logger;

  public recordMetric(metricName: string, value: number) {
    this.logger.info(`Metric recorded: ${metricName} = ${value}`);
  }

  public incrementCounter(counterName: string) {
    this.logger.info(`Counter incremented: ${counterName}`);
  }
}