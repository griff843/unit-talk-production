/**
 * Risk Monitoring Types
 * Placeholder type definitions for live testing risk monitoring
 */

export interface RiskMetric {
  id: string;
  type: 'portfolio' | 'position' | 'market';
  level: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface RiskAssessment {
  overall: RiskMetric;
  components: RiskMetric[];
  recommendations: string[];
}

// Add more types as needed
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';