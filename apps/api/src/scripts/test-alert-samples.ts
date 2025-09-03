#!/usr/bin/env node

import { DiscordAlertRouter, AlertData, AlertType } from '../services/DiscordAlertRouter';
import { logger } from '../shared/logger';

/**
 * Test script to generate sample alerts for all alert types
 * Run this to verify the Discord routing and formatting works properly
 */
class AlertSampleGenerator {
  
  async generateAllSamples(): Promise<void> {
    logger.info('🚀 Starting sample alert generation for testing...');
    
    const samples = this.createSampleAlerts();
    
    for (const [alertType, alertData] of samples) {
      try {
        logger.info(`📢 Sending sample ${alertType} alert...`);
        await DiscordAlertRouter.routeAlert(alertType, alertData);
        
        // Wait 3 seconds between alerts to avoid rate limiting
        await this.sleep(3000);
        
      } catch (error) {
        logger.error(`❌ Failed to send ${alertType} sample`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
    
    logger.info('✅ Sample alert generation completed!');
  }
  
  private createSampleAlerts(): Array<[AlertType, AlertData]> {
    return [
      // Hedge Opportunity Alert
      ['hedge_opportunity', {
        pickId: 'sample-hedge-001',
        capper: 'Griff843',
        sport: 'NBA',
        selection: 'Lakers -3.5',
        odds: '-110',
        units: 3,
        confidence: 85,
        systemGrade: 'A-tier',
        hedgeDetails: 'DraftKings: Lakers -3.5 (-110) | FanDuel: Celtics +4 (-105)',
        expectedProfit: '2.3% guaranteed profit with proper sizing',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'hedge_opportunity',
          testRun: true
        }
      }],
      
      // Middle Opportunity Alert  
      ['middle_opportunity', {
        pickId: 'sample-middle-002',
        capper: 'KingRo623',
        sport: 'NFL',
        selection: 'Chiefs -7',
        odds: '-115',
        units: 2,
        confidence: 78,
        systemGrade: 'A-tier',
        middleSetup: 'Chiefs -7 (-115) + Dolphins +7.5 (-110)',
        potentialWin: 'Win both if final margin is exactly 7 points',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'middle_opportunity',
          testRun: true
        }
      }],
      
      // Injury Impact Alert
      ['injury_impact', {
        pickId: 'sample-injury-003',
        capper: 'Noahthegoon',
        sport: 'NBA',
        selection: 'Jayson Tatum Over 26.5 Points',
        odds: '-120',
        units: 2,
        confidence: 82,
        systemGrade: 'S-tier',
        injuryDetails: 'Jaylen Brown listed as QUESTIONABLE - knee soreness. If Brown sits, expect increased usage for Tatum.',
        impact: 'HIGH IMPACT: +15% expected boost to Tatum scoring if Brown is ruled out',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'injury_impact',
          testRun: true
        }
      }],
      
      // Steam Move Alert
      ['steam_move', {
        pickId: 'sample-steam-004',
        capper: 'Jaybird',
        sport: 'MLB',
        selection: 'Yankees -1.5',
        odds: '+105',
        units: 4,
        confidence: 90,
        systemGrade: 'S-tier',
        steamDetails: 'SHARP MONEY DETECTED: Line moved from +120 to +105 in 10 minutes. Pinnacle, Circa, and BOL all following the move.',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'steam_move',
          testRun: true
        }
      }],
      
      // Line Movement Alert
      ['line_movement', {
        pickId: 'sample-line-005',
        capper: 'dub',
        sport: 'NHL',
        selection: 'Bruins Over 6.5 Goals',
        odds: '-105',
        units: 2,
        confidence: 75,
        systemGrade: 'B-tier',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'line_movement',
          lineMovement: 'Moved from 6 to 6.5 (-125 to -105) in past hour',
          testRun: true
        }
      }],
      
      // Stale Line Alert
      ['stale_line', {
        pickId: 'sample-stale-006',
        capper: 'Vicgo',
        sport: 'NBA',
        selection: 'Warriors +5.5',
        odds: '+110',
        units: 3,
        confidence: 88,
        systemGrade: 'A-tier',
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'stale_line',
          staleDetails: 'Line has not moved in 4+ hours while market shows 85% public on opponent',
          testRun: true
        }
      }],
      
      // Pick Post (goes to capper thread, not alerts channel)
      ['pick_post', {
        pickId: 'sample-pick-007',
        capper: 'Griff843',
        sport: 'NBA',
        selection: 'Lakers ML + Over 220.5',
        odds: '+245',
        units: 2,
        confidence: 83,
        systemGrade: 'A-tier',
        pickType: 'parlay',
        isLive: false,
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'pick_post',
          testRun: true
        }
      }],
      
      // Live Pick Post (goes to capper thread with red styling)
      ['pick_post', {
        pickId: 'sample-live-008',
        capper: 'Sauced',
        sport: 'NFL',
        selection: 'Chiefs 2H Under 21.5',
        odds: '-115',
        units: 4,
        confidence: 92,
        systemGrade: 'S-tier',
        pickType: 'single',
        isLive: true,
        timestamp: new Date().toISOString(),
        metadata: {
          sampleType: 'live_pick_post',
          testRun: true
        }
      }]
    ];
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the sample generator if this script is executed directly
if (require.main === module) {
  const generator = new AlertSampleGenerator();
  
  generator.generateAllSamples()
    .then(() => {
      logger.info('🎉 All sample alerts generated successfully!');
      logger.info('📍 Check your Discord channels:');
      logger.info('   • Alerts Channel (1288822948018257960): Hedge, Middle, Injury, Steam, Line Movement, Stale Line alerts');
      logger.info('   • Capper Threads: Pick posts (regular and live)');
      logger.info('   • System Alerts (1391813094438735883): Any routing errors');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Sample alert generation failed:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
}

export { AlertSampleGenerator };