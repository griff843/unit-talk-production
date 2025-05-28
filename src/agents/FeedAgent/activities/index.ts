import { FeedAgent } from '..';
import { FeedParams } from '../types';

export async function processFeed(params: FeedParams): Promise<void> {
  const agent = new FeedAgent();
  await agent.initialize();
  await agent.processFeed(params);
}

export async function fetchFromProvider(params: FeedParams): Promise<void> {
  const agent = new FeedAgent();
  await agent.initialize();
  await agent.fetchFromProvider(params);
}

export async function checkIngestionState(): Promise<void> {
  const agent = new FeedAgent();
  await agent.initialize();
  await agent.checkIngestionState();
}

export async function logCoverage(): Promise<void> {
  const agent = new FeedAgent();
  await agent.initialize();
  await agent.logCoverage();
} 