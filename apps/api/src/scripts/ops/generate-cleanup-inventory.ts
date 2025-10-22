#!/usr/bin/env tsx
/**
 * Generate Cleanup Inventory (DRY-RUN)
 * 
 * Identifies stale/orphaned data for cleanup but DOES NOT execute deletions.
 * Generates JSON inventory for manual review and approval.
 * 
 * Usage:
 *   npm run ops:cleanup-inventory
 * 
 * Output:
 *   apps/api/out/ops/cleanup/cleanup-inventory-YYYYMMDD.json
 * 
 * Remediation for: STRUCTURAL_AUDIT.md High Risk #12
 * Phase 4 Remediation Deployment
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const RETENTION_POLICIES = {
  stale_props_days: 90,      // Props older than 90 days
  old_picks_days: 180,       // Picks older than 180 days
  stale_agent_health_days: 7, // Agent health older than 7 days
};

// ============================================================================
// Types
// ============================================================================

interface CleanupInventory {
  generated_at: string;
  dry_run: true;
  retention_policies: typeof RETENTION_POLICIES;
  stale_props: Array<{ id: string; game_date: string; age_days: number }>;
  old_picks: Array<{ id: string; created_at: string; age_days: number }>;
  orphaned_scores: Array<{ id: string; prop_ref: string }>;
  stale_agents: Array<{ id: string; agent_name: string; last_ping: string; age_days: number }>;
  summary: {
    total_items: number;
    stale_props_count: number;
    old_picks_count: number;
    orphaned_scores_count: number;
    stale_agents_count: number;
  };
}

// ============================================================================
// Main Function
// ============================================================================

async function generateCleanupInventory(): Promise<void> {
  console.log('=== Cleanup Inventory Generator (DRY-RUN) ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Retention Policies:', RETENTION_POLICIES);

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Initialize inventory
  const inventory: CleanupInventory = {
    generated_at: new Date().toISOString(),
    dry_run: true,
    retention_policies: RETENTION_POLICIES,
    stale_props: [],
    old_picks: [],
    orphaned_scores: [],
    stale_agents: [],
    summary: {
      total_items: 0,
      stale_props_count: 0,
      old_picks_count: 0,
      orphaned_scores_count: 0,
      stale_agents_count: 0,
    },
  };

  // 1. Find stale props (>90 days)
  console.log('\n1. Scanning for stale props (>90 days)...');
  const stalePropsDate = new Date();
  stalePropsDate.setDate(stalePropsDate.getDate() - RETENTION_POLICIES.stale_props_days);

  const { data: staleProps, error: stalePropsError } = await supabase
    .from('market_props')
    .select('id, game_date')
    .lt('game_date', stalePropsDate.toISOString());

  if (stalePropsError) {
    console.error('❌ Error querying stale props:', stalePropsError);
  } else if (staleProps) {
    inventory.stale_props = staleProps.map((prop) => {
      const ageDays = Math.floor(
        (new Date().getTime() - new Date(prop.game_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { id: prop.id, game_date: prop.game_date, age_days: ageDays };
    });
    inventory.summary.stale_props_count = inventory.stale_props.length;
    console.log(`   Found ${inventory.stale_props.length} stale props`);
  }

  // 2. Find old picks (>180 days)
  console.log('\n2. Scanning for old picks (>180 days)...');
  const oldPicksDate = new Date();
  oldPicksDate.setDate(oldPicksDate.getDate() - RETENTION_POLICIES.old_picks_days);

  const { data: oldPicks, error: oldPicksError } = await supabase
    .from('unified_picks')
    .select('id, created_at')
    .lt('created_at', oldPicksDate.toISOString());

  if (oldPicksError) {
    console.error('❌ Error querying old picks:', oldPicksError);
  } else if (oldPicks) {
    inventory.old_picks = oldPicks.map((pick) => {
      const ageDays = Math.floor(
        (new Date().getTime() - new Date(pick.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { id: pick.id, created_at: pick.created_at, age_days: ageDays };
    });
    inventory.summary.old_picks_count = inventory.old_picks.length;
    console.log(`   Found ${inventory.old_picks.length} old picks`);
  }

  // 3. Find orphaned scores (no matching prop)
  console.log('\n3. Scanning for orphaned scores...');
  const { data: orphanedScores, error: orphanedScoresError } = await supabase.rpc(
    'find_orphaned_scores'
  );

  if (orphanedScoresError) {
    console.warn('⚠️  find_orphaned_scores function not found - skipping');
  } else if (orphanedScores) {
    inventory.orphaned_scores = orphanedScores.map((score: any) => ({
      id: score.id,
      prop_ref: score.prop_ref,
    }));
    inventory.summary.orphaned_scores_count = inventory.orphaned_scores.length;
    console.log(`   Found ${inventory.orphaned_scores.length} orphaned scores`);
  }

  // 4. Find stale agent health (>7 days)
  console.log('\n4. Scanning for stale agent health (>7 days)...');
  const staleAgentsDate = new Date();
  staleAgentsDate.setDate(staleAgentsDate.getDate() - RETENTION_POLICIES.stale_agent_health_days);

  const { data: staleAgents, error: staleAgentsError } = await supabase
    .from('agent_health')
    .select('id, agent_name, last_ping')
    .lt('last_ping', staleAgentsDate.toISOString());

  if (staleAgentsError) {
    console.error('❌ Error querying stale agents:', staleAgentsError);
  } else if (staleAgents) {
    inventory.stale_agents = staleAgents.map((agent) => {
      const ageDays = Math.floor(
        (new Date().getTime() - new Date(agent.last_ping).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { id: agent.id, agent_name: agent.agent_name, last_ping: agent.last_ping, age_days: ageDays };
    });
    inventory.summary.stale_agents_count = inventory.stale_agents.length;
    console.log(`   Found ${inventory.stale_agents.length} stale agent health records`);
  }

  // Calculate total
  inventory.summary.total_items =
    inventory.summary.stale_props_count +
    inventory.summary.old_picks_count +
    inventory.summary.orphaned_scores_count +
    inventory.summary.stale_agents_count;

  // Write inventory to file
  const outputDir = path.join(process.cwd(), 'out', 'ops', 'cleanup');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const outputPath = path.join(outputDir, `cleanup-inventory-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Total items identified: ${inventory.summary.total_items}`);
  console.log(`  - Stale props: ${inventory.summary.stale_props_count}`);
  console.log(`  - Old picks: ${inventory.summary.old_picks_count}`);
  console.log(`  - Orphaned scores: ${inventory.summary.orphaned_scores_count}`);
  console.log(`  - Stale agents: ${inventory.summary.stale_agents_count}`);
  console.log(`\n✅ Inventory written to: ${outputPath}`);
  console.log('\n⚠️  DRY-RUN ONLY - No deletions executed');
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  generateCleanupInventory().catch((error) => {
    console.error('❌ Error generating cleanup inventory:', error);
    process.exit(1);
  });
}

export { generateCleanupInventory };

