import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../services/logging';

// --- Types ---
type PickRecord = {
  id: string;
  direction?: string;
  line?: number | string;
  actual_stat?: number | string;
  unit_size?: number;
  bet_type?: string;
  graded?: boolean;
  legs?: any[] | null;
  [key: string]: any;
};
type LegResult = { outcome: string; units_result: number };

// --- Single Grading (OVER/UNDER, ML, Spread, Total, etc.) ---
function gradeSingle(pick: PickRecord): LegResult {
  const stat = Number(pick.actual_stat);
  const line = Number(pick.line);
  const unit = Number(pick.unit_size ?? 1);

  if (pick.direction && ['over', 'under'].includes(pick.direction)) {
    if (pick.direction === 'over') {
      if (stat > line) return { outcome: 'win', units_result: unit };
      if (stat < line) return { outcome: 'loss', units_result: -unit };
      return { outcome: 'push', units_result: 0 };
    }
    if (pick.direction === 'under') {
      if (stat < line) return { outcome: 'win', units_result: unit };
      if (stat > line) return { outcome: 'loss', units_result: -unit };
      return { outcome: 'push', units_result: 0 };
    }
  }
  if (pick.bet_type === 'moneyline') {
    // You may want to customize how actual_stat is set (1=win, 0=loss, 2=push)
    if (stat === 1) return { outcome: 'win', units_result: unit };
    if (stat === 0) return { outcome: 'loss', units_result: -unit };
    if (stat === 2) return { outcome: 'push', units_result: 0 };
    return { outcome: 'void', units_result: 0 };
  }
  // Future: Add spread, total, etc.
  return { outcome: 'void', units_result: 0 };
}

// --- Multi-Leg Grading (Parlay, Teaser, RR, SGP) ---
function gradeMultiLegTicket(ticket: PickRecord): { outcome: string; units_result: number; legResults: LegResult[] } {
  const legResults = (ticket.legs || []).map((leg: any) => gradeSingle(leg));
  const allWin = legResults.every((lr) => lr.outcome === 'win');
  const anyLoss = legResults.some((lr) => lr.outcome === 'loss');
  const anyPushOrVoid = legResults.some((lr) => ['push', 'void'].includes(lr.outcome));

  let outcome = '';
  if (allWin) outcome = 'win';
  else if (anyLoss) outcome = 'loss';
  else if (anyPushOrVoid) outcome = 'push';
  else outcome = 'void';

  const unit = Number(ticket.unit_size ?? 1);
  let units_result = 0;
  if (outcome === 'win') units_result = unit;
  else if (outcome === 'loss') units_result = -unit;
  else units_result = 0;
  return { outcome, units_result, legResults };
}

// --- Finalizer Agent Main ---
export async function finalizePicks() {
  const { data: picks, error } = await supabase
    .from('final_picks')
    .select('*')
    .is('graded', false)
    .not('actual_stat', 'is', null);

  if (error) {
    logger.error(error, 'Error fetching final_picks for finalization');
    throw error;
  }
  if (!picks || picks.length === 0) {
    logger.info('No eligible final_picks found for grading.');
    return;
  }

  let gradedCount = 0;
  for (const pick of picks as PickRecord[]) {
    try {
      let outcomeInfo:
        | { outcome: string; units_result: number; legResults?: LegResult[] }
        | LegResult;
      if (Array.isArray(pick.legs) && pick.legs.length > 1) {
        outcomeInfo = gradeMultiLegTicket(pick);
      } else {
        outcomeInfo = gradeSingle(pick);
      }
      await supabase
        .from('final_picks')
        .update({
          outcome: outcomeInfo.outcome,
          units_result: outcomeInfo.units_result,
          legResults: 'legResults' in outcomeInfo ? outcomeInfo.legResults : null,
          graded: true,
          graded_at: new Date().toISOString(),
        })
        .eq('id', pick.id);

      gradedCount++;
      logger.info({ id: pick.id, outcome: outcomeInfo.outcome }, 'Finalized pick result');
    } catch (err) {
      logger.error({ id: pick.id }, 'Finalization error: ', err);
    }
  }
  logger.info(`Finalization complete: ${gradedCount} picks graded.`);
}

finalizePicks().then(() => {
  console.log('FinalizerAgent complete');
});
