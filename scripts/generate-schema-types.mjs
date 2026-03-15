#!/usr/bin/env node
/**
 * Schema Types Generator
 *
 * SPRINT-045-SCHEMA-TYPE-SYNC: Updated to include all canonical V3 tables
 * and lifecycle columns.
 *
 * Generates baseline Supabase types for schema drift detection.
 * In production, this should be replaced with actual Supabase type generation:
 *   npx supabase gen types typescript --project-id <id> > packages/shared-types/src/supabase.ts
 *
 * Usage: node scripts/generate-schema-types.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Table definitions with their key columns.
 * Source: supabase/migrations/ (canonical V3 schema as of 2026-03-14)
 *
 * Column types: s=string, sn=string|null, n=number, nn=number|null,
 *               b=boolean, bn=boolean|null, j=json|null, d=string(date)
 */
const TABLE_DEFS = {
  // ─── Canonical Core ───
  unified_picks: {
    id: 's', created_at: 's', updated_at: 's',
    // Core pick fields
    player_name: 'sn', sport: 'sn', league: 'sn', stat_type: 'sn',
    line: 'nn', odds: 'nn', stake: 'nn', payout: 'nn', direction: 'sn',
    capper: 'sn', capper_id: 'sn', player_id: 'sn', game_id: 'sn',
    tier: 'sn', confidence: 'nn', professional_score: 'nn',
    result: 'sn', actual_value: 'nn', source: 'sn',
    // Lifecycle columns (SPRINT-219/lifecycle_columns_gauntlet_047)
    promotion_status: 'sn', promotion_band: 'sn',
    promotion_queued_at: 'sn', promotion_posted_at: 'sn',
    posted_to_discord: 'b', discord_message_id: 'sn', discord_thread_id: 'sn',
    discord_post_id: 'sn',
    // Settlement
    status: 'sn', settlement_status: 'sn', settlement_result: 'sn',
    settlement_source: 'sn', settled_at: 'sn',
    // Metadata
    lifecycle_stage: 'sn', bet_slip_id: 'sn',
    ticket_type: 'sn', parlay_id: 'sn',
    blocked_reason: 'sn', failed_reason: 'sn',
    blocked_at: 'sn', failed_at: 'sn', placed_at: 'sn',
    meta: 'j',
  },
  participants: {
    id: 's', created_at: 's', updated_at: 's',
    name: 's', type: 's', sport: 'sn', league: 'sn',
    external_id: 'sn', provider: 'sn', meta: 'j', active: 'b',
  },
  participant_memberships: {
    id: 's', created_at: 's',
    player_id: 's', team_id: 's',
    start_date: 'sn', end_date: 'sn', role: 'sn', meta: 'j',
  },
  events: {
    id: 's', created_at: 's', updated_at: 's',
    sport: 'sn', league: 'sn', scheduled_at: 'sn',
    home_participant_id: 'sn', away_participant_id: 'sn',
    status: 'sn', external_id: 'sn', provider: 'sn',
    event_data: 'j', meta: 'j',
  },
  markets: {
    id: 's', created_at: 's',
    stat_type: 's', canonical_key: 's', sport: 'sn',
    display_name: 'sn', category: 'sn', meta: 'j',
  },
  provider_offers: {
    id: 's', created_at: 's', snapshot_at: 's',
    event_id: 'sn', market_id: 'sn', participant_id: 'sn',
    provider: 'sn', provider_market_key: 'sn',
    line: 'nn', over_odds: 'nn', under_odds: 'nn',
    is_closing: 'b', graded_at: 'sn', meta: 'j',
  },
  // ─── Ticket System ───
  tickets: {
    id: 's', created_at: 's', updated_at: 's',
    user_id: 'sn', ticket_type: 'sn', status: 'sn',
    source: 'sn', meta: 'j',
  },
  ticket_legs: {
    id: 's', created_at: 's',
    ticket_id: 's', event_id: 'sn', market_id: 'sn',
    participant_id: 'sn', line: 'nn', odds: 'nn', direction: 'sn',
    stat_type: 'sn', player_name: 'sn', meta: 'j',
  },
  feature_snapshots: {
    id: 's', created_at: 's',
    leg_id: 's', features: 'j', model_version: 'sn',
  },
  scored_legs: {
    id: 's', created_at: 's',
    leg_id: 's', feature_snapshot_id: 'sn',
    score: 'nn', tier: 'sn', promotion_band: 'sn',
    model_version: 'sn', meta: 'j',
  },
  // ─── Settlement & CLV ───
  prop_settlements: {
    id: 's', created_at: 's',
    final_pick_id: 'sn', settlement_status: 'sn',
    settlement_result: 'sn', actual_outcome: 'nn',
    settlement_source: 'sn', meta: 'j',
  },
  closing_snapshots: {
    id: 's', created_at: 's',
    event_id: 'sn', market_type_id: 'nn', market_key: 'sn',
    consensus_line: 'nn', devigged_over: 'nn', devigged_under: 'nn',
    snapshot_count: 'nn', meta: 'j',
  },
  clv_results: {
    id: 's', created_at: 's',
    pick_id: 's', model_version: 'sn', close_kind: 'sn',
    clv_edge: 'nn', entry_ev: 'nn', close_ev: 'nn', meta: 'j',
  },
  // ─── Operations & Infrastructure ───
  bridge_outbox: {
    id: 's', created_at: 's',
    event_type: 's', payload: 'j', status: 's', processed_at: 'sn',
  },
  agent_health: {
    id: 's', created_at: 's',
    agent_name: 's', status: 's', last_heartbeat: 's', metadata: 'j',
  },
  users: {
    id: 's', created_at: 's', updated_at: 's',
    email: 'sn', role: 'sn', display_name: 'sn',
    status: 'sn', active: 'bn',
  },
  cappers: {
    id: 's', created_at: 's',
    user_id: 'sn', name: 'sn', display_name: 'sn', meta: 'j',
  },
  audit_log: {
    id: 's', created_at: 's',
    action: 'sn', entity_type: 'sn', entity_id: 'sn',
    actor_id: 'sn', details: 'j',
  },
  smart_tickets: {
    id: 's', created_at: 's', updated_at: 's',
    user_id: 'sn', sport: 'sn', status: 'sn', payload: 'j',
  },
  user_profiles: {
    id: 's', created_at: 's', updated_at: 's',
    user_id: 'sn', preferences: 'j',
  },
  ticket_discord_outbox: {
    id: 's', created_at: 's',
    ticket_id: 'sn', status: 'sn', channel_id: 'sn',
    claimed_by: 'sn', claimed_at: 'sn', posted_at: 'sn', meta: 'j',
  },
  player_projections: {
    id: 's', created_at: 's',
    player_id: 'sn', stat_type: 'sn', projected_value: 'nn',
    source: 'sn', meta: 'j',
  },
  ops_worker_heartbeats: {
    id: 's', created_at: 's',
    worker_name: 's', last_heartbeat_at: 's', status: 'sn', metadata: 'j',
  },
  autopilot_decisions: {
    id: 's', created_at: 's',
    action: 'sn', mode: 'sn', decision: 'sn', reason: 'sn',
    evidence_id: 'sn', meta: 'j',
  },
  autopilot_policy_config: {
    id: 's', created_at: 's', updated_at: 's',
    policy_key: 'sn', policy_value: 'sn', description: 'sn',
  },
  autopilot_cooldowns: {
    id: 's', created_at: 's',
    action: 'sn', cooldown_until: 'sn', meta: 'j',
  },
  // ─── Risk Engine ───
  risk_engine_config: {
    id: 's', created_at: 's', updated_at: 's',
    config_key: 'sn', config_value: 'nn', description: 'sn',
    updated_by: 'sn',
  },
  risk_events: {
    id: 's', created_at: 's',
    event_type: 'sn', severity: 'sn', pick_id: 'sn',
    exposure_snapshot: 'j', drift_snapshot: 'j', config_snapshot: 'j',
    meta: 'j',
  },
  // ─── Analytics & Observability ───
  api_credit_log: {
    id: 's', created_at: 's',
    provider: 'sn', sport: 'sn', credits_used: 'nn', meta: 'j',
  },
  execution_events: {
    id: 's', created_at: 's',
    event_type: 'sn', agent_name: 'sn', correlation_id: 'sn',
    payload: 'j', duration_ms: 'nn',
  },
  shadow_scores: {
    id: 's', created_at: 's',
    pick_id: 'sn', model_version: 'sn',
    v1_score: 'nn', v2_score: 'nn', divergence: 'nn', meta: 'j',
  },
  outcome_records: {
    id: 's', created_at: 's',
    pick_id: 'sn', event_id: 'sn', actual_value: 'nn',
    source: 'sn', meta: 'j',
  },
  market_policy: {
    id: 's', created_at: 's',
    sport: 'sn', stat_type: 'sn', enabled: 'b', meta: 'j',
  },
  publish_outbox: {
    id: 's', created_at: 's',
    pick_id: 'sn', status: 'sn', channel: 'sn',
    claimed_by: 'sn', claimed_at: 'sn', published_at: 'sn', meta: 'j',
  },
  // ─── Audit (SPRINT-046) ───
  operator_audit_log: {
    id: 's', created_at: 's',
    operator_id: 's', operator_email: 'sn',
    action: 's', endpoint: 's', method: 's',
    request_body: 'j', response_status: 'nn',
    ip_address: 'sn', user_agent: 'sn', duration_ms: 'nn', meta: 'j',
  },
};

