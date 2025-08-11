import { ActivityResult } from '../shared/activity-results';

interface BaseParams {
  agentId: string;
  timestamp?: string;
}

export interface CampaignAgentActivities {
  createCampaign(params: BaseParams): Promise<ActivityResult>;
} 
