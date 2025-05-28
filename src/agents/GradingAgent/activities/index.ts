import { GradingAgent } from '..';
import { GradingParams } from '../types';

export async function processGrades(params: GradingParams): Promise<void> {
  const agent = new GradingAgent();
  await agent.initialize();
  await agent.processGrades(params);
}

export async function calculateScores(params: GradingParams): Promise<void> {
  const agent = new GradingAgent();
  await agent.initialize();
  await agent.calculateScores(params);
}

export async function updateRankings(): Promise<void> {
  const agent = new GradingAgent();
  await agent.initialize();
  await agent.updateRankings();
}

export async function archiveGrades(): Promise<void> {
  const agent = new GradingAgent();
  await agent.initialize();
  await agent.archiveGrades();
} 