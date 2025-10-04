import { supabaseClient as supabase } from '../utils/supabaseUtils';
import { toCamelKeys, toSnakeKeys } from '@unit-talk/shared-utils';
import { requireSupabase, supabaseClient } from '../utils/supabaseUtils';

export type UnifiedPick = {
  id?: string;
  userId: string;
  propId?: string | null;
  gameId?: string | null;
  pickSource?: 'manual'|'promoted'|'events'|'bridge_outbox';
  pickType: 'single'|'parlay'|'system'|'teaser';
  outcome: string;
  line?: number | null;
  odds?: number | null;
  stake?: number | null;
  confidence?: number | null;
  workflowStage?: 'ingested'|'validated'|'graded'|'pending_review'|'promoted'|'settled';
  status?: 'pending'|'won'|'lost'|'push'|'void'|'cancelled';
  published?: boolean;
  tierWhenPlaced?: 'S'|'A'|'B'|'C'|'D' | null;
  analysis?: string | null;
  groupKey?: string | null;
  clvTrackingId?: string | null;
  isInstant?: boolean;
  placedAt?: string;
  updatedAt?: string;
  // 195-Factor Scoring System fields
  professionalScore?: number | null;
  impliedProb?: number | null;
  scoredAt?: string | null;
  kellyFraction?: number | null;
  featureContributions?: Record<string, any> | null;
  playerName?: string | null;
  statType?: string | null;
  sport?: string | null;
  gameDate?: string | null;
};

export async function createUnifiedPick(pick: UnifiedPick) {

  const snake = toSnakeKeys(pick);
  const supabaseClient = requireSupabase();
      const { data, error} = await supabaseClient.from('unified_picks').insert(snake).select().single();
  if (error) throw error;
  return toCamelKeys<UnifiedPick>(data);
}

export async function patchUnifiedPick(id: string, patch: Partial<UnifiedPick>) {

  const snake = toSnakeKeys(patch);
  const supabaseClient = requireSupabase();
      const { data, error } = await supabaseClient.from('unified_picks').update(snake).eq('id', id).select().single();
  if (error) throw error;
  return toCamelKeys<UnifiedPick>(data);
}

export async function findUnifiedPick(id: string) {

  const supabaseClient = requireSupabase();
      const { data, error } = await supabaseClient.from('unified_picks').select('*').eq('id', id).single();
  if (error) throw error;
  return toCamelKeys<UnifiedPick>(data);
}

export async function listUnifiedPicks(params: { status?: string; published?: boolean; limit?: number } = {}) {

  const { status, published, limit = 100 } = params;
  let q = supabase.from('unified_picks').select('*');
  if (status) q = q.eq('status', status);
  if (typeof published === 'boolean') q = q.eq('published', published);
  const { data, error } = await q.order('placed_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return toCamelKeys<UnifiedPick[]>(data);
}

