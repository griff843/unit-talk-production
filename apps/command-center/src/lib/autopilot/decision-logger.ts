/**
 * Phase 4: Autopilot Decision Logger
 * Logs all autopilot decisions to Supabase for reporting and analysis
 */

import { createClient } from '@supabase/supabase-js';
import type { AutopilotDecision } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class DecisionLogger {
  /**
   * Log an autopilot decision to database
   * In log_only mode, this is the ONLY database write that happens
   */
  async logDecision(decision: AutopilotDecision): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const startTime = Date.now();

      // Ensure required fields are present
      if (!decision.mode || !decision.evaluation_run_id || !decision.decision) {
        throw new Error('Missing required decision fields: mode, evaluation_run_id, decision');
      }

      // Insert decision record
      const { data, error } = await supabase
        .from('autopilot_decisions')
        .insert({
          mode: decision.mode,
          evaluation_run_id: decision.evaluation_run_id,
          evaluated_at: decision.evaluated_at || new Date().toISOString(),
          pick_id: decision.pick_id || null,
          pick_data: decision.pick_data,
          decision: decision.decision,
          decision_reason: decision.decision_reason,
          risk_score: decision.risk_score || null,
          risk_factors: decision.risk_factors || [],
          data_age_minutes: decision.data_age_minutes || null,
          odds_staleness_minutes: decision.odds_staleness_minutes || null,
          is_stale: decision.is_stale || false,
          would_publish: decision.would_publish,
          publish_channel: decision.publish_channel || null,
          publish_blocked_reason: decision.publish_blocked_reason || null,
          slo_snapshot: decision.slo_snapshot || null,
          execution_time_ms: decision.execution_time_ms || (Date.now() - startTime),
          metadata: decision.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        console.error('[DecisionLogger] Failed to log decision:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } catch (error: any) {
      console.error('[DecisionLogger] Exception logging decision:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch log multiple decisions (for performance)
   */
  async logDecisions(decisions: AutopilotDecision[]): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      if (decisions.length === 0) {
        return { success: true, count: 0 };
      }

      const records = decisions.map((decision) => ({
        mode: decision.mode,
        evaluation_run_id: decision.evaluation_run_id,
        evaluated_at: decision.evaluated_at || new Date().toISOString(),
        pick_id: decision.pick_id || null,
        pick_data: decision.pick_data,
        decision: decision.decision,
        decision_reason: decision.decision_reason,
        risk_score: decision.risk_score || null,
        risk_factors: decision.risk_factors || [],
        data_age_minutes: decision.data_age_minutes || null,
        odds_staleness_minutes: decision.odds_staleness_minutes || null,
        is_stale: decision.is_stale || false,
        would_publish: decision.would_publish,
        publish_channel: decision.publish_channel || null,
        publish_blocked_reason: decision.publish_blocked_reason || null,
        slo_snapshot: decision.slo_snapshot || null,
        execution_time_ms: decision.execution_time_ms || null,
        metadata: decision.metadata || {},
      }));

      const { data, error } = await supabase.from('autopilot_decisions').insert(records).select('id');

      if (error) {
        console.error('[DecisionLogger] Failed to batch log decisions:', error);
        return { success: false, count: 0, error: error.message };
      }

      return { success: true, count: data?.length || 0 };
    } catch (error: any) {
      console.error('[DecisionLogger] Exception batch logging decisions:', error);
      return { success: false, count: 0, error: error.message };
    }
  }

  /**
   * Get daily autopilot report
   */
  async getDailyReport(reportDate?: Date): Promise<any> {
    try {
      const dateStr = reportDate ? reportDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_daily_autopilot_report', {
        report_date: dateStr,
      });

      if (error) {
        console.error('[DecisionLogger] Failed to get daily report:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error: any) {
      console.error('[DecisionLogger] Exception getting daily report:', error);
      return null;
    }
  }

  /**
   * Get autopilot timeline (hourly metrics)
   */
  async getTimeline(hoursBack: number = 24): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_autopilot_timeline', {
        hours_back: hoursBack,
      });

      if (error) {
        console.error('[DecisionLogger] Failed to get timeline:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('[DecisionLogger] Exception getting timeline:', error);
      return [];
    }
  }
}

export const decisionLogger = new DecisionLogger();