const OUTPUT_PATH = 'packages/shared-types/src/supabase.ts';

const TYPE_MAP = {
  s: 'string',
  sn: 'string | null',
  n: 'number',
  nn: 'number | null',
  b: 'boolean',
  bn: 'boolean | null',
  j: 'Record<string, unknown> | null',
  d: 'string',
};

function toPascalCase(name) {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function generateRowInterface(tableName) {
  const pc = toPascalCase(tableName);
  const cols = TABLE_DEFS[tableName];
  const fields = Object.entries(cols)
    .map(([col, type]) => `  ${col}: ${TYPE_MAP[type]};`)
    .join('\n');
  return `interface ${pc}Row {\n${fields}\n}`;
}

function generateTableType(tableName) {
  const pc = toPascalCase(tableName);
  return `    ${tableName}: {
      Row: ${pc}Row;
      Insert: Partial<${pc}Row>;
      Update: Partial<${pc}Row>;
      Relationships: [];
    };`;
}

function generateTypes() {
  const timestamp = new Date().toISOString();
  const tables = Object.keys(TABLE_DEFS);

  return `/**
 * Supabase Database Types
 *
 * AUTO-GENERATED by scripts/generate-schema-types.mjs
 * Generated at: ${timestamp}
 *
 * SPRINT-045-SCHEMA-TYPE-SYNC: Updated with all canonical V3 tables and lifecycle columns.
 *
 * NOTE: In production with Supabase CLI access, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > packages/shared-types/src/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Row interfaces for each table
${tables.map(generateRowInterface).join('\n\n')}

export interface Database {
  public: {
    Tables: {
${tables.map(generateTableType).join('\n')}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Re-export for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
`;
}

function main() {
  const rootDir = process.cwd();
  const outputPath = join(rootDir, OUTPUT_PATH);
  const tables = Object.keys(TABLE_DEFS);

  console.log('SCHEMA TYPES GENERATOR');
  console.log(`   Output: ${OUTPUT_PATH}`);
  console.log(`   Tables: ${tables.length}`);
  console.log('');

  mkdirSync(dirname(outputPath), { recursive: true });

  const content = generateTypes();
  writeFileSync(outputPath, content, 'utf-8');

  console.log('Generated types for tables:');
  tables.forEach(t => console.log(`   - ${t}`));
  console.log('');
  console.log('SUCCESS: Schema types generated');
  console.log(`   File: ${OUTPUT_PATH}`);
}

main();
