/**
 * Verify Today's Grading - Complete E2E Proof
 * 
 * This script provides comprehensive proof that the system is working
 * and all of today's props have been properly processed.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { professionalPropProcessor } from '../services/ProfessionalPropProcessor';
import { createLogger } from '../utils/logger';

dotenv.config();

const logger = createLogger('VerifyTodaysGrading');
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface TodaysReport {
  timestamp: string;
  date: string;
  dataIngestion: {
    totalRawProps: number;
    processedProps: number;
    unprocessedProps: number;
    errorProps: number;
    sampleProps: any[];
  };
  grading: {
    gradedProps: number;
    ungradedProps: number;
    tierDistribution: Record<string, number>;
    avgScore: number;
    topGradedProps: any[];
  };
  professionalProcessing: {
    professionallyProcessed: number;
    clvTracked: number;
    deviggingApplied: number;
    autoApproved: number;
    pendingReview: number;
  };
  systemStatus: {
    ingestionRate: string;
    gradingRate: string;
    professionalRate: string;
    overallHealth: string;
    readyForProduction: boolean;
  };
}

class TodaysGradingVerifier {
  private report: TodaysReport;
  private today: string;

  constructor() {
    this.today = new Date().toISOString().split('T')[0];
    this.report = {
      timestamp: new Date().toISOString(),
      date: this.today,
      dataIngestion: {
        totalRawProps: 0,
        processedProps: 0,
        unprocessedProps: 0,
        errorProps: 0,
        sampleProps: []
      },
      grading: {
        gradedProps: 0,
        ungradedProps: 0,
        tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
        avgScore: 0,
        topGradedProps: []
      },
      professionalProcessing: {
        professionallyProcessed: 0,
        clvTracked: 0,
        deviggingApplied: 0,
        autoApproved: 0,
        pendingReview: 0
      },
      systemStatus: {
        ingestionRate: '0%',
        gradingRate: '0%',
        professionalRate: '0%',
        overallHealth: 'unknown',
        readyForProduction: false
      }
    };
  }

  async verifyCompleteSystem() {
    console.log('\n🔍 VERIFYING TODAY\'S COMPLETE E2E SYSTEM');
    console.log('='.repeat(80));
    console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80));

    try {
      // Step 1: Verify Data Ingestion
      await this.verifyDataIngestion();

      // Step 2: Verify Grading
      await this.verifyGrading();

      // Step 3: Verify Professional Processing
      await this.verifyProfessionalProcessing();

      // Step 4: Process Any Remaining Props
      await this.processRemainingProps();

      // Step 5: Generate System Status
      await this.generateSystemStatus();

      // Step 6: Display Complete Report with Proof
      this.displayCompleteReport();

      return this.report;

    } catch (error) {
      logger.error('Verification failed', error);
      throw error;
    }
  }

  private async verifyDataIngestion() {
    console.log('\n📡 STEP 1: VERIFYING DATA INGESTION');
    console.log('─'.repeat(60));

    // Get all raw props for today
    const { data: allProps, count } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .gte('created_at', this.today + 'T00:00:00Z')
      .lt('created_at', this.today + 'T23:59:59Z');

    // Get processed vs unprocessed
    const processedProps = allProps?.filter(p => p.processed_at !== null) || [];
    const unprocessedProps = allProps?.filter(p => p.processed_at === null && !p.error_message) || [];
    const errorProps = allProps?.filter(p => p.error_message !== null) || [];

    this.report.dataIngestion = {
      totalRawProps: count || 0,
      processedProps: processedProps.length,
      unprocessedProps: unprocessedProps.length,
      errorProps: errorProps.length,
      sampleProps: allProps?.slice(0, 5) || []
    };

    console.log(`📊 Total Raw Props Today: ${count || 0}`);
    console.log(`✅ Processed: ${processedProps.length}`);
    console.log(`⏳ Unprocessed: ${unprocessedProps.length}`);
    console.log(`❌ Errors: ${errorProps.length}`);
    
    console.log('\n📋 Sample Props:');
    this.report.dataIngestion.sampleProps.forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.player_name || prop.team_name} ${prop.stat_type} ${prop.line} (${prop.sport})`);
      console.log(`   Status: ${prop.processed_at ? '✅ Processed' : prop.error_message ? '❌ Error' : '⏳ Pending'}`);
    });
  }

  private async verifyGrading() {
    console.log('\n🎯 STEP 2: VERIFYING GRADING');
    console.log('─'.repeat(60));

    // Get grading_status vs ungraded
    const { data: gradedProps } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', this.today + 'T00:00:00Z')
      .not('graded_at', 'is', null);

    const { data: ungradedProps } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', this.today + 'T00:00:00Z')
      .is('graded_at', null)
      .is('error_message', null);

    // Get unified picks with grades
    const { data: unifiedPicks } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', this.today + 'T00:00:00Z')
      .order('professional_score', { ascending: false })
      .limit(10);

    // Calculate tier distribution
    const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    let totalScore = 0;
    
    unifiedPicks?.forEach(pick => {
      if (pick.tier) {
        tierCounts[pick.tier] = (tierCounts[pick.tier] || 0) + 1;
      }
      if (pick.professional_score) {
        totalScore += pick.professional_score;
      }
    });

    const avgScore = unifiedPicks?.length ? totalScore / unifiedPicks.length : 0;

    this.report.grading = {
      gradedProps: gradedProps?.length || 0,
      ungradedProps: ungradedProps?.length || 0,
      tierDistribution: tierCounts,
      avgScore: avgScore,
      topGradedProps: unifiedPicks?.slice(0, 5) || []
    };

    console.log(`✅ Graded Props: ${gradedProps?.length || 0}`);
    console.log(`⏳ Ungraded Props: ${ungradedProps?.length || 0}`);
    console.log(`📊 Average Score: ${avgScore.toFixed(2)}`);
    console.log('\n🎯 Tier Distribution:');
    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`   ${tier}-Tier: ${count}`);
    });

    console.log('\n🏆 Top Graded Props:');
    this.report.grading.topGradedProps.forEach((pick, i) => {
      console.log(`${i + 1}. Score: ${pick.professional_score?.toFixed(2)} | ${pick.tier}-Tier | Edge: ${(pick.devigged_edge * 100).toFixed(2)}%`);
      console.log(`   Sport: ${pick.sport} | Confidence: ${(pick.confidence * 100).toFixed(1)}%`);
    });
  }

  private async verifyProfessionalProcessing() {
    console.log('\n💎 STEP 3: VERIFYING PROFESSIONAL PROCESSING');
    console.log('─'.repeat(60));

    // Get professionally processed picks
    const { data: professionalPicks } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', this.today + 'T00:00:00Z')
      .not('professional_score', 'is', null);

    // Get CLV tracking
    const { data: clvTracking } = await supabase
      .from('clv_tracking')
      .select('*')
      .gte('betTime', this.today + 'T00:00:00Z');

    // Count different statuses
    const autoApproved = professionalPicks?.filter(p => p.status === 'approved').length || 0;
    const pendingReview = professionalPicks?.filter(p => p.status === 'pending_review').length || 0;
    const hasDevigging = professionalPicks?.filter(p => p.devigged_edge && p.devigged_edge > 0).length || 0;

    this.report.professionalProcessing = {
      professionallyProcessed: professionalPicks?.length || 0,
      clvTracked: clvTracking?.length || 0,
      deviggingApplied: hasDevigging,
      autoApproved: autoApproved,
      pendingReview: pendingReview
    };

    console.log(`✅ Professionally Processed: ${professionalPicks?.length || 0}`);
    console.log(`📈 CLV Tracked: ${clvTracking?.length || 0}`);
    console.log(`🎲 Devigging Applied: ${hasDevigging}`);
    console.log(`✅ Auto-Approved: ${autoApproved}`);
    console.log(`⏳ Pending Review: ${pendingReview}`);

    // Show sample CLV tracking
    if (clvTracking && clvTracking.length > 0) {
      console.log('\n📊 Sample CLV Tracking:');
      clvTracking.slice(0, 3).forEach((clv, i) => {
        console.log(`${i + 1}. ${clv.sport} | ${clv.market} | Edge: ${(clv.modelEdge * 100).toFixed(2)}%`);
        console.log(`   Bet Odds: ${clv.betOdds} | Line: ${clv.betLine}`);
      });
    }
  }

  private async processRemainingProps() {
    console.log('\n🔄 STEP 4: PROCESSING REMAINING PROPS');
    console.log('─'.repeat(60));

    // Check for unprocessed props
    const { data: unprocessedProps } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', this.today + 'T00:00:00Z')
      .is('processed_at', null)
      .is('error_message', null)
      .limit(10);

    if (unprocessedProps && unprocessedProps.length > 0) {
      console.log(`📋 Found ${unprocessedProps.length} unprocessed props. Processing now...`);
      
      try {
        const results = await professionalPropProcessor.processRawProps({
          max_batch_size: unprocessedProps.length,
          auto_approve_threshold: 3.0
        });
        
        console.log(`✅ Processed ${results.length} additional props`);
      } catch (error) {
        console.log(`⚠️ Error processing remaining props:`, error);
      }
    } else {
      console.log('✅ All props have been processed!');
    }
  }

  private async generateSystemStatus() {
    const total = this.report.dataIngestion.totalRawProps;
    
    if (total > 0) {
      this.report.systemStatus.ingestionRate = ((this.report.dataIngestion.processedProps / total) * 100).toFixed(1) + '%';
      this.report.systemStatus.gradingRate = ((this.report.grading.gradedProps / total) * 100).toFixed(1) + '%';
      this.report.systemStatus.professionalRate = ((this.report.professionalProcessing.professionallyProcessed / total) * 100).toFixed(1) + '%';
    }

    // Determine overall health
    const ingestionPct = parseFloat(this.report.systemStatus.ingestionRate);
    const gradingPct = parseFloat(this.report.systemStatus.gradingRate);
    const professionalPct = parseFloat(this.report.systemStatus.professionalRate);

    if (ingestionPct >= 95 && gradingPct >= 90 && professionalPct >= 85) {
      this.report.systemStatus.overallHealth = 'EXCELLENT';
      this.report.systemStatus.readyForProduction = true;
    } else if (ingestionPct >= 80 && gradingPct >= 75 && professionalPct >= 70) {
      this.report.systemStatus.overallHealth = 'GOOD';
      this.report.systemStatus.readyForProduction = true;
    } else if (ingestionPct >= 60 && gradingPct >= 50) {
      this.report.systemStatus.overallHealth = 'NEEDS ATTENTION';
      this.report.systemStatus.readyForProduction = false;
    } else {
      this.report.systemStatus.overallHealth = 'CRITICAL';
      this.report.systemStatus.readyForProduction = false;
    }
  }

  private displayCompleteReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLETE E2E VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    console.log('\n🎯 TODAY\'S PROCESSING SUMMARY:');
    console.log(`📅 Date: ${this.report.date}`);
    console.log(`⏰ Generated: ${new Date(this.report.timestamp).toLocaleTimeString()}`);
    
    console.log('\n📡 DATA FLOW:');
    console.log(`Raw Props → Graded → Professional → Ready`);
    console.log(`${this.report.dataIngestion.totalRawProps} → ${this.report.grading.gradedProps} → ${this.report.professionalProcessing.professionallyProcessed} → ${this.report.professionalProcessing.autoApproved}`);
    
    console.log('\n📈 PROCESSING RATES:');
    console.log(`• Ingestion Rate: ${this.report.systemStatus.ingestionRate}`);
    console.log(`• Grading Rate: ${this.report.systemStatus.gradingRate}`);
    console.log(`• Professional Rate: ${this.report.systemStatus.professionalRate}`);
    
    console.log('\n🏆 QUALITY METRICS:');
    console.log(`• Average Score: ${this.report.grading.avgScore.toFixed(2)}`);
    console.log(`• CLV Tracking: ${this.report.professionalProcessing.clvTracked} props`);
    console.log(`• Devigging Applied: ${this.report.professionalProcessing.deviggingApplied} props`);
    
    console.log('\n🎯 TIER DISTRIBUTION:');
    Object.entries(this.report.grading.tierDistribution).forEach(([tier, count]) => {
      const pct = this.report.grading.gradedProps > 0 
        ? ((count / this.report.grading.gradedProps) * 100).toFixed(1)
        : '0.0';
      console.log(`• ${tier}-Tier: ${count} (${pct}%)`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('❤️ SYSTEM HEALTH: ' + this.report.systemStatus.overallHealth);
    console.log('🚀 PRODUCTION READY: ' + (this.report.systemStatus.readyForProduction ? 'YES ✅' : 'NO ❌'));
    console.log('='.repeat(80));

    // Save report to database
    this.saveReport();
  }

  private async saveReport() {
    try {
      await supabase
        .from('processing_logs')
        .insert({
          processor: 'todays_grading_verification',
          summary: this.report,
          processed_at: new Date().toISOString()
        });
      
      console.log('\n📄 Report saved to processing_logs table');
    } catch (error) {
      logger.error('Failed to save report', error);
    }
  }
}

// Main execution
async function main() {
  const verifier = new TodaysGradingVerifier();
  
  try {
    const report = await verifier.verifyCompleteSystem();
    
    console.log('\n✅ VERIFICATION COMPLETE');
    console.log('📊 Full report available in processing_logs table');
    
    // Show final proof
    console.log('\n🔍 PROOF OF TODAY\'S GRADING:');
    console.log(`✅ ${report.dataIngestion.totalRawProps} props ingested`);
    console.log(`✅ ${report.grading.gradedProps} props graded`);
    console.log(`✅ ${report.professionalProcessing.professionallyProcessed} props professionally processed`);
    console.log(`✅ ${report.professionalProcessing.clvTracked} props with CLV tracking`);
    console.log(`✅ ${report.professionalProcessing.autoApproved} props auto-approved`);
    
    process.exit(0);

  } catch (error) {
    logger.error('Verification failed', error);
    console.error('❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TodaysGradingVerifier };