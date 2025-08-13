#!/usr/bin/env tsx

/**
 * Check unified_picks table structure in Supabase Cloud
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../src/utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function checkUnifiedPicksSchema() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🔍 Checking unified_picks table structure...');

    // Check table columns
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'unified_picks')
      .order('ordinal_position');

    if (columnsError) {
      logger.error('Error getting columns:', columnsError);
    } else {
      logger.info(`\n📊 unified_picks table columns (${columns?.length} total):`);
      console.table(columns);
    }

    // Check if there are any records
    const { count, error: countError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error('Error counting records:', countError);
    } else {
      logger.info(`\n📈 Total unified_picks records: ${count}`);
    }

    // Check recent raw_props to see what should be graded
    const { data: recentProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (propsError) {
      logger.error('Error getting recent props:', propsError);
    } else {
      logger.info(`\n📋 Recent raw_props samples (should be graded):`);
      console.table(recentProps);
    }

    // Check if there's any grading activity logs
    const { data: agentLogs, error: logsError } = await supabase
      .from('agent_health')
      .select('agent_type, status, last_activity, error_message')
      .eq('agent_type', 'GradingAgent')
      .order('last_activity', { ascending: false })
      .limit(5);

    if (logsError) {
      logger.warn('No agent_health table or GradingAgent logs found');
    } else if (agentLogs && agentLogs.length > 0) {
      logger.info(`\n🤖 GradingAgent status:`);
      console.table(agentLogs);
    } else {
      logger.warn('No GradingAgent activity found in agent_health table');
    }

  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  checkUnifiedPicksSchema()
    .then(() => {
      console.log('\n✅ Schema check completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Schema check failed:', error);
      process.exit(1);
    });
}