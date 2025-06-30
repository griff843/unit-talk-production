// /utils/recapStub.ts

import { BaseAgent, BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../agents/BaseAgent/index.js';
import { logger } from '../services/logging.js';
import { supabaseClient } from '../services/supabaseClient.js';

export class RecapAgentStub extends BaseAgent {
  constructor() {
    const config: BaseAgentConfig = {
      name: 'RecapAgent',
      version: '1.0.0',
      description: 'Generates game recaps and performance analysis',
      healthCheck: { enabled: true, intervalMs: 30000 },
      metrics: { enabled: true, intervalMs: 60000 }
    };
    
    const deps: BaseAgentDependencies = {
      logger,
      supabase: supabaseClient
    };
    
    super(config, deps);
  }

  // Required BaseAgent implementations
  async initialize(): Promise<void> {
    this.logger.info('Initializing RecapAgent...');
  }

  async process(): Promise<void> {
    // Main processing loop - could check for games needing recaps
    this.logger.debug('RecapAgent processing...');
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up RecapAgent...');
  }

  async checkHealth(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      details: { service: 'recap-generation' },
      timestamp: new Date().toISOString()
    };
  }

  async collectMetrics(): Promise<Record<string, unknown>> {
    return {
      recapsGenerated: 0,
      averageProcessingTime: 0,
      timestamp: new Date().toISOString()
    };
  }

  async generateRecap(gameId: string, picks: any[]): Promise<string> {
    try {
      this.logger.info(`Generating recap for game ${gameId} with ${picks.length} picks`);
      
      // Fetch game data
      const { data: game, error: gameError } = await supabaseClient
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        throw new Error(`Failed to fetch game data: ${gameError.message}`);
      }

      // Analyze picks performance
      const winningPicks = picks.filter(pick => pick.result === 'win');
      const losingPicks = picks.filter(pick => pick.result === 'loss');
      const winRate = picks.length > 0 ? (winningPicks.length / picks.length) * 100 : 0;

      // Generate recap content
      const recap = this.buildRecapContent(game, picks, winningPicks, losingPicks, winRate);
      
      // Store recap in database
      await this.storeRecap(gameId, recap);
      
      this.logger.info(`Successfully generated recap for game ${gameId}`);
      return recap;
    } catch (error) {
      this.logger.error(`Error generating recap for game ${gameId}:`, error);
      throw error;
    }
  }

  private buildRecapContent(game: any, allPicks: any[], winningPicks: any[], losingPicks: any[], winRate: number): string {
    const recap = `
# Game Recap: ${game.home_team} vs ${game.away_team}

## Game Summary
- **Final Score**: ${game.home_score} - ${game.away_score}
- **Date**: ${new Date(game.date).toLocaleDateString()}
- **League**: ${game.league}

## Picks Performance
- **Total Picks**: ${allPicks.length}
- **Winning Picks**: ${winningPicks.length}
- **Losing Picks**: ${losingPicks.length}
- **Win Rate**: ${winRate.toFixed(1)}%

## Top Performers
${this.getTopPerformers(winningPicks)}

## Key Insights
${this.generateInsights(game, allPicks, winRate)}

## Community Stats
- **Most Popular Pick**: ${this.getMostPopularPick(allPicks)}
- **Highest Confidence Pick**: ${this.getHighestConfidencePick(allPicks)}
`;

    return recap;
  }

  private getTopPerformers(winningPicks: any[]): string {
    const capperStats = winningPicks.reduce((acc: Record<string, any>, pick: any) => {
      const capperId = pick.capper_id;
      if (!acc[capperId]) {
        acc[capperId] = { count: 0, totalOdds: 0, capperName: pick.capper_name || 'Unknown' };
      }
      acc[capperId].count++;
      acc[capperId].totalOdds += pick.odds || 0;
      return acc;
    }, {});

    const topCappers = Object.entries(capperStats)
      .sort(([, a], [, b]) => (b as any).count - (a as any).count)
      .slice(0, 3)
      .map(([, stats]) => `- **${(stats as any).capperName}**: ${(stats as any).count} winning picks`)
      .join('\n');

    return topCappers || '- No winning picks to highlight';
  }

  private generateInsights(game: any, picks: any[], winRate: number): string {
    const insights = [];
    
    if (winRate > 70) {
      insights.push('- Exceptional community performance with high win rate');
    } else if (winRate > 50) {
      insights.push('- Solid community performance above 50%');
    } else {
      insights.push('- Challenging game for the community');
    }

    const spreadPicks = picks.filter(p => p.bet_type?.toLowerCase().includes('spread'));
    const totalPicks = picks.filter(p => p.bet_type?.toLowerCase().includes('total'));
    
    if (spreadPicks.length > totalPicks.length) {
      insights.push('- Spread betting was more popular than totals');
    } else if (totalPicks.length > spreadPicks.length) {
      insights.push('- Total betting was more popular than spreads');
    }

    return insights.join('\n') || '- Standard game performance';
  }

  private getMostPopularPick(picks: any[]): string {
    const pickCounts = picks.reduce((acc: Record<string, number>, pick: any) => {
      const key = `${pick.bet_type} - ${pick.selection}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const mostPopular = Object.entries(pickCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return mostPopular ? `${mostPopular[0]} (${mostPopular[1]} picks)` : 'No clear favorite';
  }

  private getHighestConfidencePick(picks: any[]): string {
    const highestConfidence = picks.reduce((max: any, pick: any) => 
      (pick.confidence || 0) > (max.confidence || 0) ? pick : max, picks[0]);

    return highestConfidence 
      ? `${highestConfidence.bet_type} - ${highestConfidence.selection} (${highestConfidence.confidence}/5)`
      : 'No confidence data available';
  }

  private async storeRecap(gameId: string, content: string): Promise<void> {
    const { error } = await supabaseClient
      .from('recaps')
      .upsert({
        game_id: gameId,
        content,
        generated_at: new Date().toISOString(),
        status: 'published'
      });

    if (error) {
      throw new Error(`Failed to store recap: ${error.message}`);
    }
  }

  async getRecap(gameId: string): Promise<string | null> {
    try {
      const { data, error } = await supabaseClient
        .from('recaps')
        .select('content')
        .eq('game_id', gameId)
        .single();

      if (error) {
        this.logger.error(`Error fetching recap for game ${gameId}:`, error);
        return null;
      }

      return data?.content || null;
    } catch (error) {
      this.logger.error(`Error in getRecap for game ${gameId}:`, error);
      return null;
    }
  }
}