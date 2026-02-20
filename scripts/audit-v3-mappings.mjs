#!/usr/bin/env node
/**
 * SPRINT-V3-CATALOG-COVERAGE-AUDIT-083
 * Audit script for V3 provider mappings coverage
 * READ-ONLY - produces reports only
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PROOF_DIR = 'out/sprints/SPRINT-V3-CATALOG-COVERAGE-AUDIT-083/2026-02-20/proofs';

mkdirSync(PROOF_DIR, { recursive: true });

function writeProof(filename, content) {
  const path = join(PROOF_DIR, filename);
  writeFileSync(path, content);
  console.log(`  Written: ${path}`);
}

async function auditProviderEventMap() {
  console.log('\n=== PROVIDER EVENT MAPPINGS ===\n');

  const { data: mappings, error, count } = await supabase
    .from('provider_event_map')
    .select('*, provider_registry(code, display_name)', { count: 'exact' })
    .limit(500);

  let output = `=== PROVIDER EVENT MAP AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  if (error) {
    output += `STATUS: ${error.code === '42P01' ? 'TABLE DOES NOT EXIST' : `ERROR - ${error.message}`}\n`;
    console.log(output);
    return { count: 0, byProvider: {} };
  }

  output += `TOTAL MAPPINGS: ${count || mappings?.length || 0}\n\n`;

  // Count by provider
  const byProvider = {};
  (mappings || []).forEach(m => {
    const provider = m.provider_registry?.code || `provider_${m.provider_id}`;
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  });

  output += `BY PROVIDER:\n`;
  if (Object.keys(byProvider).length === 0) {
    output += `  [NONE - NO PROVIDER EVENT MAPPINGS]\n`;
  } else {
    Object.entries(byProvider).forEach(([provider, c]) => {
      output += `  ${provider}: ${c}\n`;
    });
  }

  // Sample mappings
  output += `\nSAMPLE MAPPINGS:\n`;
  (mappings || []).slice(0, 10).forEach(m => {
    output += `  ${m.provider_registry?.code || 'unknown'} | ${m.provider_event_id} -> ${m.canonical_event_id?.slice(0,8) || 'NULL'}...\n`;
  });

  console.log(output);
  return { count: count || 0, byProvider };
}

async function auditProviderTeamMap() {
  console.log('\n=== PROVIDER TEAM MAPPINGS ===\n');

  const { data: mappings, error, count } = await supabase
    .from('provider_team_map')
    .select('*, provider_registry(code, display_name)', { count: 'exact' })
    .limit(500);

  let output = `=== PROVIDER TEAM MAP AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  if (error) {
    output += `STATUS: ${error.code === '42P01' ? 'TABLE DOES NOT EXIST' : `ERROR - ${error.message}`}\n`;
    console.log(output);
    return { count: 0, byProvider: {} };
  }

  output += `TOTAL MAPPINGS: ${count || mappings?.length || 0}\n\n`;

  // Count by provider
  const byProvider = {};
  (mappings || []).forEach(m => {
    const provider = m.provider_registry?.code || `provider_${m.provider_id}`;
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  });

  output += `BY PROVIDER:\n`;
  if (Object.keys(byProvider).length === 0) {
    output += `  [NONE - NO PROVIDER TEAM MAPPINGS]\n`;
  } else {
    Object.entries(byProvider).forEach(([provider, c]) => {
      output += `  ${provider}: ${c}\n`;
    });
  }

  // Sample mappings
  output += `\nSAMPLE MAPPINGS:\n`;
  (mappings || []).slice(0, 10).forEach(m => {
    output += `  ${m.provider_registry?.code || 'unknown'} | "${m.provider_team_name || m.provider_team_id}" -> ${m.canonical_team_id?.slice(0,8) || 'NULL'}...\n`;
  });

  console.log(output);
  return { count: count || 0, byProvider };
}

async function auditProviderPlayerMap() {
  console.log('\n=== PROVIDER PLAYER MAPPINGS ===\n');

  const { data: mappings, error, count } = await supabase
    .from('provider_player_map')
    .select('*, provider_registry(code, display_name)', { count: 'exact' })
    .limit(500);

  let output = `=== PROVIDER PLAYER MAP AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  if (error) {
    output += `STATUS: ${error.code === '42P01' ? 'TABLE DOES NOT EXIST' : `ERROR - ${error.message}`}\n`;
    console.log(output);
    return { count: 0, byProvider: {} };
  }

  output += `TOTAL MAPPINGS: ${count || mappings?.length || 0}\n\n`;

  // Count by provider
  const byProvider = {};
  (mappings || []).forEach(m => {
    const provider = m.provider_registry?.code || `provider_${m.provider_id}`;
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  });

  output += `BY PROVIDER:\n`;
  if (Object.keys(byProvider).length === 0) {
    output += `  [NONE - NO PROVIDER PLAYER MAPPINGS]\n`;
  } else {
    Object.entries(byProvider).forEach(([provider, c]) => {
      output += `  ${provider}: ${c}\n`;
    });
  }

  console.log(output);
  return { count: count || 0, byProvider };
}

async function auditProviderMarketMap() {
  console.log('\n=== PROVIDER MARKET MAPPINGS ===\n');

  const { data: mappings, error, count } = await supabase
    .from('provider_market_map')
    .select('*, provider_registry(code, display_name)', { count: 'exact' })
    .limit(500);

  let output = `=== PROVIDER MARKET MAP AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  if (error) {
    output += `STATUS: ${error.code === '42P01' ? 'TABLE DOES NOT EXIST' : `ERROR - ${error.message}`}\n`;
    console.log(output);
    return { count: 0, byProvider: {} };
  }

  output += `TOTAL MAPPINGS: ${count || mappings?.length || 0}\n\n`;

  // Count by provider
  const byProvider = {};
  (mappings || []).forEach(m => {
    const provider = m.provider_registry?.code || `provider_${m.provider_id}`;
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  });

  output += `BY PROVIDER:\n`;
  if (Object.keys(byProvider).length === 0) {
    output += `  [NONE - NO PROVIDER MARKET MAPPINGS]\n`;
  } else {
    Object.entries(byProvider).forEach(([provider, c]) => {
      output += `  ${provider}: ${c}\n`;
    });
  }

  // Sample mappings
  output += `\nSAMPLE MAPPINGS:\n`;
  (mappings || []).slice(0, 10).forEach(m => {
    output += `  ${m.provider_registry?.code || 'unknown'} | "${m.provider_market_key}" -> market_type_id=${m.canonical_market_type_id || 'NULL'}\n`;
  });

  console.log(output);
  return { count: count || 0, byProvider };
}

async function auditProviderRegistry() {
  console.log('\n=== PROVIDER REGISTRY ===\n');

  const { data: providers, error } = await supabase
    .from('provider_registry')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: true });

  let output = `=== PROVIDER REGISTRY AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  if (error) {
    output += `STATUS: ERROR - ${error.message}\n`;
    console.log(output);
    return [];
  }

  output += `ACTIVE PROVIDERS: ${providers?.length || 0}\n\n`;
  output += `${'Code'.padEnd(15)} | ${'Display Name'.padEnd(20)} | Pri | API Source\n`;
  output += `${'-'.repeat(15)}-|-${'-'.repeat(20)}-|-----|------------\n`;

  (providers || []).forEach(p => {
    output += `${p.code.padEnd(15)} | ${(p.display_name || '').padEnd(20)} | ${String(p.priority).padStart(3)} | ${p.api_source || 'N/A'}\n`;
  });

  console.log(output);
  return providers || [];
}

async function auditIngestionSchedules() {
  console.log('\n=== INGESTION SCHEDULES / CRON JOBS ===\n');

  let output = `=== INGESTION SCHEDULE AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  // Check for any scheduled jobs table
  const tables = [
    'cron_jobs',
    'scheduled_tasks',
    'ingestion_schedules',
    'pg_cron_jobs'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(10);

    if (error && error.code !== '42P01') {
      output += `${table}: ERROR - ${error.message}\n`;
    } else if (!error) {
      output += `${table}: ${data?.length || 0} records\n`;
      data?.forEach(d => {
        output += `  - ${JSON.stringify(d).slice(0, 100)}...\n`;
      });
    }
  }

  // Check for agent_health to see if agents are running
  const { data: agentHealth, error: agentError } = await supabase
    .from('agent_health')
    .select('*')
    .order('last_heartbeat', { ascending: false })
    .limit(20);

  output += `\nAGENT HEALTH (ingestion agents):\n`;
  if (agentError) {
    output += `  ERROR: ${agentError.message}\n`;
  } else if (!agentHealth || agentHealth.length === 0) {
    output += `  [NO AGENTS REGISTERED]\n`;
  } else {
    agentHealth.forEach(a => {
      const lastSeen = a.last_heartbeat ? new Date(a.last_heartbeat).toISOString() : 'never';
      output += `  ${a.agent_name || a.agent_id}: ${a.status || 'unknown'} (last: ${lastSeen})\n`;
    });
  }

  console.log(output);
  return { agentHealth };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  SPRINT-V3-CATALOG-COVERAGE-AUDIT-083                          ║');
  console.log('║  V3 Mappings Audit                                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results = {};

  // C) Mapping health
  results.eventMap = await auditProviderEventMap();
  results.teamMap = await auditProviderTeamMap();
  results.playerMap = await auditProviderPlayerMap();
  results.marketMap = await auditProviderMarketMap();
  results.providers = await auditProviderRegistry();
  results.ingestion = await auditIngestionSchedules();

  // Write combined mapping proof
  let mappingOutput = `=== MAPPING COVERAGE AUDIT ===
Generated: ${new Date().toISOString()}

PROVIDER MAPPINGS SUMMARY:
- provider_event_map: ${results.eventMap.count} mappings
- provider_team_map: ${results.teamMap.count} mappings
- provider_player_map: ${results.playerMap.count} mappings
- provider_market_map: ${results.marketMap.count} mappings

REGISTERED PROVIDERS: ${results.providers.length}
${results.providers.map(p => `  - ${p.code} (${p.display_name})`).join('\n')}

EVENT MAPPINGS BY PROVIDER:
${Object.entries(results.eventMap.byProvider).map(([p, c]) => `  ${p}: ${c}`).join('\n') || '  [NONE]'}

TEAM MAPPINGS BY PROVIDER:
${Object.entries(results.teamMap.byProvider).map(([p, c]) => `  ${p}: ${c}`).join('\n') || '  [NONE]'}

PLAYER MAPPINGS BY PROVIDER:
${Object.entries(results.playerMap.byProvider).map(([p, c]) => `  ${p}: ${c}`).join('\n') || '  [NONE]'}

MARKET MAPPINGS BY PROVIDER:
${Object.entries(results.marketMap.byProvider).map(([p, c]) => `  ${p}: ${c}`).join('\n') || '  [NONE]'}

CRITICAL GAPS:
${results.eventMap.count === 0 ? '- NO EVENT MAPPINGS (providers cant link to canonical events)\n' : ''}${results.teamMap.count === 0 ? '- NO TEAM MAPPINGS (providers cant link to canonical teams)\n' : ''}${results.playerMap.count === 0 ? '- NO PLAYER MAPPINGS (player props impossible)\n' : ''}${results.marketMap.count === 0 ? '- NO MARKET MAPPINGS (providers cant link to canonical market types)\n' : ''}
`;

  writeProof('proof_mapping_coverage.txt', mappingOutput);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      MAPPINGS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Provider Event Map: ${results.eventMap.count}`);
  console.log(`Provider Team Map: ${results.teamMap.count}`);
  console.log(`Provider Player Map: ${results.playerMap.count}`);
  console.log(`Provider Market Map: ${results.marketMap.count}`);
  console.log(`Registered Providers: ${results.providers.length}`);

  console.log('\n✓ Mapping audit complete. Proofs written to:', PROOF_DIR);
}

main().catch(console.error);
