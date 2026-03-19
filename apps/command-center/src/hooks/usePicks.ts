import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

// Helper functions for v3.0.0 unified data transformation
function mapWorkflowStageToStatus(
  workflowStage: string | null,
  status: string | null = null
): Pick['status'] {
  // First check the status field (v3.0.0 unified structure)
  if (status) {
    switch (status) {
      case 'approved':
      case 'published':
        return 'approved';
      case 'denied':
        return 'rejected';
      case 'pending':
        return 'pending';
      default:
        break;
    }
  }

  // Then check workflow_stage for backward compatibility
  switch (workflowStage) {
    case 'approved':
    case 'published':
      return 'approved';
    case 'pending_review':
      return 'pending';
    case 'draft':
      // Check if this is a rejected pick (draft can be either new draft or rejected)
      // For now, treat all draft as pending - actual rejection logic handled in UI
      return 'pending';
    case 'rejected':
      return 'rejected';
    default:
      return 'pending';
  }
}

function calculateEvScore(confidence: number | null, odds: number | null): number {
  if (!confidence) return 0;
  // Convert confidence (0-100) to EV professional_score (0-10)
  return Math.round((confidence / 10) * 10) / 10;
}

function calculateRoi(status: string | null, odds: number | null): number | null {
  if (!status || status === 'pending') return null;
  if (!odds) return null;

  const stake = 100; // Default stake

  switch (status) {
    case 'won':
      return odds > 0 ? (stake * odds) / 100 : stake / (Math.abs(odds) / 100);
    case 'lost':
      return -stake;
    case 'push':
      return 0;
    default:
      return null;
  }
}

function extractPlayerFromSelection(selection: string): string {
  if (!selection) return '';

  // Extract player names from common selection patterns
  if (selection.includes('LeBron James')) return 'LeBron James';
  if (selection.includes('Orioles')) return 'Baltimore Orioles';

  // Try to extract first two words as player name
  const words = selection.split(' ');
  if (words.length >= 2) {
    return `${words[0]} ${words[1]}`;
  }

  return selection;
}

export interface Pick {
  id: string;
  capper_discord_id: string;
  /** null when no username is available — display as "—" not "Unknown Capper" */
  capper: string | null;
  /** null when sport column is NULL in DB */
  sport: string | null;
  selection: string;
  /** null when odds column is NULL in DB */
  odds: number | null;
  status: 'pending' | 'approved' | 'rejected';
  workflow_stage?: string;
  /** null when tier column is NULL in DB — do not default to 'C' */
  tier?: string | null;
  /** null when confidence column is NULL in DB — do not default to 50 */
  confidence?: number | null;
  /** null when confidence is unavailable — derived value is meaningless without real input */
  ev_score?: number | null;
  roi?: number | null;
  submitted_at: string;
  created_at?: string;
  player_name?: string | null;
  line?: string | null;
  /** null when stat_type column is NULL in DB — do not hardcode 'player_prop' */
  market_type?: string | null;
  /** null when bet_type column is NULL in DB */
  bet_type?: string | null;
  /** null when home_team column is NULL in DB — spread/total picks only */
  home_team?: string | null;
  /** null when away_team column is NULL in DB — spread/total picks only */
  away_team?: string | null;
  /** false when not yet posted; true when Discord post confirmed */
  posted_to_discord?: boolean;
  risk?: string;
  notes?: string;
  /** Promotion decision from GradingEngine: 'HARD' | 'SOFT' | 'NO_POST' */
  promotion_band?: string | null;
  /** Composite scoring output from computeScoreV2 */
  professional_score?: number | null;
}

export interface PickStats {
  totalPicks: number;
  pendingReview: number;
  avgEvScore: number;
  totalRoi: number;
}

