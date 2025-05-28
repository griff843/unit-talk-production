import { ContestAgent } from '..';
import { ContestParams } from '../types';

export async function manageContest(params: ContestParams): Promise<void> {
  const agent = new ContestAgent();
  await agent.initialize();
  await agent.manageContest(params);
}

export async function validateEntries(params: ContestParams): Promise<void> {
  const agent = new ContestAgent();
  await agent.initialize();
  await agent.validateEntries(params);
}

export async function distributeRewards(): Promise<void> {
  const agent = new ContestAgent();
  await agent.initialize();
  await agent.distributeRewards();
}

export async function archiveContests(): Promise<void> {
  const agent = new ContestAgent();
  await agent.initialize();
  await agent.archiveContests();
} 