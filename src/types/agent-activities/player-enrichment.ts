import type { BaseParams } from '../../agents/BaseAgent/types/index';
import { PlayerEnrichmentResult, HeadshotResult } from '../shared/activity-results';
import { BaseAgent } from '../BaseAgent';

export interface PlayerEnrichmentAgentActivities {
  enrichAllPlayers(params: BaseParams): Promise<PlayerEnrichmentResult>;
  enrichPlayerById(params: BaseParams & { playerId: string }): Promise<PlayerEnrichmentResult>;
  getPlayerHeadshot(params: BaseParams & { playerName: string; league: string }): Promise<HeadshotResult>;
  getMlbHeadshot(params: BaseParams & { playerName: string }): Promise<HeadshotResult>;
  getNbaHeadshot(params: BaseParams & { playerName: string }): Promise<HeadshotResult>;
} 
