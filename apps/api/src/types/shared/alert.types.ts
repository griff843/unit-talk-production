export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface AlertResult {
  success: boolean;
  error?: Error;
  alertId: string;
  timestamp: string;
}
