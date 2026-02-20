#!/usr/bin/env node
/**
 * SPRINT-V3-CATALOG-COVERAGE-AUDIT-083
 * Audit script for V3 catalog coverage analysis
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

// Ensure proof directory exists
mkdirSync(PROOF_DIR, { recursive: true });

function writeProof(filename, content) {
  const path = join(PROOF_DIR, filename);
  writeFileSync(path, content);
  console.log(`  Written: ${path}`);
}

async function auditEventsBySport() {
  console.log('\n=== A) EVENTS COVERAGE BY SPORT (Next 7 Days) ===\n');

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get all events
  const { data: events, error } = await supabase
    .from('view_events_for_form')
    .select('id, sport, league, home_team, away_team, scheduled_at')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', weekFromNow.toISOString());

  if (error) {
    console.log('Error fetching events:', error.message);
    // Try direct table query
    const { data: directEvents, error: directError } = await supabase
      .from('events')
      .select('id, sport, event_type, scheduled_at, status')
      .in('status', ['scheduled', 'live']);

    if (directError) {
      console.log('Direct events query also failed:', directError.message);
    }
  }

  // Count by sport
  const sportCounts = {};
  const sportLeagueCounts = {};

  (events || []).forEach(e => {
    sportCounts[e.sport] = (sportCounts[e.sport] || 0) + 1;
    const key = `${e.sport}/${e.league}`;
    sportLeagueCounts[key] = (sportLeagueCounts[key] || 0) + 1;
  });

  let output = `=== EVENTS COVERAGE AUDIT ===\nGenerated: ${new Date().toISOString()}\nDate Range: ${now.toISOString().split('T')[0]} to ${weekFromNow.toISOString().split('T')[0]}\n\n`;

  output += `EVENTS BY SPORT (Next 7 Days):\n`;
  output += `${'Sport'.padEnd(15)} | Count\n`;
  output += `${'-'.repeat(15)}-|-------\n`;

  const expectedSports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'UFC', 'SOCCER', 'TENNIS', 'GOLF'];

  expectedSports.forEach(sport => {
    const count = sportCounts[sport] || 0;
    const status = count === 0 ? ' [MISSING]' : '';
    output += `${sport.padEnd(15)} | ${String(count).padStart(5)}${status}\n`;
  });

  output += `\nTOTAL EVENTS: ${events?.length || 0}\n`;

  output += `\nEVENTS BY SPORT/LEAGUE:\n`;
  Object.entries(sportLeagueCounts).forEach(([key, count]) => {
    output += `  ${key}: ${count}\n`;
  });

  // Sample events
  output += `\nSAMPLE EVENTS:\n`;
  (events || []).slice(0, 10).forEach(e => {
    output += `  ${e.sport} | ${e.away_team || 'N/A'} @ ${e.home_team || 'N/A'} | ${e.scheduled_at}\n`;
  });

  console.log(output);
  writeProof('proof_events_counts_by_sport.txt', output);

  return { sportCounts, totalEvents: events?.length || 0 };
}

async function auditMarketTypesBySport() {
  console.log('\n=== MARKET TYPES BY SPORT ===\n');

  // Get market types from view
  const { data: marketTypes, error } = await supabase
    .from('view_market_types_for_sport')
    .select('*');

  // Also check the base table
  const { data: baseMarketTypes, error: baseError } = await supabase
    .from('market_types')
    .select('*, sports_registry(code)')
    .eq('active', true);

  let output = `=== MARKET TYPES AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  // Count by sport
  const bySport = {};
  const byGroup = {};

  (marketTypes || []).forEach(mt => {
    const sport = mt.sport || 'UNIVERSAL';
    bySport[sport] = bySport[sport] || [];
    bySport[sport].push(mt);

    const group = mt.parent_group || mt.market_group || 'unknown';
    byGroup[group] = byGroup[group] || [];
    byGroup[group].push(mt);
  });

  output += `MARKET TYPES FROM view_market_types_for_sport:\n`;
  output += `Total: ${marketTypes?.length || 0}\n\n`;

  output += `BY SPORT:\n`;
  Object.entries(bySport).forEach(([sport, types]) => {
    output += `\n${sport} (${types.length} types):\n`;
    types.forEach(t => {
      output += `  - ${t.market_key}: ${t.display_name} [${t.market_group}] requires_line=${t.requires_line} requires_participant=${t.requires_participant}\n`;
    });
  });

  output += `\nBY GROUP:\n`;
  Object.entries(byGroup).forEach(([group, types]) => {
    output += `  ${group}: ${types.length} types\n`;
  });

  // Check for REQUIRED market types
  const requiredMarkets = [
    'team_moneyline', 'team_spread', 'game_total', 'team_total',
    'player_points_ou', 'player_rebounds_ou', 'player_assists_ou',
    'player_passing_yards_ou', 'player_rushing_yards_ou',
    'fight_winner', 'match_winner'
  ];

  const existingKeys = new Set((marketTypes || []).map(m => m.market_key));

  output += `\nREQUIRED MARKET TYPES CHECK:\n`;
  requiredMarkets.forEach(key => {
    const exists = existingKeys.has(key);
    output += `  ${exists ? '[OK]' : '[MISSING]'} ${key}\n`;
  });

  // Check base market_types table
  output += `\nBASE market_types TABLE:\n`;
  output += `Total active: ${baseMarketTypes?.length || 0}\n`;

  console.log(output);
  writeProof('proof_market_types_by_sport.txt', output);

  return { marketTypes: marketTypes?.length || 0, bySport };
}

async function auditParticipants() {
  console.log('\n=== PARTICIPANTS COVERAGE ===\n');

  // Get all participants
  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, name, display_name, type, sport, active')
    .eq('active', true);

  let output = `=== PARTICIPANTS AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  // Count by type and sport
  const byType = {};
  const bySport = {};

  (participants || []).forEach(p => {
    byType[p.type] = (byType[p.type] || 0) + 1;
    bySport[p.sport || 'unknown'] = (bySport[p.sport || 'unknown'] || 0) + 1;
  });

  output += `TOTAL PARTICIPANTS: ${participants?.length || 0}\n\n`;

  output += `BY TYPE:\n`;
  Object.entries(byType).forEach(([type, count]) => {
    output += `  ${type}: ${count}\n`;
  });

  output += `\nBY SPORT:\n`;
  const expectedSports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF'];
  expectedSports.forEach(sport => {
    const count = bySport[sport] || 0;
    const status = count === 0 ? ' [MISSING]' : '';
    output += `  ${sport}: ${count}${status}\n`;
  });

  // Sample participants
  output += `\nSAMPLE PARTICIPANTS:\n`;
  (participants || []).slice(0, 20).forEach(p => {
    output += `  ${p.id?.slice(0,8)}... | ${p.type?.padEnd(8)} | ${p.sport?.padEnd(5) || 'N/A'.padEnd(5)} | ${p.display_name || p.name}\n`;
  });

  // Check participant_memberships for player-team associations
  const { data: memberships } = await supabase
    .from('participant_memberships')
    .select('id, participant_id, team_id, role')
    .limit(100);

  output += `\nPARTICIPANT MEMBERSHIPS (player-team links): ${memberships?.length || 0}\n`;

  console.log(output);
  writeProof('proof_participants_counts.txt', output);

  return { total: participants?.length || 0, byType, bySport };
}

async function auditOffers() {
  console.log('\n=== PROVIDER OFFERS COVERAGE ===\n');

  let output = `=== PROVIDER OFFERS AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  // Total offers
  const { count: totalOffers } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });

  output += `TOTAL OFFERS IN provider_offers: ${totalOffers || 0}\n\n`;

  // Recent offers (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentOffers } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);

  output += `OFFERS IN LAST 24 HOURS: ${recentOffers || 0}\n`;

  // Offers by provider
  const { data: offersByProvider } = await supabase
    .from('provider_offers')
    .select('provider')
    .limit(10000);

  const providerCounts = {};
  (offersByProvider || []).forEach(o => {
    providerCounts[o.provider] = (providerCounts[o.provider] || 0) + 1;
  });

  output += `\nOFFERS BY PROVIDER:\n`;
  Object.entries(providerCounts).sort((a, b) => b[1] - a[1]).forEach(([provider, count]) => {
    output += `  ${provider}: ${count}\n`;
  });

  // Check view_provider_offers_current
  const { data: currentOffers, error: currentError } = await supabase
    .from('view_provider_offers_current')
    .select('*')
    .limit(10);

  output += `\nview_provider_offers_current:\n`;
  if (currentError) {
    output += `  ERROR: ${currentError.message}\n`;
  } else {
    output += `  Sample count: ${currentOffers?.length || 0}\n`;
  }

  console.log(output);
  writeProof('proof_offers_counts.txt', output);

  return { totalOffers: totalOffers || 0, recentOffers: recentOffers || 0, providerCounts };
}

async function auditQuarantine() {
  console.log('\n=== QUARANTINE STATUS ===\n');

  let output = `=== QUARANTINE AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  // Check if offer_quarantine table exists
  const { data: quarantine, error, count } = await supabase
    .from('offer_quarantine')
    .select('*', { count: 'exact' })
    .limit(100);

  if (error) {
    output += `offer_quarantine table: ${error.code === '42P01' ? 'DOES NOT EXIST' : error.message}\n`;
  } else {
    output += `TOTAL QUARANTINED OFFERS: ${count || 0}\n\n`;

    // Count by reason
    const byReason = {};
    (quarantine || []).forEach(q => {
      byReason[q.reason || 'unknown'] = (byReason[q.reason || 'unknown'] || 0) + 1;
    });

    output += `BY REASON:\n`;
    Object.entries(byReason).forEach(([reason, c]) => {
      output += `  ${reason}: ${c}\n`;
    });

    // Sample quarantined
    output += `\nSAMPLE QUARANTINED:\n`;
    (quarantine || []).slice(0, 10).forEach(q => {
      output += `  ${q.id?.slice(0,8)}... | ${q.reason} | ${q.created_at}\n`;
    });
  }

  console.log(output);
  writeProof('proof_quarantine_counts.txt', output);

  return { count: count || 0 };
}

async function auditContractViews() {
  console.log('\n=== B) CONTRACT VIEW HEALTH ===\n');

  let output = `=== CONTRACT VIEW HEALTH AUDIT ===\nGenerated: ${new Date().toISOString()}\n\n`;

  const views = [
    'view_sports_active',
    'view_events_for_form',
    'view_market_types_for_sport',
    'view_market_groups_hierarchy',
    'view_participants_for_event',
    'view_provider_offers_current'
  ];

  for (const view of views) {
    output += `\n--- ${view} ---\n`;

    const { data, error, count } = await supabase
      .from(view)
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      output += `  STATUS: ERROR - ${error.message}\n`;
      output += `  CODE: ${error.code}\n`;
    } else {
      output += `  STATUS: OK\n`;
      output += `  ROW COUNT: ${count || data?.length || 0}\n`;

      if (data && data.length > 0) {
        output += `  COLUMNS: ${Object.keys(data[0]).join(', ')}\n`;
        output += `  SAMPLE KEYS:\n`;
        data.slice(0, 3).forEach((row, i) => {
          const key = row.id || row.code || row.market_key || JSON.stringify(row).slice(0, 80);
          output += `    ${i + 1}. ${key}\n`;
        });
      }
    }
  }

  console.log(output);
  writeProof('proof_view_rowcounts.txt', output);
}

async function auditSportsRegistry() {
  console.log('\n=== SPORTS REGISTRY ===\n');

  const { data: sports } = await supabase
    .from('sports_registry')
    .select('*')
    .eq('active', true);

  console.log('Active Sports:', sports?.length || 0);
  sports?.forEach(s => {
    console.log(`  ${s.code}: ${s.display_name} (segments=${s.has_segments}, player_props=${s.supports_player_props})`);
  });

  return sports || [];
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  SPRINT-V3-CATALOG-COVERAGE-AUDIT-083                          ║');
  console.log('║  V3 Catalog Coverage Audit                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results = {};

  // A) Coverage by sport
  results.events = await auditEventsBySport();
  results.marketTypes = await auditMarketTypesBySport();
  results.participants = await auditParticipants();
  results.offers = await auditOffers();
  results.quarantine = await auditQuarantine();

  // B) Contract view health
  await auditContractViews();

  // Sports registry
  results.sports = await auditSportsRegistry();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      COVERAGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Events (next 7 days): ${results.events.totalEvents}`);
  console.log(`Market Types: ${results.marketTypes.marketTypes}`);
  console.log(`Participants: ${results.participants.total}`);
  console.log(`Provider Offers: ${results.offers.totalOffers}`);
  console.log(`Quarantined: ${results.quarantine.count}`);
  console.log(`Sports Registry: ${results.sports.length}`);

  // Write summary
  const summaryOutput = `
=== V3 CATALOG COVERAGE SUMMARY ===
Generated: ${new Date().toISOString()}

COUNTS:
- Events (next 7 days): ${results.events.totalEvents}
- Market Types: ${results.marketTypes.marketTypes}
- Participants: ${results.participants.total}
- Provider Offers: ${results.offers.totalOffers}
- Quarantined: ${results.quarantine.count}
- Sports Registry: ${results.sports.length}

EVENTS BY SPORT:
${Object.entries(results.events.sportCounts).map(([s, c]) => `  ${s}: ${c}`).join('\n') || '  NONE'}

PARTICIPANTS BY TYPE:
${Object.entries(results.participants.byType).map(([t, c]) => `  ${t}: ${c}`).join('\n') || '  NONE'}

PARTICIPANTS BY SPORT:
${Object.entries(results.participants.bySport).map(([s, c]) => `  ${s}: ${c}`).join('\n') || '  NONE'}

CRITICAL GAPS:
${results.events.totalEvents === 0 ? '- NO EVENTS for upcoming games\n' : ''}${results.participants.total < 10 ? '- INSUFFICIENT PARTICIPANTS (need teams + players)\n' : ''}${results.offers.totalOffers === 0 ? '- NO PROVIDER OFFERS loaded\n' : ''}
`;

  writeProof('proof_coverage_summary.txt', summaryOutput);

  console.log('\n✓ Audit complete. Proofs written to:', PROOF_DIR);
}

main().catch(console.error);
