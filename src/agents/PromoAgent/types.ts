import { BaseAgentConfig } from '../BaseAgent/types';

export interface PromoAgentConfig extends BaseAgentConfig {
  promo?: {
    maxActivePromos?: number;
    defaultDuration?: number;
    allowStacking?: boolean;
  };
}

export interface PromotionConfig {
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

export interface PromoParams extends PromotionConfig {
  id?: string;
  active?: boolean;
  applied_count?: number;
} 