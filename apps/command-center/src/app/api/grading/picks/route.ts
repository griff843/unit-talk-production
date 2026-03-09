'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

/**
 * Grading Picks API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock data removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

interface GradingPickData {
  id: string;
  pickId: string;
  capper: string;
  selection: string;
  sport: string;
  odds: number;
  confidence: number;
  tier: string;
  gradingScore: number;
  riskScore: number;
  expectedValue: number;
  marketMovement: number;
  status: 'pending' | 'graded' | 'published';
  gradedAt?: string;
  gradedBy: string;
  notes?: string;
  metadata: {
    modelVersion: string;
    processingTime: number;
    dataPoints: number;
    confidence: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: picksData, error: picksError } = await supabase
      .from('unified_picks')
      .select(
        `
        id,
        user_id,
        selection,
        odds,
        confidence,
        tier_when_placed,
        sport,
        workflow_stage,
        created_at,
        updated_at,
        grading_score,
        risk_assessment,
        expected_value,
        users!unified_picks_user_id_fkey (
          username,
          discord_id,
          tier,
          capper_tier
        ),
        raw_props (
          stat_type,
          player_name,
          line,
          over_odds,
          under_odds,
          sport,
          market_movement
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (picksError) {
      console.error('[CC] Grading picks query failed:', picksError.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${picksError.message}` },
        { status: 500 }
      );
    }

    // Transform picks data into grading format using real data only
    const gradingData: GradingPickData[] = (picksData || []).map(
      (pick: Record<string, unknown>) => {
        const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;
        const rawProp = Array.isArray(pick.raw_props) ? pick.raw_props[0] : pick.raw_props;
        const userObj = user as Record<string, unknown> | undefined;
        const rawPropObj = rawProp as Record<string, unknown> | undefined;

        const confidence = typeof pick.confidence === 'number' ? pick.confidence : 0;
        const gradingScore =
          typeof pick.grading_score === 'number' ? pick.grading_score : confidence / 10;
        const riskScore =
          typeof pick.risk_assessment === 'number'
            ? pick.risk_assessment
            : Math.max(0, 10 - confidence / 10);
        const expectedValue = typeof pick.expected_value === 'number' ? pick.expected_value : 0;

        return {
          id: `grading-${pick.id}`,
          pickId: String(pick.id || ''),
          capper: (userObj?.username as string) || 'Unknown',
          selection: String(pick.selection || ''),
          sport: String(pick.sport || rawPropObj?.sport || 'Unknown'),
          odds: typeof pick.odds === 'number' ? pick.odds : 0,
          confidence: confidence,
          tier: String(pick.tier_when_placed || userObj?.capper_tier || 'C'),
          gradingScore: Math.round(gradingScore * 10) / 10,
          riskScore: Math.round(riskScore * 10) / 10,
          expectedValue: Math.round(expectedValue * 100) / 100,
          marketMovement:
            typeof rawPropObj?.market_movement === 'number' ? rawPropObj.market_movement : 0,
          status:
            pick.workflow_stage === 'approved' || pick.workflow_stage === 'published'
              ? ('graded' as const)
              : pick.workflow_stage === 'pending_review'
                ? ('pending' as const)
                : ('graded' as const),
          gradedAt: pick.workflow_stage === 'approved' ? String(pick.updated_at) : undefined,
          gradedBy: 'GradingAgent',
          notes:
            pick.workflow_stage === 'rejected'
              ? 'Below confidence threshold'
              : gradingScore > 8
                ? 'High value pick'
                : gradingScore > 6
                  ? 'Acceptable risk profile'
                  : undefined,
          metadata: {
            modelVersion: 'v2.1',
            processingTime: 0,
            dataPoints: 0,
            confidence: Math.round(confidence),
          },
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: gradingData,
      count: gradingData.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] Grading picks error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pickId, action } = body;

    if (!pickId || !action) {
      return NextResponse.json(
        { success: false, error: 'pickId and action are required' },
        { status: 400 }
      );
    }

    // SPRINT-023B: Route all workflow actions through API endpoint
    const validActions = ['regrade', 'approve', 'reject', 'publish'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}. Valid: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_SERVICE_URL || 'http://localhost:3000';
    const apiRes = await fetch(`${apiUrl}/ops/picks/${pickId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason: `Workflow action via Command Center: ${action}`,
      }),
    });
    const apiResult = await apiRes.json();

    if (!apiRes.ok || !apiResult.success) {
      console.error(`[CC] ${action} failed:`, apiResult.error);
      return NextResponse.json(
        { success: false, error: apiResult.error || `Failed to ${action} pick` },
        { status: apiRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: apiResult.message || `Pick ${action} successful`,
      pickId,
    });
  } catch (error) {
    console.error('[CC] Grading action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
