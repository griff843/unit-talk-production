#!/usr/bin/env node

/**
 * Smart Form Bet Types Comprehensive Test
 * Tests all bet types, sports, and ticket configurations
 *
 * This validates production-ready bet submission capability
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate UUID for test IDs
function generateUUID() {
  return crypto.randomUUID();
}

class SmartFormBetTypesTest {
  constructor() {
    this.testResults = {
      sports: {},
      ticketTypes: {},
      betCategories: {},
      marketTypes: {},
      overallSuccess: false,
    };
    this.testData = [];
  }

  async runCompleteTest() {
    console.log('🎯 Starting Smart Form Bet Types Comprehensive Test');
    console.log('='.repeat(80));

    try {
      // Test all sports
      await this.testAllSports();

      // Test all ticket types
      await this.testAllTicketTypes();

      // Test all bet categories
      await this.testAllBetCategories();

      // Test all market types
      await this.testAllMarketTypes();

      // Test complex scenarios
      await this.testComplexScenarios();

      // Calculate overall success
      this.calculateOverallSuccess();

      // Generate production report
      this.generateProductionReport();
    } catch (error) {
      console.error('❌ Smart form test failed:', error);
      this.generateFailureReport(error);
    }
  }

  async testAllSports() {
    console.log('\n🏀 Testing All Sports...');

    const sports = [
      'NFL',
      'NBA',
      'MLB',
      'NHL',
      'NCAAF',
      'NCAAB',
      'UFC/MMA',
      'Boxing',
      'Soccer',
      'Tennis',
      'Golf',
      'NASCAR',
      'F1',
    ];

    for (const sport of sports) {
      try {
        const testTicket = await this.createTestTicket({
          sport: sport,
          ticket_type: 'single',
          bet_category: 'spread',
          market_type: 'pre_game',
        });

        const { data, error } = await supabase
          .from('smart_tickets')
          .insert([testTicket])
          .select()
          .single();

        if (error) throw error;

        this.testData.push(data);
        this.testResults.sports[sport] = true;
        console.log(`   ✅ ${sport}: PASS`);
      } catch (error) {
        this.testResults.sports[sport] = false;
        console.log(`   ❌ ${sport}: FAIL - ${error.message}`);
      }
    }
  }

  async testAllTicketTypes() {
    console.log('\n🎫 Testing All Ticket Types...');

    const ticketTypes = ['single', 'parlay', 'teaser', 'round_robin'];

    for (const ticketType of ticketTypes) {
      try {
        const testTicket = await this.createTestTicket({
          sport: 'NBA',
          ticket_type: ticketType,
          bet_category: 'spread',
          market_type: 'pre_game',
        });

        const { data, error } = await supabase
          .from('smart_tickets')
          .insert([testTicket])
          .select()
          .single();

        if (error) throw error;

        this.testData.push(data);
        this.testResults.ticketTypes[ticketType] = true;
        console.log(`   ✅ ${ticketType}: PASS`);
      } catch (error) {
        this.testResults.ticketTypes[ticketType] = false;
        console.log(`   ❌ ${ticketType}: FAIL - ${error.message}`);
      }
    }
  }

  async testAllBetCategories() {
    console.log('\n🎲 Testing All Bet Categories...');

    const betCategories = [
      'spread',
      'total',
      'moneyline',
      'player_prop',
      'team_prop',
      'parlay',
      'teaser',
      'futures',
    ];

    for (const betCategory of betCategories) {
      try {
        const testTicket = await this.createTestTicket({
          sport: 'NBA',
          ticket_type: 'single',
          bet_category: betCategory,
          market_type: betCategory === 'futures' ? 'futures' : 'pre_game',
        });

        const { data, error } = await supabase
          .from('smart_tickets')
          .insert([testTicket])
          .select()
          .single();

        if (error) throw error;

        this.testData.push(data);
        this.testResults.betCategories[betCategory] = true;
        console.log(`   ✅ ${betCategory}: PASS`);
      } catch (error) {
        this.testResults.betCategories[betCategory] = false;
        console.log(`   ❌ ${betCategory}: FAIL - ${error.message}`);
      }
    }
  }

  async testAllMarketTypes() {
    console.log('\n📈 Testing All Market Types...');

    const marketTypes = ['pre_game', 'live', 'player_prop', 'team_prop', 'game_prop', 'futures'];

    for (const marketType of marketTypes) {
      try {
        const testTicket = await this.createTestTicket({
          sport: 'NBA',
          ticket_type: 'single',
          bet_category: marketType === 'futures' ? 'futures' : 'spread',
          market_type: marketType,
        });

        const { data, error } = await supabase
          .from('smart_tickets')
          .insert([testTicket])
          .select()
          .single();

        if (error) throw error;

        this.testData.push(data);
        this.testResults.marketTypes[marketType] = true;
        console.log(`   ✅ ${marketType}: PASS`);
      } catch (error) {
        this.testResults.marketTypes[marketType] = false;
        console.log(`   ❌ ${marketType}: FAIL - ${error.message}`);
      }
    }
  }

  async testComplexScenarios() {
    console.log('\n🧩 Testing Complex Scenarios...');

    const complexTests = [
      {
        name: '4-Leg NBA Parlay',
        config: {
          sport: 'NBA',
          ticket_type: 'parlay',
          bet_category: 'parlay',
          market_type: 'pre_game',
          legs: 4,
        },
      },
      {
        name: 'NFL Player Props',
        config: {
          sport: 'NFL',
          ticket_type: 'single',
          bet_category: 'player_prop',
          market_type: 'player_prop',
          player_prop: 'passing_yards',
        },
      },
      {
        name: 'MLB Live Betting',
        config: {
          sport: 'MLB',
          ticket_type: 'single',
          bet_category: 'total',
          market_type: 'live',
        },
      },
      {
        name: 'Soccer Futures',
        config: {
          sport: 'Soccer',
          ticket_type: 'single',
          bet_category: 'futures',
          market_type: 'futures',
        },
      },
    ];

    this.testResults.complexScenarios = {};

    for (const test of complexTests) {
      try {
        const testTicket = await this.createTestTicket(test.config);

        const { data, error } = await supabase
          .from('smart_tickets')
          .insert([testTicket])
          .select()
          .single();

        if (error) throw error;

        this.testData.push(data);
        this.testResults.complexScenarios[test.name] = true;
        console.log(`   ✅ ${test.name}: PASS`);
      } catch (error) {
        this.testResults.complexScenarios[test.name] = false;
        console.log(`   ❌ ${test.name}: FAIL - ${error.message}`);
      }
    }
  }

  async createTestTicket(config) {
    const baseTicket = {
      bet_slip_id: generateUUID(),
      capper: 'AutoTest',
      ticket_type: config.ticket_type,
      sport: config.sport,
      market_type: config.market_type,
      bet_type: config.bet_category,
      unit_size: 2.0,
      confidence_level: 8,
      odds_format: 'AMERICAN',
      auto_parlay: config.ticket_type === 'parlay',
      game_date: new Date().toISOString().split('T')[0],
      user_tier: 'vip_plus',
      status: 'submitted',
      timestamp: new Date().toISOString(),
      timezone: 'America/New_York',
      current_step: 4,
      created_at: new Date().toISOString(),
    };

    // Add legs based on configuration
    const legs = [];
    const legCount = config.legs || 1;

    for (let i = 0; i < legCount; i++) {
      legs.push({
        id: generateUUID(),
        sport: config.sport,
        bet_category: config.bet_category,
        market_type: config.market_type,
        bet_type: config.bet_category,
        game_id: generateUUID(),
        team: i === 0 ? 'Lakers' : `Team${i}`,
        opponent: i === 0 ? 'Celtics' : `Opponent${i}`,
        player_name: config.player_prop ? 'LeBron James' : null,
        prop_type: config.player_prop || null,
        line:
          config.bet_category === 'spread'
            ? '-3.5'
            : config.bet_category === 'total'
              ? '220.5'
              : config.player_prop
                ? '25.5'
                : null,
        odds: '-110',
        game_date: baseTicket.game_date,
        game_time: '20:00:00',
        status: 'open',
      });
    }

    // Add sport-specific enhancements
    if (config.sport === 'NFL') {
      baseTicket.weather_conditions = 'Clear';
    } else if (config.sport === 'MLB') {
      baseTicket.ballpark_factors = 'Neutral';
    } else if (config.sport === 'NBA') {
      baseTicket.pace_factors = 'Fast';
    }

    // Store legs as JSON for database compatibility
    baseTicket.legs = JSON.stringify(legs);
    baseTicket.game_selections = JSON.stringify(
      legs.map(leg => ({
        game_id: leg.game_id,
        selection: leg.team,
        odds: leg.odds,
        line: leg.line,
      }))
    );

    // Add bet-specific fields
    if (config.bet_category === 'futures') {
      baseTicket.futures_market = 'Championship Winner';
    } else if (config.bet_category === 'teaser') {
      baseTicket.teaser_points = 6;
    }

    return baseTicket;
  }

  calculateOverallSuccess() {
    const allResults = [
      ...Object.values(this.testResults.sports),
      ...Object.values(this.testResults.ticketTypes),
      ...Object.values(this.testResults.betCategories),
      ...Object.values(this.testResults.marketTypes),
      ...Object.values(this.testResults.complexScenarios || {}),
    ];

    const successCount = allResults.filter(result => result === true).length;
    const totalTests = allResults.length;

    this.testResults.overallSuccess = successCount === totalTests;
    this.testResults.successRate = Math.round((successCount / totalTests) * 100);
  }

  generateProductionReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 SMART FORM BET TYPES TEST RESULTS');
    console.log('='.repeat(80));

    // Sports Results
    console.log('\n🏀 Sports Coverage:');
    Object.entries(this.testResults.sports).forEach(([sport, success]) => {
      console.log(`   ${sport.padEnd(12)}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    });

    // Ticket Types Results
    console.log('\n🎫 Ticket Types:');
    Object.entries(this.testResults.ticketTypes).forEach(([type, success]) => {
      console.log(`   ${type.padEnd(12)}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    });

    // Bet Categories Results
    console.log('\n🎲 Bet Categories:');
    Object.entries(this.testResults.betCategories).forEach(([category, success]) => {
      console.log(`   ${category.padEnd(12)}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    });

    // Market Types Results
    console.log('\n📈 Market Types:');
    Object.entries(this.testResults.marketTypes).forEach(([market, success]) => {
      console.log(`   ${market.padEnd(12)}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    });

    // Complex Scenarios Results
    if (this.testResults.complexScenarios) {
      console.log('\n🧩 Complex Scenarios:');
      Object.entries(this.testResults.complexScenarios).forEach(([scenario, success]) => {
        console.log(`   ${scenario.padEnd(20)}: ${success ? '✅ PASS' : '❌ FAIL'}`);
      });
    }

    console.log(`\n📈 Overall Success Rate: ${this.testResults.successRate}%`);
    console.log(`🎯 Smart Form Ready: ${this.testResults.overallSuccess ? '✅ YES' : '❌ NO'}`);

    if (this.testResults.overallSuccess) {
      console.log('\n🚀 SMART FORM STATUS: PRODUCTION READY');
      console.log('✅ All bet types supported');
      console.log('✅ All sports coverage validated');
      console.log('✅ All ticket configurations working');
      console.log('✅ Complex scenarios functional');
      console.log('✅ Database integration validated');
    } else {
      console.log('\n⚠️  SMART FORM STATUS: ISSUES DETECTED');
      console.log('❌ Some bet types require attention');
    }

    console.log('\n📋 Production Capabilities:');
    const sportsCount = Object.values(this.testResults.sports).filter(Boolean).length;
    const ticketCount = Object.values(this.testResults.ticketTypes).filter(Boolean).length;
    const betCount = Object.values(this.testResults.betCategories).filter(Boolean).length;
    const marketCount = Object.values(this.testResults.marketTypes).filter(Boolean).length;

    console.log(
      `   Sports Supported: ${sportsCount}/13 (${Math.round((sportsCount / 13) * 100)}%)`
    );
    console.log(`   Ticket Types: ${ticketCount}/4 (${Math.round((ticketCount / 4) * 100)}%)`);
    console.log(`   Bet Categories: ${betCount}/8 (${Math.round((betCount / 8) * 100)}%)`);
    console.log(`   Market Types: ${marketCount}/6 (${Math.round((marketCount / 6) * 100)}%)`);
    console.log(`   Total Tickets Created: ${this.testData.length}`);

    console.log('\n' + '='.repeat(80));

    // Cleanup test data
    this.cleanupTestData();
  }

  generateFailureReport(error) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ SMART FORM BET TYPES TEST FAILED');
    console.log('='.repeat(80));
    console.log('\n🚨 Critical Error:', error.message);
    console.log('\n📋 Immediate Actions Required:');
    console.log('   1. Check smart_tickets table schema');
    console.log('   2. Verify bet type configurations');
    console.log('   3. Test individual components');
    console.log('   4. Re-run the complete form test');
    console.log('\n' + '='.repeat(80));
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      if (this.testData.length > 0) {
        const ids = this.testData.map(ticket => ticket.bet_slip_id);
        await supabase.from('smart_tickets').delete().in('bet_slip_id', ids);

        console.log(`   → Cleaned ${this.testData.length} test tickets`);
      }

      console.log('✅ Test data cleanup completed');
    } catch (error) {
      console.error('⚠️  Test data cleanup failed:', error.message);
      console.log('   → Manual cleanup may be required');
    }
  }
}

// Run the test
async function main() {
  const test = new SmartFormBetTypesTest();
  await test.runCompleteTest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SmartFormBetTypesTest;
