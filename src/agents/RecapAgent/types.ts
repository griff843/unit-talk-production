import { BaseAgentConfig } from '../BaseAgent/types';
import { FinalPick } from '../../types/picks';

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

export interface CapperStats {
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
}

export interface MVPData {
  capper: string;
  units: number;
  roi: number;
  winRate: number;
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
  capperStatsArr: CapperStats[];
  mvp: MVPData | null;
  dollarLine: string;
  fullResultsLink: string;
  picks: FinalPick[];
}