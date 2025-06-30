import { BaseAgentDependencies } from '../../BaseAgent/types';
import { PromoAgent } from '..';
import { PromoParams } from '../types';

// Mock dependencies for activities
const getDependencies = (): BaseAgentDependencies => {
  // This would be properly injected in production
  return {
    supabase: null as any,
    logger: console as any,
    errorHandler: null as any
  };
};

export async function executePromotion(params: PromoParams): Promise<void> {
  const agent = PromoAgent.getInstance(getDependencies());
  await agent.executePromotion(params);
}

export async function validatePromo(params: PromoParams): Promise<void> {
  const agent = PromoAgent.getInstance(getDependencies());
  await agent.validatePromo(params);
}

export async function applyDiscounts(): Promise<void> {
  const agent = PromoAgent.getInstance(getDependencies());
  await agent.applyDiscounts();
}

export async function cleanupExpiredPromos(): Promise<void> {
  const agent = PromoAgent.getInstance(getDependencies());
  await agent.cleanupExpired();
} 