#!/usr/bin/env node

import { DiscordAlertRouter, AlertData, AlertType } from '../services/DiscordAlertRouter';
import { logger } from '../shared/logger';

/**
 * Comprehensive test script for daily picks flow and alert system
 * Tests both individual capper pick threads and alerts channel
 */
class DailyPicksAndAlertsTestRunner {
  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting comprehensive daily picks and alerts test...');

    try {
      // Test daily picks for specific cappers
      await this.testDailyPicksFlow();

      // Wait between test phases
      await this.sleep(5000);

      // Test all alert types
      await this.testAlertSystem();

      logger.info('✅ All tests completed successfully!');
    } catch (error) {
      logger.error('💥 Test suite failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Test daily picks routing to individual capper channels
   */
  private async testDailyPicksFlow(): Promise<void> {
    logger.info('📊 Testing daily picks flow to capper channels...');

    const dailyPickSamples = this.createDailyPickSamples();

    for (const [capper, pickData] of dailyPickSamples) {
      try {
        logger.info(`📝 Sending daily pick for ${capper}...`);
        await DiscordAlertRouter.routeAlert('pick_post', pickData);

        // Short delay between picks
        await this.sleep(2000);
      } catch (error) {
        logger.error(`❌ Failed to send daily pick for ${capper}`, {
          error: error instanceof Error ? error.message : String(error),
          capper,
        });
      }
    }

    logger.info('✅ Daily picks flow test completed');
  }

  /**
   * Test alert system routing to alerts channel
   */
  private async testAlertSystem(): Promise<void> {
    logger.info('🚨 Testing alert system routing...');

    const alertSamples = this.createAlertSamples();

    for (const [alertType, alertData] of alertSamples) {
      try {
        logger.info(`📢 Sending ${alertType} alert...`);
        await DiscordAlertRouter.routeAlert(alertType, alertData);

        // Wait between alerts to avoid rate limiting
        await this.sleep(3000);
      } catch (error) {
        logger.error(`❌ Failed to send ${alertType} alert`, {
          error: error instanceof Error ? error.message : String(error),
          alertType,
        });
      }
    }

    logger.info('✅ Alert system test completed');
  }

  /**
   * Create sample daily picks for the three requested cappers
   */
  private createDailyPickSamples(): Array<[string, AlertData]> {
    const timestamp = new Date().toISOString();

    return [
      // KingRo623 Daily Pick
      [
        'KingRo623',
        {
          pickId: 'daily-kingro-001',
          capper: 'KingRo623',
          sport: 'NBA',
          selection: 'Celtics -4.5',
          odds: '-110',
          units: 3,
          confidence: 87,
          systemGrade: 'A-tier',
          pickType: 'single',
          isLive: false,
          timestamp,
          metadata: {
            testType: 'daily_pick',
            testRun: true,
            analysis: 'Strong home court advantage, Celtics 8-2 ATS in last 10 home games',
          },
        },
      ],

      // MoneyReef Daily Pick
      [
        'MoneyReef',
        {
          pickId: 'daily-moneyreef-002',
          capper: 'MoneyReef',
          sport: 'NFL',
          selection: 'Chiefs ML + Over 47.5',
          odds: '+185',
          units: 2,
          confidence: 82,
          systemGrade: 'A-tier',
          pickType: 'parlay',
          isLive: false,
          timestamp,
          metadata: {
            testType: 'daily_pick',
            testRun: true,
            analysis:
              'High-scoring potential with both teams averaging 28+ PPG. Chiefs undefeated at home.',
          },
        },
      ],

      // Griff843 Daily Pick (you)
      [
        'Griff843',
        {
          pickId: 'daily-griff-003',
          capper: 'Griff843',
          sport: 'MLB',
          selection: 'Yankees F5 -0.5',
          odds: '+120',
          units: 4,
          confidence: 91,
          systemGrade: 'S-tier',
          pickType: 'single',
          isLive: false,
          timestamp,
          metadata: {
            testType: 'daily_pick',
            testRun: true,
            analysis:
              'Cole on the mound at home, Yankees 12-3 in first 5 innings with Cole starting',
          },
        },
      ],

      // Live Pick Example
      [
        'Griff843',
        {
          pickId: 'live-griff-004',
          capper: 'Griff843',
          sport: 'NBA',
          selection: '2H Lakers Under 110.5',
          odds: '-105',
          units: 3,
          confidence: 88,
          systemGrade: 'A-tier',
          pickType: 'single',
          isLive: true,
          timestamp,
          metadata: {
            testType: 'live_pick',
            testRun: true,
            analysis: 'Both teams shooting poorly, pace has slowed significantly in 2H',
          },
        },
      ],
    ];
  }

  /**
   * Create sample alerts for all alert types
   */
  private createAlertSamples(): Array<[AlertType, AlertData]> {
    const timestamp = new Date().toISOString();

    return [
      // Hedge Opportunity Alert
      [
        'hedge_opportunity',
        {
          pickId: 'alert-hedge-001',
          capper: 'Griff843',
          sport: 'NBA',
          selection: 'Lakers -3.5',
          odds: '-110',
          units: 3,
          confidence: 85,
          systemGrade: 'A-tier',
          hedgeDetails: '🔄 DraftKings: Lakers -3.5 (-110) | FanDuel: Celtics +4 (-105)',
          expectedProfit: '💰 2.3% guaranteed profit with proper sizing ($100 bet = $2.30 profit)',
          timestamp,
          metadata: {
            sampleType: 'hedge_opportunity',
            testRun: true,
          },
        },
      ],

      // Injury Impact Alert
      [
        'injury_impact',
        {
          pickId: 'alert-injury-002',
          capper: 'KingRo623',
          sport: 'NBA',
          selection: 'Jayson Tatum Over 26.5 Points',
          odds: '-120',
          units: 2,
          confidence: 82,
          systemGrade: 'S-tier',
          injuryDetails:
            '🏥 Jaylen Brown listed as QUESTIONABLE - knee soreness. If Brown sits, expect increased usage for Tatum.',
          impact: '📈 HIGH IMPACT: +15% expected boost to Tatum scoring if Brown is ruled out',
          timestamp,
          metadata: {
            sampleType: 'injury_impact',
            testRun: true,
          },
        },
      ],

      // Steam Move Alert
      [
        'steam_move',
        {
          pickId: 'alert-steam-003',
          capper: 'MoneyReef',
          sport: 'MLB',
          selection: 'Yankees -1.5',
          odds: '+105',
          units: 4,
          confidence: 90,
          systemGrade: 'S-tier',
          steamDetails:
            '🚀 SHARP MONEY DETECTED: Line moved from +120 to +105 in 10 minutes. Pinnacle, Circa, and BOL all following the move.',
          timestamp,
          metadata: {
            sampleType: 'steam_move',
            testRun: true,
          },
        },
      ],

      // Middle Opportunity Alert
      [
        'middle_opportunity',
        {
          pickId: 'alert-middle-004',
          capper: 'Jaybird',
          sport: 'NFL',
          selection: 'Chiefs -7',
          odds: '-115',
          units: 2,
          confidence: 78,
          systemGrade: 'A-tier',
          middleSetup: '🎯 Chiefs -7 (-115) + Dolphins +7.5 (-110)',
          potentialWin: '💵 Win both if final margin is exactly 7 points',
          timestamp,
          metadata: {
            sampleType: 'middle_opportunity',
            testRun: true,
          },
        },
      ],

      // Line Movement Alert
      [
        'line_movement',
        {
          pickId: 'alert-line-005',
          capper: 'Noahthegoon',
          sport: 'NHL',
          selection: 'Bruins Over 6.5 Goals',
          odds: '-105',
          units: 2,
          confidence: 75,
          systemGrade: 'B-tier',
          timestamp,
          metadata: {
            sampleType: 'line_movement',
            lineMovement: '📈 Moved from 6 to 6.5 (-125 to -105) in past hour',
            testRun: true,
          },
        },
      ],

      // Stale Line Alert
      [
        'stale_line',
        {
          pickId: 'alert-stale-006',
          capper: 'Vicgo',
          sport: 'NBA',
          selection: 'Warriors +5.5',
          odds: '+110',
          units: 3,
          confidence: 88,
          systemGrade: 'A-tier',
          timestamp,
          metadata: {
            sampleType: 'stale_line',
            staleDetails:
              '⏰ Line has not moved in 4+ hours while market shows 85% public on opponent',
            testRun: true,
          },
        },
      ],
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the comprehensive test if this script is executed directly
if (require.main === module) {
  const testRunner = new DailyPicksAndAlertsTestRunner();

  testRunner
    .runAllTests()
    .then(() => {
      logger.info('🎉 All tests completed successfully!');
      logger.info('📍 Check your Discord channels:');
      logger.info('   📊 Daily Picks sent to:');
      logger.info('     • KingRo623 Thread: NBA Celtics -4.5 pick');
      logger.info('     • MoneyReef Thread: NFL Chiefs ML + Over parlay');
      logger.info('     • Griff843 Thread: MLB Yankees F5 pick + Live NBA 2H Under');
      logger.info('   🚨 Alerts sent to Alerts Channel:');
      logger.info('     • Hedge Opportunity (Lakers)');
      logger.info('     • Injury Impact (Tatum points)');
      logger.info('     • Steam Move (Yankees runline)');
      logger.info('     • Middle Opportunity (Chiefs spread)');
      logger.info('     • Line Movement (Bruins total)');
      logger.info('     • Stale Line (Warriors spread)');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Test suite failed:', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
}

export { DailyPicksAndAlertsTestRunner };
