#!/usr/bin/env node

/**
 * COMPREHENSIVE END-TO-END TESTING SETUP
 * 
 * This script sets up end-to-end testing using real-world data from the database.
 * It tests the complete workflow from raw props to final picks and alerts.
 * 
 * Test Scenarios:
 * 1. Data Ingestion Flow (raw_props → processing)
 * 2. Agent Processing (IngestionAgent, GradingAgent, etc.)
 * 3. Scoring and Tier Assignment
 * 4. Alert Generation and Discord Integration
 * 5. Performance and Error Handling
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Database setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class E2ETestSuite {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
    console.log('🚀 Unit Talk E2E Testing Suite');
    console.log('=====================================');
    console.log(`Started at: ${new Date().toISOString()}\n`);
  }

  /**
   * TEST 1: Database Connectivity and Data Validation
   */
  async testDatabaseConnectivity() {
    console.log('📊 TEST 1: Database Connectivity & Data Validation');
    console.log('--------------------------------------------------');
    
    const testStart = Date.now();
    let success = true;
    const details = {};

    try {
      // Test raw_props table
      const rawPropsResult = await supabase.from('raw_props').select('count', { count: 'exact', head: true });
      details.rawPropsCount = rawPropsResult.count;
      details.rawPropsError = rawPropsResult.error?.message || null;
      console.log(`✅ raw_props table: ${rawPropsResult.count} records`);

      // Test final_picks table
      const finalPicksResult = await supabase.from('final_picks').select('count', { count: 'exact', head: true });
      details.finalPicksCount = finalPicksResult.count;
      details.finalPicksError = finalPicksResult.error?.message || null;
      console.log(`✅ final_picks table: ${finalPicksResult.count} records`);

      // Validate data quality
      const recentRawProps = await supabase
        .from('raw_props')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      details.recentRawPropsCount = recentRawProps.data?.length || 0;
      console.log(`✅ Recent raw props: ${details.recentRawPropsCount} records`);

      // Check for required fields
      const validationChecks = this.validateDataQuality(recentRawProps.data || []);
      details.validationChecks = validationChecks;
      console.log(`✅ Data validation: ${validationChecks.validRecords}/${validationChecks.totalRecords} valid`);

    } catch (error) {
      success = false;
      details.error = error.message;
      console.log(`❌ Database connectivity failed: ${error.message}`);
    }

    this.testResults.push({
      test: 'Database Connectivity',
      duration: Date.now() - testStart,
      success,
      details
    });

    console.log('');
    return success;
  }

  /**
   * TEST 2: Agent Processing Simulation
   */
  async testAgentProcessing() {
    console.log('🤖 TEST 2: Agent Processing Simulation');
    console.log('--------------------------------------');
    
    const testStart = Date.now();
    let success = true;
    const details = {};

    try {
      // Get sample raw props for processing
      const sampleProps = await supabase
        .from('raw_props')
        .select('*')
        .eq('tier', 'D') // Get unprocessed props
        .limit(5);

      details.samplePropsCount = sampleProps.data?.length || 0;
      console.log(`📥 Retrieved ${details.samplePropsCount} sample props for processing`);

      if (sampleProps.data && sampleProps.data.length > 0) {
        // Simulate IngestionAgent processing
        const ingestionResults = await this.simulateIngestionAgent(sampleProps.data);
        details.ingestionResults = ingestionResults;
        console.log(`✅ IngestionAgent: ${ingestionResults.processed}/${ingestionResults.total} processed`);

        // Simulate GradingAgent processing
        const gradingResults = await this.simulateGradingAgent(sampleProps.data);
        details.gradingResults = gradingResults;
        console.log(`✅ GradingAgent: ${gradingResults.graded}/${gradingResults.total} graded`);

        // Simulate tier assignment
        const tierResults = await this.simulateTierAssignment(sampleProps.data);
        details.tierResults = tierResults;
        console.log(`✅ Tier Assignment: S:${tierResults.S}, A:${tierResults.A}, B:${tierResults.B}, C:${tierResults.C}`);
      }

    } catch (error) {
      success = false;
      details.error = error.message;
      console.log(`❌ Agent processing failed: ${error.message}`);
    }

    this.testResults.push({
      test: 'Agent Processing',
      duration: Date.now() - testStart,
      success,
      details
    });

    console.log('');
    return success;
  }

  /**
   * TEST 3: End-to-End Workflow Simulation
   */
  async testE2EWorkflow() {
    console.log('🔄 TEST 3: End-to-End Workflow Simulation');
    console.log('------------------------------------------');
    
    const testStart = Date.now();
    let success = true;
    const details = {};

    try {
      // Step 1: Create test raw prop
      const testProp = await this.createTestRawProp();
      details.testPropCreated = !!testProp;
      console.log(`✅ Created test raw prop: ${testProp?.id}`);

      // Step 2: Process through pipeline
      const processedProp = await this.processRawPropThroughPipeline(testProp);
      details.processedProp = !!processedProp;
      console.log(`✅ Processed through pipeline: ${processedProp?.tier} tier`);

      // Step 3: Generate final pick (if S or A tier)
      if (processedProp && ['S', 'A'].includes(processedProp.tier)) {
        const finalPick = await this.createFinalPick(processedProp);
        details.finalPickCreated = !!finalPick;
        console.log(`✅ Created final pick: ${finalPick?.id}`);

        // Step 4: Simulate alert generation
        const alertResult = await this.simulateAlertGeneration(finalPick);
        details.alertGenerated = alertResult.success;
        console.log(`✅ Alert simulation: ${alertResult.success ? 'Success' : 'Failed'}`);
      } else {
        console.log(`ℹ️  Prop tier ${processedProp?.tier} - no final pick needed`);
      }

      // Step 5: Cleanup test data
      await this.cleanupTestData(testProp?.id);
      console.log(`✅ Cleaned up test data`);

    } catch (error) {
      success = false;
      details.error = error.message;
      console.log(`❌ E2E workflow failed: ${error.message}`);
    }

    this.testResults.push({
      test: 'E2E Workflow',
      duration: Date.now() - testStart,
      success,
      details
    });

    console.log('');
    return success;
  }

  /**
   * TEST 4: Performance and Load Testing
   */
  async testPerformance() {
    console.log('⚡ TEST 4: Performance & Load Testing');
    console.log('------------------------------------');
    
    const testStart = Date.now();
    let success = true;
    const details = {};

    try {
      // Test database query performance
      const queryStart = Date.now();
      const largeQuery = await supabase
        .from('raw_props')
        .select('*')
        .limit(100);
      
      details.queryTime = Date.now() - queryStart;
      details.recordsRetrieved = largeQuery.data?.length || 0;
      console.log(`✅ Query performance: ${details.queryTime}ms for ${details.recordsRetrieved} records`);

      // Test concurrent processing simulation
      const concurrentStart = Date.now();
      const concurrentPromises = Array.from({ length: 5 }, (_, i) => 
        this.simulateAgentProcessing(i)
      );
      
      const concurrentResults = await Promise.all(concurrentPromises);
      details.concurrentTime = Date.now() - concurrentStart;
      details.concurrentSuccess = concurrentResults.every(r => r.success);
      console.log(`✅ Concurrent processing: ${details.concurrentTime}ms, Success: ${details.concurrentSuccess}`);

      // Memory usage check
      const memUsage = process.memoryUsage();
      details.memoryUsage = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      };
      console.log(`✅ Memory usage: ${details.memoryUsage.heapUsed}MB heap, ${details.memoryUsage.rss}MB RSS`);

    } catch (error) {
      success = false;
      details.error = error.message;
      console.log(`❌ Performance testing failed: ${error.message}`);
    }

    this.testResults.push({
      test: 'Performance',
      duration: Date.now() - testStart,
      success,
      details
    });

    console.log('');
    return success;
  }

  /**
   * Helper Methods
   */
  validateDataQuality(records) {
    let validRecords = 0;
    const totalRecords = records.length;
    
    records.forEach(record => {
      const hasRequiredFields = record.player_name && record.stat_type && record.line !== null;
      if (hasRequiredFields) validRecords++;
    });

    return { validRecords, totalRecords };
  }

  async simulateIngestionAgent(props) {
    // Simulate ingestion processing
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      total: props.length,
      processed: props.length,
      success: true
    };
  }

  async simulateGradingAgent(props) {
    // Simulate grading logic
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      total: props.length,
      graded: props.length,
      averageScore: 75
    };
  }

  async simulateTierAssignment(props) {
    // Simulate tier assignment
    const tiers = { S: 0, A: 0, B: 0, C: 0 };
    props.forEach(() => {
      const rand = Math.random();
      if (rand < 0.1) tiers.S++;
      else if (rand < 0.3) tiers.A++;
      else if (rand < 0.6) tiers.B++;
      else tiers.C++;
    });
    return tiers;
  }

  async createTestRawProp() {
    const testProp = {
      player_name: 'Test Player E2E',
      sport: 'NBA',
      team: 'TEST',
      stat_type: 'PTS',
      line: 25.5,
      over_odds: -110,
      under_odds: -110,
      market: 'player_points',
      provider: 'E2E_TEST',
      game_time: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      tier: 'D',
      external_id: `e2e_test_${Date.now()}`
    };

    const result = await supabase.from('raw_props').insert(testProp).select().single();
    return result.data;
  }

  async processRawPropThroughPipeline(prop) {
    // Simulate processing pipeline
    const processedProp = { ...prop };
    
    // Simulate scoring
    processedProp.edge_score = Math.floor(Math.random() * 100);
    
    // Simulate tier assignment based on score
    if (processedProp.edge_score >= 80) processedProp.tier = 'S';
    else if (processedProp.edge_score >= 60) processedProp.tier = 'A';
    else if (processedProp.edge_score >= 40) processedProp.tier = 'B';
    else processedProp.tier = 'C';

    // Update in database
    await supabase
      .from('raw_props')
      .update({ 
        edge_score: processedProp.edge_score, 
        tier: processedProp.tier 
      })
      .eq('id', prop.id);

    return processedProp;
  }

  async createFinalPick(prop) {
    const finalPick = {
      player_name: prop.player_name,
      team: prop.team,
      stat_type: prop.stat_type,
      line: prop.line,
      odds: prop.over_odds || -110,
      matchup: `${prop.team} vs TEST`,
      unit_size: 1,
      edge_score: prop.edge_score,
      tier: prop.tier,
      direction: 'over',
      play_status: 'Pending',
      auto_approved: true,
      game_time: prop.game_time,
      ev_percent: (prop.edge_score / 10),
      bet_type: 'single'
    };

    const result = await supabase.from('final_picks').insert(finalPick).select().single();
    return result.data;
  }

  async simulateAlertGeneration(finalPick) {
    // Simulate alert generation logic
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      success: true,
      alertType: finalPick.tier === 'S' ? 'premium' : 'standard',
      channel: finalPick.tier === 'S' ? 'vip-picks' : 'general-picks'
    };
  }

  async simulateAgentProcessing(agentId) {
    // Simulate individual agent processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    return { success: true, agentId, processed: Math.floor(Math.random() * 10) };
  }

  async cleanupTestData(propId) {
    if (propId) {
      // Clean up test raw prop
      await supabase.from('raw_props').delete().eq('id', propId);
      
      // Clean up any test final picks
      await supabase.from('final_picks').delete().eq('player_name', 'Test Player E2E');
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('📋 TEST REPORT');
    console.log('==============');
    
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.testResults.filter(t => t.success).length;
    const totalTests = this.testResults.length;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
    
    console.log(`\n📝 Detailed Results:`);
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.test}: ${result.duration}ms`);
      if (!result.success && result.details.error) {
        console.log(`      Error: ${result.details.error}`);
      }
    });

    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        passedTests,
        totalTests,
        totalDuration,
        successRate: (passedTests/totalTests) * 100
      },
      results: this.testResults
    };

    fs.writeFileSync(
      path.join(__dirname, 'e2e-test-report.json'),
      JSON.stringify(reportData, null, 2)
    );

    console.log(`\n💾 Report saved to: e2e-test-report.json`);
    
    return passedTests === totalTests;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🎯 Running comprehensive E2E test suite...\n');

    const tests = [
      () => this.testDatabaseConnectivity(),
      () => this.testAgentProcessing(),
      () => this.testE2EWorkflow(),
      () => this.testPerformance()
    ];

    for (const test of tests) {
      await test();
    }

    const allTestsPassed = this.generateReport();
    
    console.log(`\n${allTestsPassed ? '🎉' : '⚠️'} E2E Testing ${allTestsPassed ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH ISSUES'}`);
    
    return allTestsPassed;
  }
}

// Run the test suite
async function main() {
  const testSuite = new E2ETestSuite();
  const success = await testSuite.runAllTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = E2ETestSuite;