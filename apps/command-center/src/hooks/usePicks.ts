import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Helper functions for v3.0.0 unified data transformation
function mapWorkflowStageToStatus(workflowStage: string | null, status: string | null = null): Pick['status'] {
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

      // Fetch picks from unified_picks with proper v3.0.0 relationships
      const { data: picksData, error: picksError } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          user_id,
          selection,
          odds,
          confidence,
          status,
          workflow_stage,
          tier_when_placed,
          sport,
          created_at,
          placed_at,
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
      const transformedPicks: Pick[] = (picksData || []).map(pick => {
        const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;

        // Type-safe conversions
        const pickId = String(pick.id || '');
        const confidence = Number(pick.confidence || 50);
        const odds = Number(pick.odds || 0);
        const selection = String(pick.selection || '');
        const workflowStage = String(pick.workflow_stage || 'draft');

        return {
          id: pickId,
          capper_discord_id: user?.discord_id || pick.user_id,
          capper: user?.username || 'Unknown Capper',
          sport: pick.sport || 'Unknown',
          selection: selection,
          odds: odds,
          status: mapWorkflowStageToStatus(workflowStage, String(pick.status || '')),
          workflow_stage: workflowStage,
          tier: pick.tier_when_placed || user?.capper_tier || user?.tier || 'C',
          confidence: confidence,
          ev_score: calculateEvScore(confidence, odds),
          roi: calculateRoi(String(pick.status || 'pending'), odds),
          submitted_at: String(pick.placed_at || pick.created_at || new Date().toISOString()),
          created_at: String(pick.created_at || new Date().toISOString()),
          player_name: extractPlayerFromSelection(selection),
          line: selection,
          market_type: 'player_prop',
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
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // For approved picks, update both status and workflow_stage to maintain consistency
      const { error } = await supabase
        .from('unified_picks')
        .update({
          status: 'pending', // status for betting outcome (pending until game settles)
          workflow_stage: 'approved', // workflow progression for approval process
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId);

      if (error) {
        console.error('❌ Database error approving pick:', error);
        throw new Error(`Failed to approve pick: ${error.message}`);
      }

      console.log('✅ Pick approved successfully in database');

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
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // For rejected picks, update status to cancelled but keep workflow_stage as draft
      // since rejected picks shouldn't progress through the workflow
      const { error } = await supabase
        .from('unified_picks')
        .update({
          status: 'cancelled', // matches schema constraint for rejected picks
          workflow_stage: 'draft', // rejected picks revert to draft status
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId);

      if (error) {
        console.error('❌ Database error rejecting pick:', error);
        throw new Error(`Failed to reject pick: ${error.message}`);
      }

      console.log('✅ Pick rejected successfully in database');

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
