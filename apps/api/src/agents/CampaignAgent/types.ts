import { BaseAgentConfig } from '../BaseAgent/types';

export interface CampaignAgentConfig extends BaseAgentConfig {
  campaigns?: {
    maxActiveCampaigns?: number;
    defaultDuration?: number;
    allowStacking?: boolean;
  };
}

export interface CampaignConfig {
  name: string;
  startDate: string;
  endDate: string;
  type: 'percentage' | 'fixed' | 'bogo';
  value: number;
  conditions?: {
    minAmount?: number;
    maxUses?: number;
    eligibleProducts?: string[];
  };
}

export interface CampaignParams extends CampaignConfig {
  id?: string;
  active?: boolean;
  applied_count?: number;
} 