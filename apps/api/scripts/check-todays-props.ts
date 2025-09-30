#!/usr/bin/env npx tsx
import { supabase } from '../src/services/supabaseClient';
import { logger } from '../src/utils/logger';

async function checkTodaysData() {
  const today = new Date().toISOString().split('T')[0];
  logger.info(`Checking for props on: ${today}`);

  // Check today's count
  const { count: todayCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  logger.info(`Props in database for today (${today}): ${todayCount || 0}`);

  // Get date range of available data
  const { data: dateRange } = await supabase
    .from('raw_props')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: oldestDate } = await supabase
    .from('raw_props')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1);

  if (dateRange && oldestDate) {
    logger.info(`\nData available from: ${oldestDate[0].created_at.split('T')[0]} to ${dateRange[0].created_at.split('T')[0]}`);
  }

  // Get sample of most recent props
  logger.info('\nMost recent props in database:');

  const { data: recent } = await supabase
    .from('raw_props')
    .select('player_name, stat_type, line, sport, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recent) {
    recent.forEach((prop, i) => {
      logger.info(`${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport}) - ${prop.created_at.split('T')[0]}`);
    });
  }

  return { todayCount, hasCurrentData: todayCount > 0 };
}

checkTodaysData().catch(console.error);