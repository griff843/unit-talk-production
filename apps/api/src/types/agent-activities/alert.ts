import { AlertResult } from '../shared/activity-results';

export interface AlertAgentActivities {
  processAlert(params: {
    alertId: string;
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    context?: Record<string, unknown>;
  }): Promise<AlertResult>;

  sendOperatorAlert(params: {
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    context?: Record<string, unknown>;
  }): Promise<AlertResult>;

  sendFallbackTrigger(params: {
    service: string;
    reason: string;
    context?: Record<string, unknown>;
  }): Promise<AlertResult>;
} 