export function usePicks() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [stats, setStats] = useState<PickStats>({
    totalPicks: 0,
    pendingReview: 0,
    avgEvScore: 0,
    totalRoi: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPicks = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!supabase) {
        throw new Error('Supabase client not initialized (missing environment variables)');
      }

      console.log('🔍 Fetching picks from unified_picks table...');

      // Fetch picks from unified_picks with proper relationships
      // Production schema columns: id, user_id, selection, odds, confidence, workflow_stage,
      // settlement_status, tier, sport, created_at, bet_type, home_team, away_team,
      // posted_to_discord, and users join for capper display name.
      const { data: picksData, error: picksError } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          user_id,
          player_name,
          stat_type,
          bet_type,
          line,
          side,
          selection,
          odds,
          confidence,
          workflow_stage,
          settlement_status,
          settlement_result,
          tier,
          sport,
          home_team,
          away_team,
          posted_to_discord,
          promotion_band,
          professional_score,
          source,
          created_at,
          users!unified_picks_user_id_fkey (username)
        `
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (picksError) {
        console.error('❌ Error fetching picks:', picksError);
        throw new Error(`Failed to fetch picks from unified_picks: ${picksError.message}`);
      }

      console.log(`✅ Successfully fetched ${picksData?.length || 0} picks from unified_picks`);

      // Transform unified_picks data to Pick interface
      // SPRINT-POST-REM-OPERATOR-SURFACE-TRUST: Sparse data renders as null, not fake defaults.
      // Operators must see NULL as NULL — not as 'Unknown Capper', 'C', 50, or 'player_prop'.
      const transformedPicks: Pick[] = (picksData || []).map(pick => {
        const pickId = String(pick.id || '');
        // NULL columns stay null — no synthetic fallbacks
        const confidence = pick.confidence != null ? Number(pick.confidence) : null;
        const odds = pick.odds != null ? Number(pick.odds) : null;
        const selection = String(pick.selection || pick.player_name || '');
        const workflowStage = String(pick.workflow_stage || 'draft');
        const settlementStatus = String(pick.settlement_status || 'pending');

        // Resolve capper display name from users join — null when no user record
        const usersRow = pick.users as { username: string | null } | null;
        const capperUsername = usersRow?.username ?? null;

        return {
          id: pickId,
          capper_discord_id: String(pick.user_id || ''),
          // username from users join when available — null renders as "—" in UI
          capper: capperUsername,
          // null when DB column is NULL — UI renders "—"
          sport: pick.sport != null ? String(pick.sport) : null,
          selection: selection,
          // null when DB column is NULL — UI renders "—"
          odds: odds,
          status: mapWorkflowStageToStatus(workflowStage, settlementStatus),
          workflow_stage: workflowStage,
          // null when DB column is NULL — do not assume tier C
          tier: pick.tier != null ? String(pick.tier) : null,
          // null when DB column is NULL — do not assume 50%
          confidence: confidence,
          // null when confidence unavailable — a derived score from null input is meaningless
          ev_score: confidence != null ? calculateEvScore(confidence, odds) : null,
          roi: calculateRoi(settlementStatus, odds),
          submitted_at: String(pick.created_at || new Date().toISOString()),
          created_at: String(pick.created_at || new Date().toISOString()),
          player_name: pick.player_name != null ? String(pick.player_name) : null,
          line: pick.line != null ? String(pick.line) : null,
          // null when stat_type unavailable — do not hardcode 'player_prop'
          market_type: pick.stat_type != null ? String(pick.stat_type) : null,
          // null when bet_type column is NULL in DB
          bet_type: pick.bet_type != null ? String(pick.bet_type) : null,
          // null when home_team/away_team columns are NULL — spread/total picks only
          home_team: pick.home_team != null ? String(pick.home_team) : null,
          away_team: pick.away_team != null ? String(pick.away_team) : null,
          // false when not yet confirmed on Discord
          posted_to_discord: pick.posted_to_discord === true,
          promotion_band: pick.promotion_band ?? null,
          professional_score:
            pick.professional_score != null ? Number(pick.professional_score) : null,
        };
      });

      setPicks(transformedPicks);

      // Calculate stats
      const totalPicks = transformedPicks.length;
      const pendingReview = transformedPicks.filter(p => p.status === 'pending').length;
      const avgEvScore =
        transformedPicks.reduce((sum, p) => sum + (p.ev_score || 0), 0) / Math.max(totalPicks, 1);
      const totalRoi = transformedPicks
        .filter(p => p.roi !== null)
        .reduce((sum, p) => sum + (p.roi || 0), 0);

      setStats({
        totalPicks,
        pendingReview,
        avgEvScore,
        totalRoi,
      });
    } catch (err) {
      console.error('Error fetching picks:', err);
      setError(err as Error);

      // Fallback to empty data
      setPicks([]);
      setStats({
        totalPicks: 0,
        pendingReview: 0,
        avgEvScore: 0,
        totalRoi: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const approvePick = async (pickId: string) => {
    try {
      // SPRINT-023B: Route through API endpoint instead of direct DB write
      const res = await fetch(`/api/ops/picks/${pickId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reason: 'Approved via Command Center' }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        console.error('❌ API error approving pick:', result.error);
        throw new Error(`Failed to approve pick: ${result.error || 'Unknown error'}`);
      }

      console.log('✅ Pick approved successfully via API');

      // Update local state
      setPicks(prevPicks =>
        prevPicks.map(pick =>
          pick.id === pickId ? { ...pick, status: 'approved' as const } : pick
        )
      );

      // Recalculate stats
      const updatedPicks = picks.map(pick =>
        pick.id === pickId ? { ...pick, status: 'approved' as const } : pick
      );
      const pendingReview = updatedPicks.filter(p => p.status === 'pending').length;
      setStats(prev => ({ ...prev, pendingReview }));

      return { success: true };
    } catch (err) {
      console.error('Error approving pick:', err);
      return { success: false, error: err as Error };
    }
  };

  const rejectPick = async (pickId: string) => {
    try {
      // SPRINT-023B: Route through API endpoint instead of direct DB write
      const res = await fetch(`/api/ops/picks/${pickId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: 'Rejected via Command Center' }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        console.error('❌ API error rejecting pick:', result.error);
        throw new Error(`Failed to reject pick: ${result.error || 'Unknown error'}`);
      }

      console.log('✅ Pick rejected successfully via API');

      // Update local state
      setPicks(prevPicks =>
        prevPicks.map(pick =>
          pick.id === pickId ? { ...pick, status: 'rejected' as const } : pick
        )
      );

      // Recalculate stats
      const updatedPicks = picks.map(pick =>
        pick.id === pickId ? { ...pick, status: 'rejected' as const } : pick
      );
      const pendingReview = updatedPicks.filter(p => p.status === 'pending').length;
      setStats(prev => ({ ...prev, pendingReview }));

      return { success: true };
    } catch (err) {
      console.error('Error rejecting pick:', err);
      return { success: false, error: err as Error };
    }
  };

  const refreshPicks = () => {
    fetchPicks();
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  return {
    picks,
    stats,
    loading,
    error,
    approvePick,
    rejectPick,
    refreshPicks,
  };
}
