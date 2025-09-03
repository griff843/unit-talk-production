/**
 * Professional Props Processing Runner
 * 
 * Replaces the basic gradeProps.ts with full professional system integration.
 * Ensures ALL props receive complete professional treatment.
 * 
 * Usage: npx tsx src/runner/processProfessionalProps.ts
 */

import { professionalPropProcessor } from '../services/ProfessionalPropProcessor';
import { professionalBettingScheduler } from '../services/schedulers/ProfessionalBettingScheduler';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProcessProfessionalProps');

async function main() {
  logger.info('🚀 Starting Professional Props Processing');
  console.log('\n' + '='.repeat(60));
  console.log('🏆 PROFESSIONAL PROPS PROCESSING');
  console.log('='.repeat(60) + '\n');

  try {
    const startTime = Date.now();

    // 1. Process raw props through professional system
    console.log('📊 Processing raw props through professional system...');
    const results = await professionalPropProcessor.processRawProps({
      max_batch_size: 100,
      auto_approve_threshold: 3.0, // S/A tier auto-approved
      require_admin_review: ['B', 'C', 'D'],
      timeout_ms: 30000
    });

    const processingTime = Date.now() - startTime;

    // 2. Display results
    if (results.length === 0) {
      console.log('✅ No props to process - system is up to date');
      return;
    }

    console.log('\n📈 PROCESSING RESULTS:');
    console.log('='.repeat(40));
    console.log(`Total Processed: ${results.length}`);
    console.log(`Auto-Approved: ${results.filter(r => r.published).length}`);
    console.log(`Manual Review: ${results.filter(r => !r.published).length}`);
    console.log(`Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
    console.log(`Avg Time/Prop: ${(processingTime / results.length).toFixed(0)}ms`);

    // 3. Tier distribution
    console.log('\n🎯 TIER DISTRIBUTION:');
    const tiers = ['S', 'A', 'B', 'C', 'D'] as const;
    tiers.forEach(tier => {
      const count = results.filter(r => r.tier === tier).length;
      const percentage = ((count / results.length) * 100).toFixed(1);
      const icon = tier === 'S' ? '🌟' : tier === 'A' ? '⭐' : tier === 'B' ? '🔸' : tier === 'C' ? '🔹' : '◽';
      console.log(`${icon} ${tier}-Tier: ${count} (${percentage}%)`);
    });

    // 4. Performance insights
    console.log('\n📊 PERFORMANCE INSIGHTS:');
    const avgScore = (results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length).toFixed(2);
    const avgConfidence = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1);
    const avgEdge = (results.reduce((sum, r) => sum + r.devigged_edge, 0) / results.length).toFixed(2);
    const avgKelly = (results.reduce((sum, r) => sum + r.kelly_fraction, 0) / results.length * 100).toFixed(2);

    console.log(`Avg Professional Score: ${avgScore}`);
    console.log(`Avg Confidence: ${avgConfidence}%`);
    console.log(`Avg Devigged Edge: ${avgEdge}%`);
    console.log(`Avg Kelly Fraction: ${avgKelly}%`);

    // 5. Professional insights summary
    console.log('\n🔍 PROFESSIONAL INSIGHTS:');
    const steamMoves = results.filter(r => r.professional_insights?.steamMoveDetected).length;
    const publicFades = results.filter(r => 
      r.professional_insights?.publicBettingPercentage > 70 && 
      r.professional_insights?.sharpBettingPercentage < 30
    ).length;

    console.log(`Steam Moves Detected: ${steamMoves}`);
    console.log(`Public Fade Opportunities: ${publicFades}`);
    console.log(`CLV Tracking Active: ${results.length} picks`);

    // 6. Show top picks requiring review
    const reviewPicks = results.filter(r => !r.published);
    if (reviewPicks.length > 0) {
      console.log('\n⚠️  PICKS REQUIRING ADMIN REVIEW:');
      reviewPicks.slice(0, 5).forEach(pick => {
        console.log(`• ${pick.tier}-Tier (Score: ${pick.professionalScore.toFixed(2)}) - ID: ${pick.pickId.slice(0, 8)}`);
      });
      if (reviewPicks.length > 5) {
        console.log(`  ... and ${reviewPicks.length - 5} more`);
      }
    }

    // 7. Trigger professional monitoring
    console.log('\n🔄 Starting professional monitoring systems...');
    
    // Start professional betting scheduler if not already running
    const schedulerStatus = professionalBettingScheduler.getStatus();
    if (!schedulerStatus.isRunning) {
      professionalBettingScheduler.start();
      console.log('✅ Professional betting scheduler started');
    } else {
      console.log('✅ Professional betting scheduler already running');
    }

    // Trigger immediate CLV monitoring
    await professionalBettingScheduler.triggerTask('clv_monitoring');
    console.log('✅ CLV monitoring triggered');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 PROFESSIONAL PROCESSING COMPLETE!');
    console.log('🏆 All props now have professional grading');
    console.log('📈 CLV tracking active for performance monitoring');
    console.log('🔄 Automated optimization systems running');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    logger.error('Professional props processing failed', error);
    console.error('❌ PROCESSING FAILED:', error);
    
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check database connectivity');
    console.log('2. Verify professional services are running');
    console.log('3. Check raw_props table for unprocessed items');
    console.log('4. Review error logs for specific issues');
    
    process.exit(1);
  }
}

// Additional utility functions
async function showProcessingStats() {
  console.log('\n📊 PROCESSING STATISTICS:');
  try {
    const stats = await professionalPropProcessor.getProcessingStats();
    console.log(`Recent Runs: ${stats.recent_runs?.length || 0}`);
    console.log(`Avg Processing Time: ${stats.avg_processing_time?.toFixed(0) || 0}ms`);
    console.log(`Total Processed: ${stats.total_processed || 0}`);
  } catch (error) {
    console.log('Statistics unavailable');
  }
}

async function checkSystemHealth() {
  console.log('\n❤️  SYSTEM HEALTH CHECK:');
  try {
    // Check if professional services are responding
    const schedulerStatus = professionalBettingScheduler.getStatus();
    console.log(`Professional Scheduler: ${schedulerStatus.isRunning ? '✅ Running' : '❌ Stopped'}`);
    console.log(`Scheduled Tasks: ${schedulerStatus.scheduledTasks.length}`);
    
    return true;
  } catch (error) {
    console.log('❌ System health check failed');
    return false;
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--stats')) {
  showProcessingStats().then(() => process.exit(0));
} else if (args.includes('--health')) {
  checkSystemHealth().then((healthy) => process.exit(healthy ? 0 : 1));
} else if (args.includes('--help')) {
  console.log(`
Professional Props Processing Runner

Usage: npx tsx src/runner/processProfessionalProps.ts [options]

Options:
  --stats     Show processing statistics
  --health    Check system health
  --help      Show this help message

Examples:
  npx tsx src/runner/processProfessionalProps.ts           # Process props
  npx tsx src/runner/processProfessionalProps.ts --stats   # Show stats
  npx tsx src/runner/processProfessionalProps.ts --health  # Health check

This runner ensures ALL props receive professional treatment:
• Devigging to remove hidden vig
• CLV tracking for performance monitoring  
• Professional grading with 45+ factors
• Risk assessment and Kelly sizing
• Automated approval for high-tier picks
`);
  process.exit(0);
} else {
  // Run main processing
  main().catch(error => {
    console.error('Runner failed:', error);
    process.exit(1);
  });
}

export { main as processProfessionalProps };