/**
 * Phase 4: Autopilot Report API
 * GET /api/autopilot/report - Get daily autopilot report
 */

import { NextRequest, NextResponse } from 'next/server';
import { decisionLogger } from '@/lib/autopilot/decision-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const hoursBack = parseInt(searchParams.get('hours_back') || '24', 10);

    // Get report date (default to today)
    const reportDate = dateParam ? new Date(dateParam) : new Date();

    // Get daily report
    const dailyReport = await decisionLogger.getDailyReport(reportDate);

    // Get timeline data
    const timeline = await decisionLogger.getTimeline(hoursBack);

    if (!dailyReport) {
      return NextResponse.json(
        {
          error: 'No autopilot data available for specified date',
          date: reportDate.toISOString().split('T')[0],
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        report_date: reportDate.toISOString().split('T')[0],
        daily_summary: {
          total_evaluated: parseInt(dailyReport.total_evaluated || '0', 10),
          approved_count: parseInt(dailyReport.approved_count || '0', 10),
          rejected_count: parseInt(dailyReport.rejected_count || '0', 10),
          unknown_count: parseInt(dailyReport.unknown_count || '0', 10),
          would_publish_count: parseInt(dailyReport.would_publish_count || '0', 10),
          avg_risk_score: dailyReport.avg_risk_score ? parseFloat(dailyReport.avg_risk_score) : null,
          stale_count: parseInt(dailyReport.stale_count || '0', 10),
          avg_execution_time_ms: dailyReport.avg_execution_time_ms ? parseFloat(dailyReport.avg_execution_time_ms) : null,
        },
        rejection_reasons: dailyReport.rejection_reasons || [],
        timeline: timeline.map((bucket) => ({
          hour_bucket: bucket.hour_bucket,
          evaluated_count: parseInt(bucket.evaluated_count || '0', 10),
          approved_count: parseInt(bucket.approved_count || '0', 10),
          rejected_count: parseInt(bucket.rejected_count || '0', 10),
          would_publish_count: parseInt(bucket.would_publish_count || '0', 10),
          avg_risk_score: bucket.avg_risk_score ? parseFloat(bucket.avg_risk_score) : null,
        })),
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API /autopilot/report] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
