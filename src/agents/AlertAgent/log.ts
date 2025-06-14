import { SupabaseClient } from '@supabase/supabase-js';
import { FinalPick } from '../../db/types/final_picks';

interface AlertLogEntry {
  bet_id: string;
  player: string;
  market: string;
  odds: number;
  line: number;
  advice_given: string;
  tier: string;
  confidence?: number;
  sport?: string;
  league?: string;
  alert_priority?: string;
  processing_time_ms?: number;
  created_at: string;
}

interface AlertOutcome {
  bet_id: string;
  outcome: 'win' | 'loss' | 'push' | 'void';
  actual_value?: number;
  profit_loss?: number;
  closing_line?: number;
  closing_line_value?: number;
  settled_at: string;
}

interface PerformanceMetrics {
  totalAlerts: number;
  winRate: number;
  avgROI: number;
  profitLoss: number;
  byTier: Record<string, { count: number; winRate: number; roi: number }>;
  byAdvice: Record<string, { count: number; winRate: number; roi: number }>;
}

export async function logAlertRecord(
  supabase: SupabaseClient,
  pick: FinalPick,
  advice: string,
  processingTimeMs?: number
): Promise<void> {
  try {
    const logEntry: AlertLogEntry = {
      bet_id: pick.id,
      player: pick.player_id,
      market: pick.stat_type,
      odds: pick.odds,
      line: pick.line,
      advice_given: advice,
      tier: pick.tier,
      confidence: pick.confidence,
      sport: pick.sport,
      league: pick.league,
      alert_priority: determineAlertPriority(pick),
      processing_time_ms: processingTimeMs,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('unit_talk_alerts_log')
      .insert([logEntry]);

    if (error) {
      console.error('Failed to log alert record:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error in logAlertRecord:', error);
    // Don't throw here to prevent alert failures due to logging issues
  }
}

export async function logAlertOutcome(
  supabase: SupabaseClient,
  betId: string,
  outcome: 'win' | 'loss' | 'push' | 'void',
  actualValue?: number,
  profitLoss?: number,
  closingLine?: number
): Promise<void> {
  try {
    const outcomeEntry: AlertOutcome = {
      bet_id: betId,
      outcome,
      actual_value: actualValue,
      profit_loss: profitLoss,
      closing_line: closingLine,
      closing_line_value: closingLine ? calculateClosingLineValue(closingLine, actualValue) : undefined,
      settled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('unit_talk_alert_outcomes')
      .insert([outcomeEntry]);

    if (error) {
      console.error('Failed to log alert outcome:', error);
    }

  } catch (error) {
    console.error('Error in logAlertOutcome:', error);
  }
}

export async function getAlertPerformanceMetrics(
  supabase: SupabaseClient,
  timeframe: 'day' | 'week' | 'month' = 'week'
): Promise<PerformanceMetrics> {
  try {
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays);

    const { data: alerts, error } = await supabase
      .from('unit_talk_alerts_log')
      .select(`
        *,
        unit_talk_alert_outcomes (
          outcome,
          profit_loss,
          closing_line_value
        )
      `)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Failed to fetch alert performance metrics:', error);
      return getEmptyMetrics();
    }

    return calculatePerformanceMetrics(alerts || []);

  } catch (error) {
    console.error('Error in getAlertPerformanceMetrics:', error);
    return getEmptyMetrics();
  }
}

export async function getTopPerformingAdvicePatterns(
  supabase: SupabaseClient,
  limit: number = 10
): Promise<Array<{
  advicePattern: string;
  count: number;
  winRate: number;
  avgROI: number;
  confidence: number;
}>> {
  try {
    const { data: alerts, error } = await supabase
      .from('unit_talk_alerts_log')
      .select(`
        advice_given,
        confidence,
        unit_talk_alert_outcomes (
          outcome,
          profit_loss
        )
      `)
      .not('unit_talk_alert_outcomes', 'is', null)
      .limit(1000); // Limit to recent data for performance

    if (error || !alerts) {
      return [];
    }

    const patterns = analyzeAdvicePatterns(alerts);
    return patterns
      .sort((a: any, b: any) => b.avgROI - a.avgROI)
      .slice(0, limit);

  } catch (error) {
    console.error('Error in getTopPerformingAdvicePatterns:', error);
    return [];
  }
}

function determineAlertPriority(pick: FinalPick): string {
  const confidence = pick.confidence || 50;
  const tier = pick.tier;
  
  if (tier === 'S+' && confidence >= 85) return 'URGENT';
  if (tier === 'S' || (tier === 'A+' && confidence >= 80)) return 'HIGH';
  if (['A+', 'A'].includes(tier)) return 'MEDIUM';
  return 'LOW';
}

function calculateClosingLineValue(closingLine: number, actualValue?: number): number | undefined {
  if (!actualValue) return undefined;
  return actualValue - closingLine;
}

function getEmptyMetrics(): PerformanceMetrics {
  return {
    totalAlerts: 0,
    winRate: 0,
    avgROI: 0,
    profitLoss: 0,
    byTier: {},
    byAdvice: {},
  };
}

function calculatePerformanceMetrics(alerts: any[]): PerformanceMetrics {
  const settledAlerts = alerts.filter(alert => 
    alert.unit_talk_alert_outcomes && alert.unit_talk_alert_outcomes.length > 0
  );

  if (settledAlerts.length === 0) {
    return getEmptyMetrics();
  }

  const wins = settledAlerts.filter(alert => 
    alert.unit_talk_alert_outcomes[0].outcome === 'win'
  ).length;

  const totalProfitLoss = settledAlerts.reduce((sum, alert) => 
    sum + (alert.unit_talk_alert_outcomes[0].profit_loss || 0), 0
  );

  const winRate = (wins / settledAlerts.length) * 100;
  const avgROI = (totalProfitLoss / settledAlerts.length) * 100;

  // Group by tier
  const byTier = groupAndCalculateMetrics(settledAlerts, 'tier');
  
  // Group by advice type (extract HOLD/HEDGE/FADE from advice_given)
  const byAdvice = groupAndCalculateMetrics(
    settledAlerts.map(alert => ({
      ...alert,
      advice_type: extractAdviceType(alert.advice_given)
    })),
    'advice_type'
  );

  return {
    totalAlerts: alerts.length,
    winRate,
    avgROI,
    profitLoss: totalProfitLoss,
    byTier,
    byAdvice,
  };
}

function groupAndCalculateMetrics(alerts: any[], groupBy: string): Record<string, { count: number; winRate: number; roi: number }> {
  const groups: Record<string, any[]> = alerts.reduce((acc, alert) => {
    const key = alert[groupBy];
    if (!acc[key]) acc[key] = [];
    acc[key].push(alert);
    return acc;
  }, {} as Record<string, any[]>);

  const result: Record<string, { count: number; winRate: number; roi: number }> = {};
  for (const [key, groupAlerts] of Object.entries(groups)) {
    const wins = groupAlerts.filter((alert: any) => 
      alert.unit_talk_alert_outcomes[0].outcome === 'win'
    ).length;
    
    const totalPL = groupAlerts.reduce((sum: number, alert: any) => 
      sum + (alert.unit_talk_alert_outcomes[0].profit_loss || 0), 0
    );

    result[key] = {
      count: groupAlerts.length,
      winRate: (wins / groupAlerts.length) * 100,
      roi: (totalPL / groupAlerts.length) * 100,
    };
  }

  return result;
}

function extractAdviceType(advice: string): string {
  const match = advice.match(/^(HOLD|HEDGE|FADE)/i);
  return match ? match[1].toUpperCase() : 'OTHER';
}

function analyzeAdvicePatterns(alerts: any[]) {
  const patterns: Record<string, {
    advicePattern: string;
    count: number;
    wins: number;
    totalPL: number;
    totalConfidence: number;
  }> = {};
  
  for (const alert of alerts) {
    const pattern = extractAdviceType(alert.advice_given);
    if (!patterns[pattern]) {
      patterns[pattern] = {
        advicePattern: pattern,
        count: 0,
        wins: 0,
        totalPL: 0,
        totalConfidence: 0,
      };
    }
    
    patterns[pattern].count++;
    patterns[pattern].totalConfidence += alert.confidence || 50;
    
    if (alert.unit_talk_alert_outcomes && alert.unit_talk_alert_outcomes.length > 0) {
      const outcome = alert.unit_talk_alert_outcomes[0];
      if (outcome.outcome === 'win') patterns[pattern].wins++;
      patterns[pattern].totalPL += outcome.profit_loss || 0;
    }
  }
  
  return Object.values(patterns).map((pattern) => ({
    advicePattern: pattern.advicePattern,
    count: pattern.count,
    winRate: (pattern.wins / pattern.count) * 100,
    avgROI: (pattern.totalPL / pattern.count) * 100,
    confidence: pattern.totalConfidence / pattern.count,
  }));
}