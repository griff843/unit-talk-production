// /src/agents/AlertsAgent/log.ts

import { SupabaseClient } from '@supabase/supabase-js'
import { AlertPayload } from '../../types/alert'

export async function logUnitTalkAdvice(
  supabase: SupabaseClient,
  alert: AlertPayload,
  advice: string,
  betId: string,
  userId?: string,
  response?: string,
  outcome?: string,
  evChange?: number,
  wasPosEvAdvice?: boolean,
  notes?: string,
  feedback?: string
) {
  await supabase.from('unit_talk_alerts_log').insert([{
    alert_type: alert.type,
    bet_id: betId,
    user_id: userId,
    advice_given: advice,
    response,
    outcome,
    ev_change: evChange,
    was_pos_ev_advice: wasPosEvAdvice,
    notes,
    feedback,
    timestamp: new Date().toISOString()
  }])
}
