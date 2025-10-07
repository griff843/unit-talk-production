import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

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
  professional_score?: number;
  kelly_fraction?: number;
  devigged_edge?: number;
  feature_contributions?: any;
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

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized (missing environment variables)');
      }

      console.log('🔍 Fetching picks from unified_picks table...');

      // Fetch picks from unified_picks that have been scored by Enhanced45Factor system
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
          professional_score,
          kelly_fraction,
          devigged_edge,
          feature_contributions,
          approved_at,
          approved_by,
          users!unified_picks_user_id_fkey (
            username,
            discord_id,
            tier,
            capper_tier
          )
        `
        )
        .not('professional_score', 'is', null)
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
          tier: pick.tier || pick.tier_when_placed || user?.capper_tier || user?.tier || 'C',
          confidence: confidence,
          ev_score: calculateEvScore(confidence, odds),
          professional_score: Number(pick.professional_score || 0),
          kelly_fraction: Number(pick.kelly_fraction || 0),
          devigged_edge: Number(pick.devigged_edge || 0),
          feature_contributions: pick.feature_contributions,
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
      console.log(`🔄 Approving pick ${pickId}...`);

      const response = await fetch('/api/approval?action=approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickId: pickId,
          actorId: 'command-center-operator',
          reason: 'Manual approval via Command Center'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Pick approved successfully:', result);

      // Update local state
      setPicks(prevPicks =>
        prevPicks.map(pick =>
          pick.id === pickId ? { ...pick, status: 'approved' as const, workflow_stage: 'approved' } : pick
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
      console.log(`🔄 Rejecting pick ${pickId}...`);

      const response = await fetch('/api/approval?action=reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickId: pickId,
          actorId: 'command-center-operator',
          reason: 'Manual rejection via Command Center'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Pick rejected successfully:', result);

      // Update local state
      setPicks(prevPicks =>
        prevPicks.map(pick =>
          pick.id === pickId ? { ...pick, status: 'rejected' as const, workflow_stage: 'rejected' } : pick
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

    // Set up real-time subscription for newly scored props
    const supabase = getSupabaseClient();
    if (supabase) {
      console.log('🔔 Setting up real-time subscription for scored props...');

      const subscription = supabase
        .channel('scored-props-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'unified_picks',
            filter: 'professional_score=not.null'
          },
          (payload) => {
            console.log('🔥 Real-time update received:', payload);

            if (payload.eventType === 'UPDATE' && payload.new.professional_score) {
              // A prop was just scored by the ScoringAgent
              const updatedPick = payload.new;
              const user = Array.isArray(updatedPick.users) ? updatedPick.users[0] : updatedPick.users;

              const transformedPick: Pick = {
                id: String(updatedPick.id),
                capper_discord_id: user?.discord_id || updatedPick.user_id,
                capper: user?.username || 'Unknown Capper',
                sport: updatedPick.sport || 'Unknown',
                selection: String(updatedPick.selection || ''),
                odds: Number(updatedPick.odds || 0),
                status: mapWorkflowStageToStatus(updatedPick.workflow_stage, updatedPick.status),
                workflow_stage: updatedPick.workflow_stage,
                tier: updatedPick.tier || user?.capper_tier || 'C',
                confidence: Number(updatedPick.confidence || 50),
                ev_score: calculateEvScore(updatedPick.confidence, updatedPick.odds),
                professional_score: Number(updatedPick.professional_score),
                kelly_fraction: Number(updatedPick.kelly_fraction || 0),
                devigged_edge: Number(updatedPick.devigged_edge || 0),
                feature_contributions: updatedPick.feature_contributions,
                roi: calculateRoi(updatedPick.status, updatedPick.odds),
                submitted_at: String(updatedPick.placed_at || updatedPick.created_at),
                created_at: String(updatedPick.created_at),
                player_name: extractPlayerFromSelection(updatedPick.selection),
                line: String(updatedPick.selection),
                market_type: 'player_prop',
              };

              // Update picks in real-time
              setPicks(prevPicks => {
                const existingIndex = prevPicks.findIndex(p => p.id === transformedPick.id);
                if (existingIndex >= 0) {
                  // Update existing pick
                  const newPicks = [...prevPicks];
                  newPicks[existingIndex] = transformedPick;
                  return newPicks;
                } else {
                  // Add new pick to the beginning
                  return [transformedPick, ...prevPicks];
                }
              });

              // Show notification for newly scored props
              if (updatedPick.workflow_stage === 'pending_review') {
                console.log(`🎯 New scored prop available for review: ${updatedPick.selection} (Score: ${updatedPick.professional_score})`);
              }
            }
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        console.log('🔕 Cleaning up real-time subscription...');
        subscription.unsubscribe();
      };
    }
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
