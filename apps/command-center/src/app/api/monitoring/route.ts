import { NextRequest, NextResponse } from 'next/server';
import { apiHealthMonitor } from '../../../lib/apiHealthMonitoring';
import { dataIngestionMonitor } from '../../../lib/dataIngestionMonitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    console.log(`🔍 Monitoring check requested: ${type}`);

    let result: any = {
      timestamp: new Date().toISOString(),
      monitoring_active: true,
    };

    if (type === 'apis' || type === 'all') {
      console.log('📡 Checking API health...');
      const apiStatuses = await apiHealthMonitor.checkAllAPIs();
      const apiSummary = apiHealthMonitor.getHealthSummary(apiStatuses);

      result.api_health = {
        statuses: apiStatuses,
        summary: apiSummary,
        critical_alerts: apiStatuses.filter(
          api =>
            api.status === 'down' &&
            (api.errorMessage?.includes('API KEY') || api.errorMessage?.includes('EXPIRED'))
        ),
      };

      // Log critical API issues immediately
      const criticalApis = result.api_health.critical_alerts;
      if (criticalApis.length > 0) {
        console.error('🚨 CRITICAL API ISSUES DETECTED:');
        criticalApis.forEach((api: any) => {
          console.error(`  - ${api.name}: ${api.errorMessage}`);
        });
      }
    }

    if (type === 'ingestion' || type === 'all') {
      console.log('📊 Checking data ingestion health...');
      const ingestionStatuses = await dataIngestionMonitor.checkDataIngestionHealth();
      const ingestionSummary = await dataIngestionMonitor.getIngestionSummary();

      result.data_ingestion = {
        statuses: ingestionStatuses,
        summary: ingestionSummary,
        critical_sources: ingestionStatuses.filter(
          source => source.status === 'critical' || source.status === 'no_data'
        ),
      };

      // Log critical data issues immediately
      const criticalSources = result.data_ingestion.critical_sources;
      if (criticalSources.length > 0) {
        console.error('🚨 CRITICAL DATA INGESTION ISSUES DETECTED:');
        criticalSources.forEach((source: any) => {
          console.error(
            `  - ${source.source}: Last data ${source.minutesSinceLastData} minutes ago`
          );
        });
      }
    }

    // Overall system health assessment
    if (type === 'all') {
      let overallStatus = 'healthy';
      let criticalIssues: string[] = [];

      if (result.api_health?.critical_alerts?.length > 0) {
        overallStatus = 'critical';
        criticalIssues.push(
          ...result.api_health.critical_alerts.map((api: any) => `${api.name}: ${api.errorMessage}`)
        );
      }

      if (result.data_ingestion?.critical_sources?.length > 0) {
        overallStatus = 'critical';
        criticalIssues.push(
          ...result.data_ingestion.critical_sources.map(
            (source: any) => `${source.source}: No data for ${source.minutesSinceLastData} minutes`
          )
        );
      }

      if (overallStatus === 'healthy') {
        // Check for degraded states
        if (
          result.api_health?.summary?.overallStatus === 'degraded' ||
          result.data_ingestion?.summary?.overallStatus === 'degraded'
        ) {
          overallStatus = 'degraded';
        }
      }

      result.overall_system_health = {
        status: overallStatus,
        critical_issues: criticalIssues,
        summary: {
          apis_healthy: result.api_health?.summary?.healthyAPIs || 0,
          apis_total: result.api_health?.summary?.totalAPIs || 0,
          data_sources_healthy: result.data_ingestion?.summary?.healthySources || 0,
          data_sources_total: result.data_ingestion?.summary?.totalSources || 0,
        },
      };

      console.log(`📋 Overall system health: ${overallStatus}`);
      if (criticalIssues.length > 0) {
        console.error('🚨 CRITICAL SYSTEM ISSUES:', criticalIssues);
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to perform monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform monitoring check',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, type } = await request.json();

    if (action === 'start_monitoring') {
      const interval = 60000; // 1 minute

      if (type === 'apis' || type === 'all') {
        apiHealthMonitor.startMonitoring(interval);
        console.log('✅ API health monitoring started');
      }

      if (type === 'ingestion' || type === 'all') {
        dataIngestionMonitor.startMonitoring(120000); // 2 minutes for data ingestion
        console.log('✅ Data ingestion monitoring started');
      }

      return NextResponse.json({
        success: true,
        message: `${type} monitoring started`,
        interval,
      });
    } else if (action === 'stop_monitoring') {
      if (type === 'apis' || type === 'all') {
        apiHealthMonitor.stopMonitoring();
        console.log('🛑 API health monitoring stopped');
      }

      if (type === 'ingestion' || type === 'all') {
        dataIngestionMonitor.stopMonitoring();
        console.log('🛑 Data ingestion monitoring stopped');
      }

      return NextResponse.json({
        success: true,
        message: `${type} monitoring stopped`,
      });
    } else if (action === 'trigger_test_alert') {
      // Test alert system
      const testAlert = {
        id: `test_alert_${Date.now()}`,
        type: 'TEST_ALERT',
        provider: 'Test System',
        alertType: 'CONNECTION_TEST',
        message: '🧪 Test alert triggered by user - monitoring system operational',
        details: {
          test: true,
          timestamp: new Date().toISOString(),
          user_action: true,
        },
        severity: 'medium',
        timestamp: new Date().toISOString(),
      };

      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testAlert),
      });

      return NextResponse.json({
        success: true,
        message: 'Test alert triggered successfully',
        alert: testAlert,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
          validActions: ['start_monitoring', 'stop_monitoring', 'trigger_test_alert'],
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to perform monitoring action:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform monitoring action',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for the monitoring system itself
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Monitoring-Status': 'active',
      'X-Last-Check': new Date().toISOString(),
    },
  });
}
