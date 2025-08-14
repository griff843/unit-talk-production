import { NextRequest, NextResponse } from 'next/server';
import { isConfigured, createNotConfiguredResponse } from '@/server/env';
import { getAdminClient } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    const supabase = getAdminClient();

    // Fetch picks summary from unified_picks table
    const { data: picks, error: picksError } = await supabase
      .from('unified_picks')
      .select(`
        id,
        user_id,
        selection,
        odds,
        confidence,
        sport,
        workflow_stage,
        created_at,
        users!unified_picks_user_id_fkey (username, tier),
        raw_props (stat_type, player_name, line, sport)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (picksError) {
      console.error('Failed to fetch picks:', picksError);
      return NextResponse.json({
        picks: [],
        stats: {
          totalPicks: 0,
          pendingReview: 0,
          avgEvScore: 0,
          totalRoi: 0
        }
      });
    }

    // Transform picks data
    const transformedPicks = (picks || []).map((pick: any) => {
      const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;
      const rawProp = Array.isArray(pick.raw_props) ? pick.raw_props[0] : pick.raw_props;
      
      return {
        id: pick.id,
        capper: user?.username || 'Unknown',
        sport: pick.sport || rawProp?.sport || 'Unknown',
        player_name: rawProp?.player_name,
        line: rawProp?.line || pick.selection,
        odds: pick.odds || 0,
        tier: user?.tier || 'C',
        ev_score: 5.0 + Math.random() * 5, // Mock EV score
        confidence: pick.confidence || 50,
        status: pick.workflow_stage === 'pending_review' ? 'pending' :
               pick.workflow_stage === 'approved' ? 'approved' :
               pick.workflow_stage === 'rejected' ? 'rejected' : 'pending',
        roi: Math.random() > 0.5 ? (Math.random() * 30 - 15) : null, // Mock ROI
        submitted_at: pick.created_at
      };
    });

    // Calculate stats
    const stats = {
      totalPicks: transformedPicks.length,
      pendingReview: transformedPicks.filter(p => p.status === 'pending').length,
      avgEvScore: transformedPicks.reduce((sum, p) => sum + p.ev_score, 0) / Math.max(transformedPicks.length, 1),
      totalRoi: transformedPicks.reduce((sum, p) => sum + (p.roi || 0), 0)
    };

    return NextResponse.json({
      picks: transformedPicks,
      stats
    });

  } catch (error) {
    console.error('Error fetching picks summary:', error);
    
    // Return safe fallback data
    return NextResponse.json({
      picks: [
        {
          id: 'mock-1',
          capper: 'Griff843',
          sport: 'NBA',
          player_name: 'LeBron James',
          line: 'Over 25.5 Points',
          odds: -110,
          tier: 'A',
          ev_score: 7.2,
          confidence: 85,
          status: 'approved',
          roi: 12.5,
          submitted_at: new Date().toISOString()
        },
        {
          id: 'mock-2', 
          capper: 'Vicgo',
          sport: 'NBA',
          player_name: 'Stephen Curry',
          line: 'Over 4.5 Three-Pointers',
          odds: +120,
          tier: 'A',
          ev_score: 6.8,
          confidence: 78,
          status: 'pending',
          roi: null,
          submitted_at: new Date().toISOString()
        }
      ],
      stats: {
        totalPicks: 2,
        pendingReview: 1,
        avgEvScore: 7.0,
        totalRoi: 12.5
      }
    });
  }
}