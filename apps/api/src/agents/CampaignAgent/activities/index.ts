import { CampaignAgent } from '..';
import { BaseAgentDependencies } from '../../BaseAgent/types';
import { CampaignParams } from '../types';

// Mock dependencies for activities
const getDependencies = (): BaseAgentDependencies => {
  // This would be properly injected in production
  return {
    supabase: null as any,
    logger: console as any,
    errorHandler: null as any
  };
};

export async function executeCampaign(params: CampaignParams): Promise<void> {
  const agent = CampaignAgent.getInstance(getDependencies());
  await agent.executeCampaign(params);
}

export async function validateCampaign(params: CampaignParams): Promise<void> {
  const agent = CampaignAgent.getInstance(getDependencies());
  await agent.validateCampaign(params);
}

export async function applyDiscounts(): Promise<void> {
  const agent = CampaignAgent.getInstance(getDependencies());
  await agent.applyDiscounts();
}

export async function cleanupExpiredCampaigns(): Promise<void> {
  const agent = CampaignAgent.getInstance(getDependencies());
  await agent.cleanupExpired();
} 