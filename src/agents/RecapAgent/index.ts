import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics
} from '../BaseAgent/types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const em = {
  win: '✅', lose: '❌', push: '➖',
  up: '🟢 ▲', down: '🔴 ▼', mvp: '🏆', fire: '🔥'
};
const DOLLAR_SIZES = [20, 50, 100, 250];

function to2(n: number) {
  return Number(n).toFixed(2);
}

function capperStats(picks: any[]) {
  const units = picks.reduce((acc, p) => acc + (p.units ?? 0), 0);
  const win = picks.filter(p => p.outcome === 'win').length;
  const loss = picks.filter(p => p.outcome === 'loss').length;
  const roi = picks.length ? ((units / Math.abs(picks.reduce((acc, p) => acc + Math.abs(p.units ?? 0), 0) || 1)) * 100) : 0;
  const l3 = picks.slice(-3);
  const l5 = picks.slice(-5);
  const l10 = picks.slice(-10);
  return {
    units: +to2(units),
    win,
    loss,
    roi: +to2(roi),
    l3: `${l3.filter(p => p.outcome === 'win').length}-${l3.filter(p => p.outcome === 'loss').length}`,
    l5: `${l5.filter(p => p.outcome === 'win').length}-${l5.filter(p => p.outcome === 'loss').length}`,
    l10: `${l10.filter(p => p.outcome === 'win').length}-${l10.filter(p => p.outcome === 'loss').length}`,
    streak: getStreak(picks)
  };
}

function getStreak(picks: any[]) {
  let streak = 0;
  let last: string | null = null;
  for (let i = picks.length - 1; i >= 0; i--) {
    if (!last) last = picks[i].outcome;
    if (picks[i].outcome === last) streak++;
    else break;
  }
  return last ? `${last === 'win' ? 'W' : last === 'loss' ? 'L' : ''}${streak}` : '';
}

function formatPickLine(pick: any) {
  const outcome = pick.outcome === 'win' ? em.win : pick.outcome === 'loss' ? em.lose : em.push;
  const units = Number(pick.units ?? 0);
  return `${outcome} ${pick.prop_name || pick.player_name || pick.market || 'N/A'} (${units >= 0 ? '+' : ''}${to2(units)}u)`;
}

function bestCapper(statsArr: any[]) {
  return statsArr.sort((a, b) => b.units - a.units)[0];
}

function dollars(units: number, unit: number) {
  return (units * unit).toFixed(2);
}

let instance: RecapAgent | null = null;

export class RecapAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing RecapAgent...');
    
    try {
      await this.validateDependencies();
      this.deps.logger.info('RecapAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize RecapAgent:', error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const { error } = await this.deps.supabase
      .from('final_picks')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Failed to access final_picks table: ${error.message}`);
    }
  }

  protected async process(): Promise<void> {
    try {
      // Generate daily recap by default
      const yesterday = subDays(new Date(), 1);
      await this.generateRecap({ date: yesterday.toISOString() });
    } catch (error) {
      this.deps.logger.error('Error in RecapAgent process:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.deps.logger.info('RecapAgent cleanup completed');
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    
    try {
      const { error } = await this.deps.supabase
        .from('final_picks')
        .select('id')
        .limit(1);

      if (error) {
        errors.push(`Database connectivity issue: ${error.message}`);
      }
    } catch (error) {
      errors.push(`Health check failed: ${error}`);
    }

    return {
      status: errors.length > 0 ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      details: { errors }
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const { data: recentPicks } = await this.deps.supabase
      .from('final_picks')
      .select('outcome, units')
      .gte('graded_at', subDays(new Date(), 7).toISOString());

    const wins = recentPicks?.filter(p => p.outcome === 'win').length || 0;
    const losses = recentPicks?.filter(p => p.outcome === 'loss').length || 0;
    const totalUnits = recentPicks?.reduce((sum, p) => sum + (p.units || 0), 0) || 0;

    return {
      successCount: wins,
      errorCount: losses,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      'custom.totalUnits': totalUnits,
      'custom.winRate': wins / (wins + losses) || 0
    };
  }

  // Public method for generating recap
  public async generateRecap({ date }: { date?: string }) {
    const recapDate = date ? new Date(date) : subDays(new Date(), 1);
    const from = startOfDay(recapDate);
    const to = endOfDay(recapDate);

    // 1. Get picks for the recap day
    const { data: picks, error } = await this.deps.supabase
      .from('final_picks')
      .select('*')
      .gte('graded_at', from.toISOString())
      .lte('graded_at', to.toISOString());

    if (error) throw error;
    if (!picks || picks.length === 0) {
      this.deps.logger.warn('No picks found for recap period.');
      return null;
    }

    // 2. Per-capper grouping
    const cappers = [...new Set(picks.map(p => p.capper))];
    const grouped: Record<string, any[]> = {};
    cappers.forEach(capper => {
      grouped[capper] = picks.filter(p => p.capper === capper);
    });

    // 3. Per-capper stats & pick lines
    const capperStatsArr = cappers.map(capper => {
      const picksArr = grouped[capper];
      const stats = capperStats(picksArr);
      const pickLines = picksArr.map(formatPickLine);
      return {
        capper,
        ...stats,
        pickLines
      };
    });

    // 4. Team stats
    const teamStats = capperStats(picks);

    // 5. MVP logic
    const mvp = bestCapper(capperStatsArr);

    // 6. Dollar conversions
    const dollarLine = DOLLAR_SIZES.map(d => `🟢 $${d} bettors: $${dollars(teamStats.units, d)}`).join('\n');

    // 7. Full Results/Dashboard link
    const fullResultsLink = `[See all picks](https://yourdashboard.com/results/${format(from, 'yyyy-MM-dd')})`;

    // 8. Store recap
    const recap = {
      date: format(from, 'yyyy-MM-dd'),
      teamStats,
      capperStatsArr,
      mvp,
      dollarLine,
      fullResultsLink,
      picks
    };

    // Save to database
    await this.saveRecap(recap);

    return recap;
  }

  private async saveRecap(recap: any): Promise<void> {
    const { error } = await this.deps.supabase
      .from('daily_recaps')
      .upsert({
        date: recap.date,
        recap_data: recap,
        created_at: new Date().toISOString()
      });

    if (error) {
      this.deps.logger.error('Failed to save recap:', error);
      throw error;
    }
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): RecapAgent {
    if (!instance) {
      const config = dependencies.logger?.config || {} as BaseAgentConfig;
      instance = new RecapAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializeRecapAgent(dependencies: BaseAgentDependencies): RecapAgent {
  const config = dependencies.logger?.config || {} as BaseAgentConfig;
  return new RecapAgent(config, dependencies);
}

// Legacy function export for backwards compatibility
export async function RecapAgentFunction({ date }: { date?: string }) {
  const deps: BaseAgentDependencies = {
    supabase: (await import('../../services/supabaseClient')).supabase,
    logger: console as any,
    errorHandler: null as any
  };
  
  const agent = new RecapAgent({} as BaseAgentConfig, deps);
  return await agent.generateRecap({ date });
}