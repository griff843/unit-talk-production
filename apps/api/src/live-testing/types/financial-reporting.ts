/**
 * Financial Reporting Types
 * Placeholder type definitions for live testing financial reporting
 */

export interface FinancialMetric {
  id: string;
  name: string;
  value: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly';
  timestamp: Date;
}

export interface FinancialReport {
  period: string;
  metrics: FinancialMetric[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    roi: number;
  };
}

// Add more types as needed
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';