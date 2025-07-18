import { ActivityResult } from '../shared/activity-results';

interface BaseParams {
  agentId: string;
  timestamp?: string;
}

export interface PromoAgentActivities {
  createPromotion(params: BaseParams): Promise<ActivityResult>;
} 
