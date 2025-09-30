/**
 * Performance Tracking Types
 * Placeholder type definitions for live testing performance tracking
 */

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: Date;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    total: number;
    average: number;
    peak: number;
  };
}

// Add more types as needed
export type PerformanceStatus = 'optimal' | 'warning' | 'critical';