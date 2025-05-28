import { PromoAgent } from '..';
import { PromoParams } from '../types';

export async function executePromotion(params: PromoParams): Promise<void> {
  const agent = new PromoAgent();
  await agent.initialize();
  await agent.executePromotion(params);
}

export async function validatePromo(params: PromoParams): Promise<void> {
  const agent = new PromoAgent();
  await agent.initialize();
  await agent.validatePromo(params);
}

export async function applyDiscounts(): Promise<void> {
  const agent = new PromoAgent();
  await agent.initialize();
  await agent.applyDiscounts();
}

export async function cleanupExpiredPromos(): Promise<void> {
  const agent = new PromoAgent();
  await agent.initialize();
  await agent.cleanupExpired();
} 