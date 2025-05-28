import { AlertAgent } from '..';
import { AlertParams } from '../types';

export async function processAlert(params: AlertParams): Promise<void> {
  const agent = new AlertAgent();
  await agent.initialize();
  await agent.processAlert(params);
}

export async function evaluateConditions(params: AlertParams): Promise<void> {
  const agent = new AlertAgent();
  await agent.initialize();
  await agent.evaluateConditions(params);
}

export async function sendAlerts(): Promise<void> {
  const agent = new AlertAgent();
  await agent.initialize();
  await agent.sendAlerts();
}

export async function cleanupAlerts(): Promise<void> {
  const agent = new AlertAgent();
  await agent.initialize();
  await agent.cleanupAlerts();
} 