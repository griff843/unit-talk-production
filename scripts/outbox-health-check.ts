/* eslint-disable no-console */
/**
 * Outbox Health Check Script
 * Checks pick_publish and bridge_outbox metrics for stuck detection
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getOutboxHealth() {
  console.log('=== OUTBOX HEALTH METRICS ===\n');

  // pick_publish metrics
  const { count: ppPending } = await supabase.from('pick_publish').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: ppProcessing } = await supabase.from('pick_publish').select('*', { count: 'exact', head: true }).eq('status', 'processing');
  const { count: ppSent } = await supabase.from('pick_publish').select('*', { count: 'exact', head: true }).eq('status', 'sent');
  const { count: ppFailed } = await supabase.from('pick_publish').select('*', { count: 'exact', head: true }).eq('status', 'failed');

  // bridge_outbox metrics
  const { count: boPending } = await supabase.from('bridge_outbox').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: boProcessing } = await supabase.from('bridge_outbox').select('*', { count: 'exact', head: true }).eq('status', 'processing');
  const { count: boCompleted } = await supabase.from('bridge_outbox').select('*', { count: 'exact', head: true }).in('status', ['sent', 'completed', 'processed']);
  const { count: boFailed } = await supabase.from('bridge_outbox').select('*', { count: 'exact', head: true }).eq('status', 'failed');

  // Oldest pending ages
  const { data: ppOldest } = await supabase.from('pick_publish').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).single();
  const { data: boOldest } = await supabase.from('bridge_outbox').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).single();

  const now = Date.now();
  const ppOldestAge = ppOldest ? Math.floor((now - new Date(ppOldest.created_at).getTime()) / 1000) : null;
  const boOldestAge = boOldest ? Math.floor((now - new Date(boOldest.created_at).getTime()) / 1000) : null;

  console.log('## pick_publish');
  console.log('| Status | Count |');
  console.log('|--------|-------|');
  console.log('| pending |', ppPending || 0, '|');
  console.log('| processing |', ppProcessing || 0, '|');
  console.log('| sent |', ppSent || 0, '|');
  console.log('| failed |', ppFailed || 0, '|');
  console.log('| oldest_pending_age_sec |', ppOldestAge || 'N/A', '|');

  console.log('\n## bridge_outbox');
  console.log('| Status | Count |');
  console.log('|--------|-------|');
  console.log('| pending |', boPending || 0, '|');
  console.log('| processing |', boProcessing || 0, '|');
  console.log('| sent/completed |', boCompleted || 0, '|');
  console.log('| failed |', boFailed || 0, '|');
  console.log('| oldest_pending_age_sec |', boOldestAge || 'N/A', '|');

  // Stuck detection (processing > 5 minutes)
  console.log('\n## Stuck Detection (processing > 5 min)');
  const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const { count: ppStuck } = await supabase.from('pick_publish').select('*', { count: 'exact', head: true }).eq('status', 'processing').lt('updated_at', fiveMinAgo);
  const { count: boStuck } = await supabase.from('bridge_outbox').select('*', { count: 'exact', head: true }).eq('status', 'processing').lt('updated_at', fiveMinAgo);

  const stuckTotal = (ppStuck || 0) + (boStuck || 0);
  console.log('pick_publish stuck:', ppStuck || 0);
  console.log('bridge_outbox stuck:', boStuck || 0);
  console.log('\nVERDICT:', stuckTotal === 0 ? 'PASS - No stuck records' : 'WARN - ' + stuckTotal + ' stuck records detected');

  return {
    pick_publish: {
      pending: ppPending || 0,
      processing: ppProcessing || 0,
      sent: ppSent || 0,
      failed: ppFailed || 0,
      oldest_pending_age_sec: ppOldestAge,
      stuck: ppStuck || 0,
    },
    bridge_outbox: {
      pending: boPending || 0,
      processing: boProcessing || 0,
      completed: boCompleted || 0,
      failed: boFailed || 0,
      oldest_pending_age_sec: boOldestAge,
      stuck: boStuck || 0,
    },
    stuck_total: stuckTotal,
    verdict: stuckTotal === 0 ? 'PASS' : 'WARN',
  };
}

getOutboxHealth().catch(console.error);
