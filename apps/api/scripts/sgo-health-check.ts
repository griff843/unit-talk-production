#!/usr/bin/env node

/**
 * SGO Health Check Script
 * 
 * Monitors SGO backfill system health and provides status reports
 */

import { createLogger } from '../src/utils/logger';
import { supabaseClient } from '../src/services/supabaseClient';

const logger = createLogger('SGOHealthCheck');

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  details: string;
  metrics?: Record<string, any>;
}

async function checkSGOApiConnection(): Promise<HealthCheckResult> {
  try {
    const apiKey = process.env.SPORTSGAMEODDS_KEY;
    
    if (!apiKey) {
      return {
        component: 'SGO API Connection',
        status: 'error',
        details: 'SPORTSGAMEODDS_KEY environment variable not set'
      };
    }

    // Try a simple API call to verify connectivity
    const axios = require('axios');
    const response = await axios.get('https://api.sportsgameodds.com/v2/sports', {
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'UnitTalk/1.0 Health Check'
      },
      timeout: 10000
    });

    if (response.status === 200) {
      return {
        component: 'SGO API Connection',
        status: 'healthy',
        details: 'API connection successful',
        metrics: {
          responseTime: response.headers['response-time'] || 'N/A',
          sportsAvailable: response.data?.sports?.length || 0
        }
      };
    } else {
      return {
        component: 'SGO API Connection',
        status: 'warning',
        details: `Unexpected response status: ${response.status}`
      };
    }

  } catch (error: any) {
    return {
      component: 'SGO API Connection',
      status: 'error',
      details: error.response?.status === 429 ? 'Rate limit exceeded' : error.message
    };
  }
}

