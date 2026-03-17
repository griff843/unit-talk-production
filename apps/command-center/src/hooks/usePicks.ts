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
  capper: string;
  sport: string;
  selection: string;
  odds: number;
  status: 'pending' | 'approved' | 'rejected';
  workflow_stage?: string;
  tier?: string;
  confidence?: number;
  ev_score?: number;
  roi?: number;
  submitted_at: string;
  created_at?: string;
  player_name?: string;
  line?: string;
  market_type?: string;
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
      // settlement_status, tier, sport, created_at, etc.
      // Note: status, tier_when_placed, placed_at don't exist in production
      const { data: picksData, error: picksError } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          user_id,
          selection,
          odds,
          confidence,
          workflow_stage,
          settlement_status,
          tier,
          sport,
          promotion_band,
          professional_score,
          created_at,
          users!unified_picks_user_id_fkey (
            username,
            discord_id,
            tier,
            capper_tier
          )
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
      // Using production schema columns only
      const transformedPicks: Pick[] = (picksData || []).map(pick => {
        const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;

        // Type-safe conversions
        const pickId = String(pick.id || '');
        const confidence = Number(pick.confidence || 50);
        const odds = Number(pick.odds || 0);
        const selection = String(pick.selection || '');
        const workflowStage = String(pick.workflow_stage || 'draft');
        const settlementStatus = String(pick.settlement_status || 'pending');

        return {
          id: pickId,
          capper_discord_id: user?.discord_id || pick.user_id,
          capper: user?.username || 'Unknown Capper',
          sport: String(pick.sport || 'Unknown'),
          selection: selection,
          odds: odds,
          status: mapWorkflowStageToStatus(workflowStage, settlementStatus),
          workflow_stage: workflowStage,
          tier: pick.tier || user?.capper_tier || user?.tier || 'C',
          confidence: confidence,
          ev_score: calculateEvScore(confidence, odds),
          roi: calculateRoi(settlementStatus, odds),
          submitted_at: String(pick.created_at || new Date().toISOString()),
          created_at: String(pick.created_at || new Date().toISOString()),
          player_name: extractPlayerFromSelection(selection),
          line: selection,
          market_type: 'player_prop',
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
