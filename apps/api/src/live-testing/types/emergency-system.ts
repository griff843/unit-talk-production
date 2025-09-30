/**
 * Emergency System Types
 * Placeholder type definitions for live testing emergency system
 */

export interface EmergencyAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'system' | 'financial' | 'security' | 'performance';
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface EmergencyResponse {
  alertId: string;
  action: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  timestamp: Date;
}

// Add more types as needed
export type EmergencySeverity = 'low' | 'medium' | 'high' | 'critical';