async function checkBackfillProgress(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabaseClient
      .from('sgo_backfill_jobs')
      .select('status, created_at, progress, error_message')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const jobs = data || [];
    const recentJobs = jobs.filter(job => 
      new Date(job.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const runningJobs = jobs.filter(job => job.status === 'running').length;
    const failedJobs = recentJobs.filter(job => job.status === 'failed').length;
    const completedJobs = recentJobs.filter(job => job.status === 'completed').length;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let details = `${completedJobs} completed, ${runningJobs} running, ${failedJobs} failed in last 24h`;

    if (failedJobs > 5) {
      status = 'error';
      details += ` - High failure rate detected`;
    } else if (failedJobs > 2) {
      status = 'warning';
      details += ` - Some failures detected`;
    }

    return {
      component: 'Backfill Progress',
      status,
      details,
      metrics: {
        totalJobs: jobs.length,
        runningJobs,
        completedJobsLast24h: completedJobs,
        failedJobsLast24h: failedJobs,
        lastJobTime: jobs[0]?.created_at
      }
    };

  } catch (error: any) {
    return {
      component: 'Backfill Progress',
      status: 'error',
      details: `Failed to check progress: ${error.message}`
    };
  }
}

async function checkSettlementProgress(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .select('settled_at, source, created_at')
      .eq('source', 'sgo')
      .limit(1000);

    if (error) throw error;

    const sgoProps = data || [];
    const totalProps = sgoProps.length;
    const settledProps = sgoProps.filter(prop => prop.settled_at).length;
    const unsettledProps = totalProps - settledProps;
    const settlementRate = totalProps > 0 ? (settledProps / totalProps) * 100 : 0;

    // Check for old unsettled props
    const oldUnsettled = sgoProps.filter(prop => 
      !prop.settled_at && 
      new Date(prop.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let details = `${settledProps}/${totalProps} props settled (${settlementRate.toFixed(1)}%)`;

    if (settlementRate < 50) {
      status = 'error';
      details += ` - Low settlement rate`;
    } else if (settlementRate < 80) {
      status = 'warning';
      details += ` - Settlement rate could be improved`;
    }

    if (oldUnsettled > 100) {
      status = 'error';
      details += `, ${oldUnsettled} props unsettled >7 days`;
    } else if (oldUnsettled > 50) {
      status = 'warning';
      details += `, ${oldUnsettled} props unsettled >7 days`;
    }

    return {
      component: 'Settlement Progress',
      status,
      details,
      metrics: {
        totalSGOProps: totalProps,
        settledProps,
        unsettledProps,
        settlementRate: parseFloat(settlementRate.toFixed(1)),
        oldUnsettledProps: oldUnsettled
      }
    };

  } catch (error: any) {
    return {
      component: 'Settlement Progress',
      status: 'error',
      details: `Failed to check settlement progress: ${error.message}`
    };
  }
}

async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  try {
    // Check if required tables exist and are accessible
    const checks = await Promise.all([
      supabaseClient.from('historical_config').select('count', { count: 'exact', head: true }),
      supabaseClient.from('workflow_progress').select('count', { count: 'exact', head: true }),
      supabaseClient.from('sgo_backfill_jobs').select('count', { count: 'exact', head: true }),
      supabaseClient.from('raw_props').select('count', { count: 'exact', head: true }).eq('source', 'sgo')
    ]);

    const [configCheck, workflowCheck, jobsCheck, propsCheck] = checks;

    const allHealthy = checks.every(check => !check.error);

    if (allHealthy) {
      return {
        component: 'Database Health',
        status: 'healthy',
        details: 'All SGO tables accessible',
        metrics: {
          historicalConfigs: configCheck.count || 0,
          workflowProgress: workflowCheck.count || 0,
          backfillJobs: jobsCheck.count || 0,
          sgoProps: propsCheck.count || 0
        }
      };
    } else {
      const errors = checks.filter(check => check.error).map(check => check.error?.message);
      return {
        component: 'Database Health',
        status: 'error',
        details: `Database errors: ${errors.join(', ')}`
      };
    }

  } catch (error: any) {
    return {
      component: 'Database Health',
      status: 'error',
      details: `Failed to check database: ${error.message}`
    };
  }
}

async function checkQuotaUsage(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabaseClient
      .from('sgo_backfill_jobs')
      .select('api_calls_made, api_quota_used, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const jobs = data || [];
    const totalApiCalls = jobs.reduce((sum, job) => sum + (job.api_calls_made || 0), 0);
    const totalQuotaUsed = jobs.reduce((sum, job) => sum + (job.api_quota_used || 0), 0);

    // SGO trial typically allows 10,000 requests
    const TRIAL_LIMIT = 10000;
    const dailyUsagePercent = (totalQuotaUsed / TRIAL_LIMIT) * 100;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let details = `${totalQuotaUsed}/${TRIAL_LIMIT} API calls used today (${dailyUsagePercent.toFixed(1)}%)`;

    if (dailyUsagePercent > 90) {
      status = 'error';
      details += ' - Quota nearly exhausted';
    } else if (dailyUsagePercent > 75) {
      status = 'warning';
      details += ' - High quota usage';
    }

    return {
      component: 'API Quota Usage',
      status,
      details,
      metrics: {
        totalApiCalls,
        totalQuotaUsed,
        dailyUsagePercent: parseFloat(dailyUsagePercent.toFixed(1)),
        trialLimit: TRIAL_LIMIT
      }
    };

  } catch (error: any) {
    return {
      component: 'API Quota Usage',
      status: 'error',
      details: `Failed to check quota usage: ${error.message}`
    };
  }
}

async function runHealthCheck(): Promise<void> {
  logger.info('Starting SGO system health check...');

  const checks = await Promise.all([
    checkSGOApiConnection(),
    checkDatabaseHealth(),
    checkBackfillProgress(),
    checkSettlementProgress(),
    checkQuotaUsage()
  ]);

  // Print results
  console.log('\n🏥 SGO BACKFILL SYSTEM HEALTH CHECK');
  console.log('=' .repeat(50));

  let overallHealthy = true;
  
  checks.forEach(check => {
    const icon = {
      'healthy': '✅',
      'warning': '⚠️',
      'error': '❌'
    }[check.status];

    console.log(`\n${icon} ${check.component}`);
    console.log(`   Status: ${check.status.toUpperCase()}`);
    console.log(`   Details: ${check.details}`);
    
    if (check.metrics) {
      console.log('   Metrics:');
      Object.entries(check.metrics).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`);
      });
    }

    if (check.status !== 'healthy') {
      overallHealthy = false;
    }
  });

  console.log('\n' + '=' .repeat(50));
  console.log(`Overall Status: ${overallHealthy ? '✅ HEALTHY' : '⚠️ ISSUES DETECTED'}`);
  console.log('=' .repeat(50));

  if (!overallHealthy) {
    logger.warn('Health check detected issues - see details above');
    process.exit(1);
  } else {
    logger.info('All SGO system components healthy');
    process.exit(0);
  }
}

if (require.main === module) {
  runHealthCheck().catch(error => {
    logger.error('Health check failed', { error: error.message });
    process.exit(1);
  });
}