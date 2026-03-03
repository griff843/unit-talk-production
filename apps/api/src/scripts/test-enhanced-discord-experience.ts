#!/usr/bin/env node

import { DiscordAlertRouter, AlertData, AlertType } from '../services/DiscordAlertRouter';
import { logger } from '../shared/logger';

/**
 * Test script for enhanced Fortune 100-grade Discord experience
 * Showcases advanced analytics, rich formatting, and premium features
 */
class EnhancedDiscordExperienceTest {
  async runEnhancedTests(): Promise<void> {
    logger.info('🚀 Starting enhanced Fortune 100-grade Discord experience test...');

    try {
      // Test enhanced daily picks with advanced analytics
      await this.testEnhancedDailyPicks();

      // Wait between test phases
      await this.sleep(5000);

      // Test enhanced alert system with rich context
      await this.testEnhancedAlerts();

      logger.info('✅ Enhanced Discord experience test completed successfully!');
    } catch (error) {
      logger.error('💥 Enhanced test suite failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Test enhanced daily picks with Fortune 100 analytics
   */
  private async testEnhancedDailyPicks(): Promise<void> {
    logger.info('💎 Testing enhanced daily picks with advanced analytics...');

    const enhancedPickSamples = this.createEnhancedPickSamples();

    for (const [capper, pickData] of enhancedPickSamples) {
      try {
        logger.info(`📊 Sending enhanced daily pick for ${capper}...`);
        await DiscordAlertRouter.routeAlert('pick_post', pickData);

        // Short delay between picks
        await this.sleep(3000);
      } catch (error) {
        logger.error(`❌ Failed to send enhanced daily pick for ${capper}`, {
          error: error instanceof Error ? error.message : String(error),
          capper,
        });
      }
    }

    logger.info('✅ Enhanced daily picks test completed');
  }

  /**
   * Test enhanced alert system with rich context
   */
  private async testEnhancedAlerts(): Promise<void> {
    logger.info('🚨 Testing enhanced alert system with rich analytics...');

    const enhancedAlertSamples = this.createEnhancedAlertSamples();

    for (const [alertType, alertData] of enhancedAlertSamples) {
      try {
        logger.info(`📢 Sending enhanced ${alertType} alert...`);
        await DiscordAlertRouter.routeAlert(alertType, alertData);

        // Wait between alerts to avoid rate limiting
        await this.sleep(4000);
      } catch (error) {
        logger.error(`❌ Failed to send enhanced ${alertType} alert`, {
          error: error instanceof Error ? error.message : String(error),
          alertType,
        });
      }
    }

    logger.info('✅ Enhanced alert system test completed');
  }

  /**
   * Create enhanced daily picks with Fortune 100-level analytics
   */
  private createEnhancedPickSamples(): Array<[string, AlertData]> {
    const timestamp = new Date().toISOString();

    return [
      // KingRo623 Enhanced Pick with Advanced Analytics
      [
        'KingRo623',
        {
          pickId: 'enhanced-kingro-001',
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
            testType: 'enhanced_daily_pick',
            testRun: true,
            analysis:
              'Celtics 8-2 ATS at home vs Western Conference teams. Key advantage in pace differential (+4.2 possessions/game) and defensive rating improvement (108.3 → 104.1 in last 10).',
            edgeScore: 12.4,
            expectedValue: 8.7,
            kellyFraction: 2.3,
            riskScore: 4.2,
            modelAgreement: 92,
            historicalAccuracy: 68.3,
            scenarioAnalysis: {
              bullCase: { probability: 35, expectedReturn: 18.2 },
              baseCase: { probability: 52, expectedReturn: 8.7 },
              bearCase: { probability: 13, expectedReturn: -4.1 },
            },
            featureContributions: {
              homeCourtAdvantage: 15.2,
              paceMatchup: 12.8,
              injuryImpact: -2.1,
              weatherConditions: 0.0,
              recentForm: 8.9,
            },
          },
        },
      ],

      // MoneyReef Enhanced Parlay with Risk Analysis
      [
        'MoneyReef',
        {
          pickId: 'enhanced-moneyreef-002',
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
            testType: 'enhanced_daily_pick',
            testRun: true,
            analysis:
              'Chiefs undefeated at home (7-0) with Mahomes averaging 312 pass yards. Weather favorable for passing (72°F, 3mph winds). Total correlation analysis shows 0.31 positive correlation between Chiefs ML and Over.',
            edgeScore: 15.8,
            expectedValue: 11.2,
            kellyFraction: 1.8,
            riskScore: 6.7,
            modelAgreement: 85,
            historicalAccuracy: 72.1,
            correlationRisk: 0.31,
            parlayBreakdown: {
              leg1_probability: 68.2,
              leg2_probability: 59.4,
              combined_probability: 40.5,
              fair_odds: '+147',
            },
          },
        },
      ],

      // Griff843 Enhanced S-tier Pick with ML Models
      [
        'Griff843',
        {
          pickId: 'enhanced-griff-003',
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
            testType: 'enhanced_daily_pick',
            testRun: true,
            analysis:
              'Cole (3.21 ERA) dominant in first 5 innings at home: 1.89 ERA, 0.94 WHIP, 12.1 K/9. Yankees lineup vs RHP: .847 OPS (3rd in MLB). Opposing starter allows 5.2 runs in F5 over last 6 starts.',
            edgeScore: 18.6,
            expectedValue: 14.3,
            kellyFraction: 3.2,
            riskScore: 3.1,
            modelAgreement: 96,
            historicalAccuracy: 74.8,
            pitcherMatchup: {
              homeStarter: { era: 3.21, whip: 1.08, k9: 9.8, f5Era: 1.89 },
              awayStarter: { era: 4.73, whip: 1.34, k9: 7.2, f5Era: 5.12 },
              advantage: 'Significant home starter edge',
            },
            weatherImpact: {
              temperature: 78,
              windSpeed: '8mph out to LF',
              impact: 'Neutral to slightly favorable for offense',
            },
          },
        },
      ],

      // Live Pick Example with Real-time Analytics
      [
        'Griff843',
        {
          pickId: 'enhanced-live-004',
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
            testType: 'enhanced_live_pick',
            testRun: true,
            analysis:
              'Live adjustment based on 1H metrics: Both teams shooting 39% (well below season avg of 47%). Pace dropped to 95.2 possessions (from 101.3 pregame). Key players in foul trouble affecting rotation.',
            edgeScore: 13.7,
            expectedValue: 9.4,
            kellyFraction: 2.1,
            riskScore: 5.3,
            liveAdjustments: {
              paceAdjustment: -6.1,
              shootingRegression: 'Expected positive regression minimal in 2H',
              foulTroubleImpact: 'Bench production 15% below starter efficiency',
              timeoutUsage: 'Both teams have 4+ timeouts remaining - expect slower pace',
            },
            realTimeMetrics: {
              currentPace: 95.2,
              projectedTotal: 108.3,
              confidenceInterval: '104.7 - 111.9',
            },
          },
        },
      ],
    ];
  }

  /**
   * Create enhanced alerts with rich context and analytics
   */
  private createEnhancedAlertSamples(): Array<[AlertType, AlertData]> {
    const timestamp = new Date().toISOString();

    return [
      // Enhanced Hedge Opportunity with Profit Calculation
      [
        'hedge_opportunity',
        {
          pickId: 'enhanced-hedge-001',
          capper: 'Griff843',
          sport: 'NBA',
          selection: 'Lakers -3.5',
          odds: '-110',
          units: 3,
          confidence: 85,
          systemGrade: 'A-tier',
          hedgeDetails:
            '🔄 **ARBITRAGE DETECTED**\n• DraftKings: Lakers -3.5 (-110)\n• FanDuel: Celtics +4 (-105)\n• Profit Margin: 2.34%',
          expectedProfit:
            '💰 **Guaranteed Profit: $2.34 per $100 wagered**\n• Optimal allocation: 52.1% on DK, 47.9% on FD\n• Risk-free return regardless of outcome',
          timestamp,
          metadata: {
            sampleType: 'enhanced_hedge_opportunity',
            testRun: true,
            arbitrageCalculation: {
              impliedProbability1: 52.38,
              impliedProbability2: 51.22,
              totalImplied: 103.6,
              profitMargin: 2.34,
              optimalStake1: 52.1,
              optimalStake2: 47.9,
            },
            timeRemaining: '4:23 until game start - window closing soon',
          },
        },
      ],

      // Enhanced Injury Impact with Detailed Analysis
      [
        'injury_impact',
        {
          pickId: 'enhanced-injury-002',
          capper: 'KingRo623',
          sport: 'NBA',
          selection: 'Jayson Tatum Over 26.5 Points',
          odds: '-120',
          units: 2,
          confidence: 82,
          systemGrade: 'S-tier',
          injuryDetails:
            '🏥 **BREAKING: Jaylen Brown (knee soreness) - QUESTIONABLE**\n• Last 3 games without Brown: Tatum averaged 31.7 PPG\n• Usage rate jumps from 29.1% to 34.8% (+5.7%)\n• Shot attempts increase by average of 4.2 per game',
          impact:
            '📊 **IMPACT ANALYSIS**\n• +15.2% boost to Tatum scoring probability\n• Historical edge: 73% hit rate on Tatum props when Brown sits\n• Line adjustment expected if Brown ruled out (-1.5 points)',
          timestamp,
          metadata: {
            sampleType: 'enhanced_injury_impact',
            testRun: true,
            injuryAnalysis: {
              playerImpacted: 'Jaylen Brown',
              injuryType: 'knee soreness',
              gameTimeProbability: 42,
              beneficiary: 'Jayson Tatum',
              usageIncrease: 5.7,
              historicalHitRate: 73.2,
              expectedLineMovement: -1.5,
            },
            modelAdjustments: {
              originalConfidence: 67,
              adjustedConfidence: 82,
              edgeIncrease: 8.4,
            },
          },
        },
      ],

      // Enhanced Steam Move with Market Intelligence
      [
        'steam_move',
        {
          pickId: 'enhanced-steam-003',
          capper: 'MoneyReef',
          sport: 'MLB',
          selection: 'Yankees -1.5',
          odds: '+105',
          units: 4,
          confidence: 90,
          systemGrade: 'S-tier',
          steamDetails:
            '🚀 **COORDINATED SHARP ACTION DETECTED**\n• **Volume**: $127K moved in 8 minutes across 4 books\n• **Books Following**: Pinnacle (-3¢), Circa (-4¢), BOL (-2¢), 5Dimes (-3¢)\n• **Reverse Line Movement**: 73% public on opponent, line moving toward Yankees',
          timestamp,
          metadata: {
            sampleType: 'enhanced_steam_move',
            testRun: true,
            marketIntelligence: {
              volumeMoved: 127000,
              timeWindow: 8,
              booksFollowing: ['Pinnacle', 'Circa', 'BOL', '5Dimes'],
              reverseLineMovement: true,
              publicPercentage: 73,
              sharpMoney: 'Heavy professional action detected',
              expectedClosure: '2-4 minutes typical window',
            },
            professionalIndicators: {
              coordinatedTiming: true,
              roundNumberBets: false,
              multiBookSimultaneous: true,
              unusualVelocity: true,
            },
          },
        },
      ],
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the enhanced test if this script is executed directly
if (require.main === module) {
  const testRunner = new EnhancedDiscordExperienceTest();

  testRunner
    .runEnhancedTests()
    .then(() => {
      logger.info('🏆 Enhanced Fortune 100-grade Discord experience test completed!');
      logger.info('💎 Premium Features Showcased:');
      logger.info('   📊 Advanced Analytics: Edge scores, expected value, Kelly fractions');
      logger.info('   🎯 Risk Assessment: Multi-dimensional risk scoring and scenario analysis');
      logger.info(
        '   🧠 AI Insights: Model agreement, feature contributions, correlation analysis'
      );
      logger.info('   ⚡ Live Intelligence: Real-time adjustments and market analysis');
      logger.info('   💰 Profit Optimization: Arbitrage calculations and position sizing');
      logger.info('   🏥 Injury Intelligence: Impact analysis and line movement predictions');
      logger.info('   🚀 Market Intelligence: Steam detection and professional betting patterns');
      logger.info('');
      logger.info('📍 Check your Discord channels for the enhanced experience!');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Enhanced test suite failed:', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
}

export { EnhancedDiscordExperienceTest };
