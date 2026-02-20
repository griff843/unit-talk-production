#!/usr/bin/env node
/**
 * Test Manual Entry - Sprint 084
 * Submits 5 manual picks via atomic_submit_ticket_v2 RPC
 * 
 * Required picks:
 * 1. NBA Celtics ML -140
 * 2. NBA Donovan Mitchell Assists Over 8 -110
 * 3. NBA Magic Team Total Over 105 -110
 * 4. MLB Twins/Royals NRFI -115
 * 5. NHL Devils +1.5 -120
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

function generateBetSlipId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `SF-${datePart}-${randomPart}`;
}

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

const picks = [
  {
    name: 'NBA Celtics ML -140',
    leg: {
      sport: 'NBA',
      bet_type: 'moneyline',
      home_team: 'Celtics',
      away_team: 'Lakers',
      selection: 'home',
      odds: -140,
      provider: 'fanduel'
    }
  },
  {
    name: 'NBA Donovan Mitchell Assists Over 8 -110',
    leg: {
      sport: 'NBA',
      bet_type: 'player_prop',
      home_team: 'Cavaliers',
      away_team: 'Bucks',
      player_name: 'Donovan Mitchell',
      prop_type: 'Assists',
      selection: 'over',
      line: 8,
      odds: -110,
      provider: 'draftkings'
    }
  },
  {
    name: 'NBA Magic Team Total Over 105 -110',
    leg: {
      sport: 'NBA',
      bet_type: 'team_total',
      home_team: 'Magic',
      away_team: 'Heat',
      selection: 'over',
      line: 105,
      odds: -110,
      provider: 'betmgm'
    }
  },
  {
    name: 'MLB Twins/Royals NRFI -115',
    leg: {
      sport: 'MLB',
      bet_type: 'nrfi',
      home_team: 'Royals',
      away_team: 'Twins',
      selection: 'yes',
      odds: -115,
      provider: 'caesars'
    }
  },
  {
    name: 'NHL Devils +1.5 -120',
    leg: {
      sport: 'NHL',
      bet_type: 'puck_line',
      home_team: 'Devils',
      away_team: 'Rangers',
      selection: 'home',
      line: 1.5,
      odds: -120,
      provider: 'fanduel'
    }
  }
];

async function submitPick(pick, index) {
  const betSlipId = generateBetSlipId() + '-pick' + (index + 1);
  
  console.log(`\n=== Submitting Pick ${index + 1}: ${pick.name} ===`);
  console.log('Bet Slip ID:', betSlipId);
  console.log('Leg data:', JSON.stringify(pick.leg, null, 2));
  
  const query = `
    SELECT * FROM atomic_submit_ticket_v2(
      $1::TEXT,
      $2::UUID,
      'single'::TEXT,
      1.0::NUMERIC,
      $3::JSONB[],
      'smart_form'::TEXT,
      $4::JSONB
    )
  `;
  
  const result = await client.query(query, [
    betSlipId,
    TEST_USER_ID,
    [JSON.stringify(pick.leg)],
    JSON.stringify({ entry_mode: 'manual', source: 'test_084' })
  ]);
  
  const row = result.rows[0];
  console.log('\nResult:');
  console.log('  Status:', row.out_status);
  console.log('  Ticket ID:', row.out_ticket_id);
  console.log('  Leg IDs:', row.out_leg_ids);
  
  if (row.out_error_details) {
    console.log('  Errors:', JSON.stringify(row.out_error_details, null, 2));
  }
  
  return {
    pick: pick.name,
    status: row.out_status,
    ticket_id: row.out_ticket_id,
    leg_ids: row.out_leg_ids,
    error_details: row.out_error_details
  };
}

async function main() {
  console.log('=== Manual Entry Test - Sprint 084 ===');
  console.log('Testing 5 manual picks via atomic_submit_ticket_v2');
  console.log('entry_mode: manual (no FK validation)');
  
  try {
    await client.connect();
    console.log('\nConnected to database');
    
    const results = [];
    
    for (let i = 0; i < picks.length; i++) {
      const result = await submitPick(picks[i], i);
      results.push(result);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Pick | Status | Ticket ID');
    console.log('-----|--------|----------');
    for (const r of results) {
      console.log(`${r.pick} | ${r.status} | ${r.ticket_id || 'N/A'}`);
    }
    
    const successCount = results.filter(r => r.status === 'inserted').length;
    console.log(`\n✅ ${successCount}/5 picks submitted successfully`);
    
    if (successCount < 5) {
      const failures = results.filter(r => r.status !== 'inserted');
      console.log('\n❌ Failures:');
      for (const f of failures) {
        console.log(`  ${f.pick}: ${JSON.stringify(f.error_details)}`);
      }
    }
    
    // Query the inserted tickets
    if (successCount > 0) {
      const ticketIds = results.filter(r => r.ticket_id).map(r => r.ticket_id);
      console.log('\n=== VERIFICATION ===');
      
      const ticketQuery = await client.query(`
        SELECT id, bet_slip_id, ticket_type, total_stake, status, meta
        FROM tickets
        WHERE id = ANY($1::uuid[])
      `, [ticketIds]);
      
      console.log('\nTickets inserted:');
      for (const t of ticketQuery.rows) {
        console.log(`  ${t.id}: ${t.bet_slip_id} (${t.ticket_type}, ${t.total_stake} units, ${t.status})`);
      }
      
      const legsQuery = await client.query(`
        SELECT tl.id, tl.ticket_id, tl.leg_index, tl.selection, tl.provider, tl.provider_value, tl.effective_value
        FROM ticket_legs tl
        WHERE tl.ticket_id = ANY($1::uuid[])
        ORDER BY tl.ticket_id, tl.leg_index
      `, [ticketIds]);
      
      console.log('\nLegs inserted:', legsQuery.rows.length);
      for (const l of legsQuery.rows) {
        console.log(`  ${l.id} (ticket ${l.ticket_id.slice(0,8)}..): selection=${l.selection}, provider=${l.provider}`);
        console.log(`    provider_value: ${JSON.stringify(l.provider_value)}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
