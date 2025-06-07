import { BaseAgentConfig } from '../BaseAgent/types';

export interface RecapAgentConfig extends BaseAgentConfig {
  recap?: {
    defaultTimeframe?: 'daily' | 'weekly' | 'monthly';
    includeCharts?: boolean;
    notificationChannels?: string[];
  };
}

export interface RecapParams {
  date?: string;
  timeframe?: 'daily' | 'weekly' | 'monthly';
  includeDetails?: boolean;
}

export interface RecapResult {
  date: string;
  teamStats: {
    units: number;
    win: number;
    loss: number;
    roi: number;
    l3: string;
    l5: string;
    l10: string;
    streak: string;
  };
  capperStatsArr: Array<{
    capper: string;
    units: number;
    win: number;
    loss: number;
    roi: number;
    l3: string;
    l5: string;
    l10: string;
    streak: string;
    pickLines: string[];
  }>;
  mvp: any;
  dollarLine: string;
  fullResultsLink: string;
  picks: any[];
} 