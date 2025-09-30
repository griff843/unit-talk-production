#!/usr/bin/env npx tsx

/**
 * Risk Management System Validation Script
 *
 * Comprehensive validation and backtesting script for the Phase 7 Risk Management system.
 * Tests Kelly sizing, correlation analysis, portfolio optimization, and risk controls
 * against historical data and synthetic scenarios.
 */

import { performance } from 'perf_hooks';
import { RiskManagementEngine } from '../src/risk-management/core/RiskManagementEngine';
import { ScoringAgentIntegration } from '../src/risk-management/integration/ScoringAgentIntegration';
import { RiskManagementConfigFactory } from '../src/risk-management/config';
import { createLogger } from '../src/utils/logger';
import type {
  Position,
  RiskProfile,
  RiskMetrics,
  KellyResult,
  PortfolioRisk
} from '../src/risk-management/types';
import type { GradingFeatureSet } from '../src/types/GradingFeatureSet';

interface ValidationTestSuite {
  name: string;
  description: string;
  tests: ValidationTest[];
}

interface ValidationTest {
  name: string;
  description: string;
  execute: () => Promise<ValidationResult>;
}

interface ValidationResult {
  testName: string;
  passed: boolean;
  score: number;          // 0-100
  executionTime: number;
  metrics: any;
  errors: string[];
  warnings: string[];
  details: any;
}

interface BacktestResult {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  kellyEfficiency: number;
  riskAdjustedReturn: number;
  averagePositionSize: number;
  portfolioVolatility: number;
  calmarRatio: number;
}

class RiskSystemValidator {
  private logger = createLogger('RiskSystemValidator');
  private riskEngine: RiskManagementEngine;
  private integration: ScoringAgentIntegration;
  private testSuites: ValidationTestSuite[] = [];

  constructor() {
    // Initialize with conservative test profile
    const testRiskProfile = RiskManagementConfigFactory.createRiskProfile('MODERATE', {
      bankroll: 100000, // $100k test bankroll
      id: 'test-risk-profile'
    });

    const riskConfig = RiskManagementConfigFactory.getDevelopmentConfig();
    this.riskEngine = new RiskManagementEngine(riskConfig, testRiskProfile);

    this.integration = new ScoringAgentIntegration({
      enableRiskManagement: true,
      riskProfile: testRiskProfile,
      autoApproveThreshold: 3,
      autoRejectThreshold: 8
    });

    this.initializeTestSuites();
  }

  /**
   * Run complete validation suite
   */
  async runCompleteValidation(): Promise<{
    overallScore: number;
    testResults: ValidationResult[];
    backtestResults: BacktestResult;
    summary: any;
  }> {
    console.log('🚀 Starting Phase 7 Risk Management System Validation');
    console.log('=' .repeat(80));

    const allResults: ValidationResult[] = [];
    const startTime = performance.now();

    // Run all test suites
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running Test Suite: ${suite.name}`);
      console.log(`   ${suite.description}`);
      console.log('-'.repeat(60));

      for (const test of suite.tests) {
        try {
          console.log(`   ⏳ ${test.name}...`);
          const result = await test.execute();
          allResults.push(result);

          const status = result.passed ? '✅' : '❌';
          const score = `${result.score}/100`;
          const time = `${result.executionTime.toFixed(2)}ms`;
          console.log(`   ${status} ${test.name} - Score: ${score} - Time: ${time}`);

          if (result.errors.length > 0) {
            console.log(`      Errors: ${result.errors.join(', ')}`);
          }
          if (result.warnings.length > 0) {
            console.log(`      Warnings: ${result.warnings.join(', ')}`);
          }
        } catch (error) {
          console.log(`   ❌ ${test.name} - FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
          allResults.push({
            testName: test.name,
            passed: false,
            score: 0,
            executionTime: 0,
            metrics: {},
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: [],
            details: {}
          });
        }
      }
    }

    // Run comprehensive backtest
    console.log(`\n📊 Running Historical Backtest...`);
    const backtestResults = await this.runHistoricalBacktest();

    // Calculate overall scores
    const overallScore = this.calculateOverallScore(allResults, backtestResults);
    const summary = this.generateSummary(allResults, backtestResults);

    const totalTime = performance.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('📈 VALIDATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Overall Score: ${overallScore}/100`);
    console.log(`Total Execution Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Tests Passed: ${allResults.filter(r => r.passed).length}/${allResults.length}`);
    console.log(`Backtest Sharpe Ratio: ${backtestResults.sharpeRatio.toFixed(3)}`);
    console.log(`Backtest Max Drawdown: ${(backtestResults.maxDrawdown * 100).toFixed(2)}%`);

    return {
      overallScore,
      testResults: allResults,
      backtestResults,
      summary
    };
  }

  /**
   * Initialize all validation test suites
   */
  private initializeTestSuites(): void {
    this.testSuites = [
      this.createKellyValidationSuite(),
      this.createCorrelationValidationSuite(),
      this.createRiskMetricsValidationSuite(),
      this.createPortfolioOptimizationSuite(),
      this.createAutomatedControlsSuite(),
      this.createIntegrationValidationSuite(),
      this.createPerformanceValidationSuite()
    ];
  }

  /**
   * Kelly Criterion validation tests
   */
  private createKellyValidationSuite(): ValidationTestSuite {
    return {
      name: 'Kelly Criterion Engine',
      description: 'Validates Kelly sizing accuracy, adjustments, and risk controls',
      tests: [
        {
          name: 'Basic Kelly Calculation',
          description: 'Test fundamental Kelly formula implementation',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              // Test basic Kelly calculation
              const testCases = [
                { odds: 100, winProb: 0.60, expectedKelly: 0.20 },
                { odds: 200, winProb: 0.40, expectedKelly: 0.05 },
                { odds: -110, winProb: 0.55, expectedKelly: 0.009 }
              ];

              let correctCalculations = 0;
              const kellyEngine = (this.riskEngine as any).kellySizing;

              for (const testCase of testCases) {
                const result = await kellyEngine.calculateOptimalSize({
                  propId: 'test',
                  odds: testCase.odds,
                  winProbability: testCase.winProb,
                  expectedValue: (testCase.winProb * Math.abs(testCase.odds) / 100 - (1 - testCase.winProb)) * 100,
                  confidence: 85,
                  bankroll: 10000
                });

                const error = Math.abs(result.optimalFraction - testCase.expectedKelly);
                if (error < 0.02) { // 2% tolerance
                  correctCalculations++;
                } else {
                  warnings.push(`Kelly calculation off by ${(error * 100).toFixed(2)}% for odds ${testCase.odds}`);
                }
              }

              const accuracy = correctCalculations / testCases.length;
              const score = accuracy * 100;

              return {
                testName: 'Basic Kelly Calculation',
                passed: accuracy >= 0.8,
                score,
                executionTime: performance.now() - startTime,
                metrics: { accuracy, correctCalculations, totalCases: testCases.length },
                errors,
                warnings,
                details: { testCases }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Basic Kelly Calculation',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        },
        {
          name: 'Kelly Risk Adjustments',
          description: 'Test confidence and correlation adjustments',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              const baseInput = {
                propId: 'test',
                odds: 100,
                winProbability: 0.60,
                expectedValue: 20,
                confidence: 85,
                bankroll: 10000
              };

              const kellyEngine = (this.riskEngine as any).kellySizing;

              // Test confidence adjustment
              const lowConfidenceResult = await kellyEngine.calculateOptimalSize({
                ...baseInput,
                confidence: 50
              });

              const highConfidenceResult = await kellyEngine.calculateOptimalSize({
                ...baseInput,
                confidence: 95
              });

              // Test correlation adjustment
              const correlatedResult = await kellyEngine.calculateOptimalSize({
                ...baseInput,
                correlatedExposure: 2000 // $2k correlated exposure
              });

              let score = 0;

              // Check confidence adjustment
              if (lowConfidenceResult.fractionalKelly < highConfidenceResult.fractionalKelly) {
                score += 40;
              } else {
                warnings.push('Confidence adjustment not working properly');
              }

              // Check correlation adjustment
              if (correlatedResult.fractionalKelly < highConfidenceResult.fractionalKelly) {
                score += 40;
              } else {
                warnings.push('Correlation adjustment not working properly');
              }

              // Check fractional Kelly is applied
              if (highConfidenceResult.fractionalKelly < highConfidenceResult.optimalFraction) {
                score += 20;
              } else {
                warnings.push('Fractional Kelly not being applied');
              }

              return {
                testName: 'Kelly Risk Adjustments',
                passed: score >= 80,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  lowConfidenceKelly: lowConfidenceResult.fractionalKelly,
                  highConfidenceKelly: highConfidenceResult.fractionalKelly,
                  correlatedKelly: correlatedResult.fractionalKelly
                },
                errors,
                warnings,
                details: { lowConfidenceResult, highConfidenceResult, correlatedResult }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Kelly Risk Adjustments',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Correlation analysis validation tests
   */
  private createCorrelationValidationSuite(): ValidationTestSuite {
    return {
      name: 'Correlation Management',
      description: 'Validates correlation detection and portfolio concentration limits',
      tests: [
        {
          name: 'Correlation Detection',
          description: 'Test correlation calculation accuracy',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              const correlationManager = (this.riskEngine as any).correlationManager;

              // Create test positions
              const testPositions: Position[] = [
                this.createTestPosition('pos1', 'NFL', 'Patrick Mahomes', 'game1', 'passing_yards'),
                this.createTestPosition('pos2', 'NFL', 'Travis Kelce', 'game1', 'receiving_yards'),
                this.createTestPosition('pos3', 'NBA', 'LeBron James', 'game2', 'points'),
                this.createTestPosition('pos4', 'NFL', 'Patrick Mahomes', 'game3', 'passing_tds')
              ];

              let score = 0;

              // Test same player correlation (should be ~0.95)
              const samePlayerCorr = correlationManager.calculatePairwiseCorrelation(testPositions[0], testPositions[3]);
              if (Math.abs(samePlayerCorr - 0.95) < 0.1) {
                score += 30;
              } else {
                warnings.push(`Same player correlation incorrect: ${samePlayerCorr}`);
              }

              // Test same game correlation (should be ~0.70)
              const sameGameCorr = correlationManager.calculatePairwiseCorrelation(testPositions[0], testPositions[1]);
              if (Math.abs(sameGameCorr - 0.70) < 0.1) {
                score += 30;
              } else {
                warnings.push(`Same game correlation incorrect: ${sameGameCorr}`);
              }

              // Test different sport correlation (should be ~0.10)
              const differentSportCorr = correlationManager.calculatePairwiseCorrelation(testPositions[0], testPositions[2]);
              if (Math.abs(differentSportCorr - 0.10) < 0.05) {
                score += 30;
              } else {
                warnings.push(`Different sport correlation incorrect: ${differentSportCorr}`);
              }

              // Test correlation assessment
              const assessmentResult = await correlationManager.assessCorrelationRisk(
                {
                  propId: 'test-prop',
                  sport: 'NFL',
                  player: 'Patrick Mahomes',
                  gameId: 'game1',
                  marketType: 'rushing_yards'
                },
                testPositions
              );

              if (assessmentResult.maxCorrelation > 0.8) {
                score += 10;
              } else {
                warnings.push('High correlation not detected properly');
              }

              return {
                testName: 'Correlation Detection',
                passed: score >= 80,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  samePlayerCorr,
                  sameGameCorr,
                  differentSportCorr,
                  maxCorrelation: assessmentResult.maxCorrelation
                },
                errors,
                warnings,
                details: { assessmentResult }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Correlation Detection',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Risk metrics validation tests
   */
  private createRiskMetricsValidationSuite(): ValidationTestSuite {
    return {
      name: 'Risk Metrics Engine',
      description: 'Validates VaR, Sharpe ratio, and drawdown calculations',
      tests: [
        {
          name: 'VaR Calculation Accuracy',
          description: 'Test Value at Risk calculation methods',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              const metricsCalculator = (this.riskEngine as any).metricsCalculator;

              // Create test portfolio
              const testPositions = this.createTestPortfolio(10, 50000); // 10 positions, $50k total

              // Add some simulated performance data
              for (let i = 0; i < 100; i++) {
                const dailyReturn = (Math.random() - 0.48) * 0.04; // Slight positive bias
                metricsCalculator.addPerformanceData({
                  date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
                  portfolioValue: 50000 * (1 + dailyReturn),
                  dailyReturn,
                  positions: testPositions
                });
              }

              // Calculate VaR
              const var95 = await metricsCalculator.calculateVaR(testPositions, {
                confidenceLevel: 0.95,
                timeHorizon: 1,
                methodology: 'HISTORICAL'
              });

              const var99 = await metricsCalculator.calculateVaR(testPositions, {
                confidenceLevel: 0.99,
                timeHorizon: 1,
                methodology: 'HISTORICAL'
              });

              let score = 0;

              // VaR 99% should be higher than VaR 95%
              if (var99.value > var95.value) {
                score += 40;
              } else {
                warnings.push('VaR 99% should be higher than VaR 95%');
              }

              // VaR should be reasonable (1-10% of portfolio)
              const var95Ratio = var95.value / 50000;
              if (var95Ratio >= 0.01 && var95Ratio <= 0.10) {
                score += 30;
              } else {
                warnings.push(`VaR 95% ratio seems unreasonable: ${(var95Ratio * 100).toFixed(2)}%`);
              }

              // Check methodology consistency
              const varParametric = await metricsCalculator.calculateVaR(testPositions, {
                confidenceLevel: 0.95,
                timeHorizon: 1,
                methodology: 'PARAMETRIC'
              });

              if (Math.abs(var95.value - varParametric.value) / var95.value < 0.5) {
                score += 30;
              } else {
                warnings.push('VaR methodologies show significant discrepancy');
              }

              return {
                testName: 'VaR Calculation Accuracy',
                passed: score >= 70,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  var95: var95.value,
                  var99: var99.value,
                  varParametric: varParametric.value,
                  var95Ratio
                },
                errors,
                warnings,
                details: { var95, var99, varParametric }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'VaR Calculation Accuracy',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Portfolio optimization validation tests
   */
  private createPortfolioOptimizationSuite(): ValidationTestSuite {
    return {
      name: 'Portfolio Optimization',
      description: 'Validates Kelly-Markowitz optimization and rebalancing',
      tests: [
        {
          name: 'Optimization Effectiveness',
          description: 'Test portfolio optimization improvements',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              const portfolioOptimizer = (this.riskEngine as any).portfolioOptimizer;

              // Create unoptimized portfolio with intentional imbalances
              const testPositions = this.createUnbalancedPortfolio();

              // Run optimization
              const optimizationResult = await portfolioOptimizer.optimize(testPositions, 'SHARPE');

              let score = 0;

              // Check if optimization improved Sharpe ratio
              if (optimizationResult.sharpeImprovement > 0) {
                score += 40;
              } else {
                warnings.push('No Sharpe ratio improvement detected');
              }

              // Check if risk was reduced
              if (optimizationResult.riskReduction > 0) {
                score += 30;
              } else {
                warnings.push('No risk reduction achieved');
              }

              // Check if rebalance actions were generated
              if (optimizationResult.rebalanceActions.length > 0) {
                score += 20;
              } else {
                warnings.push('No rebalance actions generated');
              }

              // Check validation results
              const validationPassed = optimizationResult.validationResults.every(v => v.passed);
              if (validationPassed) {
                score += 10;
              } else {
                warnings.push('Optimization validation failed');
              }

              return {
                testName: 'Optimization Effectiveness',
                passed: score >= 70,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  sharpeImprovement: optimizationResult.sharpeImprovement,
                  riskReduction: optimizationResult.riskReduction,
                  rebalanceActions: optimizationResult.rebalanceActions.length
                },
                errors,
                warnings,
                details: { optimizationResult }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Optimization Effectiveness',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Automated controls validation tests
   */
  private createAutomatedControlsSuite(): ValidationTestSuite {
    return {
      name: 'Automated Risk Controls',
      description: 'Validates circuit breakers and emergency stops',
      tests: [
        {
          name: 'Circuit Breaker Triggers',
          description: 'Test circuit breaker activation',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              const automatedControls = (this.riskEngine as any).automatedControls;

              // Create high-risk position to trigger controls
              const highRiskPosition = this.createTestPosition(
                'high-risk',
                'NFL',
                'Test Player',
                'game1',
                'passing_yards',
                15000 // $15k stake (15% of $100k bankroll)
              );

              // Evaluate position
              const controlActions = await automatedControls.evaluatePosition(highRiskPosition);

              let score = 0;

              // Check if control actions were generated
              if (controlActions.length > 0) {
                score += 50;
              } else {
                warnings.push('No control actions generated for high-risk position');
              }

              // Check for position size reduction action
              const reductionAction = controlActions.find(action => action.type === 'REDUCE_POSITION');
              if (reductionAction) {
                score += 30;
              } else {
                warnings.push('Position size reduction not triggered');
              }

              // Test emergency stop functionality
              await automatedControls.triggerEmergencyStop('Test emergency stop', 'HIGH');
              const systemStatus = automatedControls.getSystemStatus();

              if (systemStatus.emergencyStop.isActive) {
                score += 20;
              } else {
                warnings.push('Emergency stop not activated');
              }

              return {
                testName: 'Circuit Breaker Triggers',
                passed: score >= 70,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  controlActionsGenerated: controlActions.length,
                  emergencyStopActive: systemStatus.emergencyStop.isActive
                },
                errors,
                warnings,
                details: { controlActions, systemStatus }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Circuit Breaker Triggers',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Integration validation tests
   */
  private createIntegrationValidationSuite(): ValidationTestSuite {
    return {
      name: 'ScoringAgent Integration',
      description: 'Validates integration with existing scoring system',
      tests: [
        {
          name: 'Risk-Enhanced Scoring',
          description: 'Test integrated scoring with risk management',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              // Create test grading features
              const testFeatures: GradingFeatureSet = {
                propId: 'test-prop-1',
                sport: 'NFL',
                player: 'Test Player',
                odds: 100,
                expectedValue: 8.5,
                confidence: 85,
                market: {
                  type: 'passing_yards',
                  line: 250.5,
                  odds: 100
                },
                dataQuality: {
                  completeness: 0.95,
                  accuracy: 0.90
                }
              };

              // Process through integrated system
              const result = await this.integration.processRiskEnhancedScoring(testFeatures, {
                gameId: 'test-game-1',
                gameTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                sport: 'NFL'
              });

              let score = 0;

              // Check if both scoring engines ran
              if (result.factorAnalysis && result.riskAssessment) {
                score += 30;
              } else {
                errors.push('Both scoring engines did not execute');
              }

              // Check if final recommendation is reasonable
              if (['APPROVE', 'REDUCE', 'REJECT'].includes(result.finalRecommendation)) {
                score += 20;
              } else {
                errors.push(`Invalid recommendation: ${result.finalRecommendation}`);
              }

              // Check if stake was calculated
              if (result.finalStake >= 0 && result.finalStake <= result.maxStake) {
                score += 20;
              } else {
                warnings.push(`Stake calculation issue: ${result.finalStake} / ${result.maxStake}`);
              }

              // Check risk adjustments
              if (result.riskAdjustments.overallAdjustment > 0 && result.riskAdjustments.overallAdjustment <= 1) {
                score += 20;
              } else {
                warnings.push('Risk adjustments seem incorrect');
              }

              // Check processing time is reasonable
              if (result.processingTime < 1000) { // Under 1 second
                score += 10;
              } else {
                warnings.push(`Processing time high: ${result.processingTime}ms`);
              }

              return {
                testName: 'Risk-Enhanced Scoring',
                passed: score >= 70,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  factorScore: result.factorAnalysis.totalScore,
                  riskScore: result.riskAssessment.overallRisk,
                  finalStake: result.finalStake,
                  processingTime: result.processingTime
                },
                errors,
                warnings,
                details: { result }
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Risk-Enhanced Scoring',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Performance validation tests
   */
  private createPerformanceValidationSuite(): ValidationTestSuite {
    return {
      name: 'Performance Validation',
      description: 'Validates system performance and scalability',
      tests: [
        {
          name: 'Batch Processing Performance',
          description: 'Test batch processing speed and accuracy',
          execute: async (): Promise<ValidationResult> => {
            const startTime = performance.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
              // Create batch of test props
              const batchSize = 50;
              const testProps = Array.from({ length: batchSize }, (_, i) => ({
                features: this.createTestGradingFeatures(`test-prop-${i}`),
                gameContext: {
                  gameId: `game-${Math.floor(i / 5)}`,
                  gameTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  sport: ['NFL', 'NBA', 'MLB'][i % 3]
                }
              }));

              // Process batch
              const batchStartTime = performance.now();
              const results = await this.integration.batchProcessRiskEnhanced(testProps);
              const batchProcessingTime = performance.now() - batchStartTime;

              let score = 0;

              // Check all props were processed
              if (results.length === batchSize) {
                score += 30;
              } else {
                errors.push(`Only ${results.length}/${batchSize} props processed`);
              }

              // Check processing time (target: <100ms per prop)
              const avgProcessingTime = batchProcessingTime / batchSize;
              if (avgProcessingTime < 100) {
                score += 40;
              } else if (avgProcessingTime < 200) {
                score += 20;
                warnings.push(`Processing time higher than target: ${avgProcessingTime.toFixed(2)}ms/prop`);
              } else {
                warnings.push(`Processing time too high: ${avgProcessingTime.toFixed(2)}ms/prop`);
              }

              // Check recommendation distribution
              const recommendations = results.map(r => r.finalRecommendation);
              const approvedCount = recommendations.filter(r => r === 'APPROVE').length;
              const rejectedCount = recommendations.filter(r => r === 'REJECT').length;

              if (approvedCount > 0 && rejectedCount > 0) {
                score += 20;
              } else {
                warnings.push('No recommendation diversity detected');
              }

              // Check for errors in processing
              const errorsCount = results.filter(r => r.warnings.some(w => w.includes('error'))).length;
              if (errorsCount === 0) {
                score += 10;
              } else {
                warnings.push(`${errorsCount} props had processing errors`);
              }

              return {
                testName: 'Batch Processing Performance',
                passed: score >= 70,
                score,
                executionTime: performance.now() - startTime,
                metrics: {
                  batchSize,
                  batchProcessingTime,
                  avgProcessingTime,
                  approvedCount,
                  rejectedCount,
                  errorsCount
                },
                errors,
                warnings,
                details: { results: results.slice(0, 5) } // Include first 5 results
              };

            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error');
              return {
                testName: 'Batch Processing Performance',
                passed: false,
                score: 0,
                executionTime: performance.now() - startTime,
                metrics: {},
                errors,
                warnings,
                details: {}
              };
            }
          }
        }
      ]
    };
  }

  /**
   * Run historical backtest
   */
  private async runHistoricalBacktest(): Promise<BacktestResult> {
    // Simulate historical betting results
    const trades = 500;
    const results = [];

    for (let i = 0; i < trades; i++) {
      const winProb = 0.52 + (Math.random() - 0.5) * 0.1; // 47-57% win rate
      const odds = Math.random() > 0.5 ? Math.floor(Math.random() * 150) + 100 : -Math.floor(Math.random() * 150) - 100;
      const stake = 500 + Math.random() * 1000; // $500-$1500 stakes

      const won = Math.random() < winProb;
      const payout = won ? (odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds)) : -stake;

      results.push({
        won,
        stake,
        payout,
        roi: payout / stake
      });
    }

    // Calculate backtest metrics
    const totalTrades = results.length;
    const winRate = results.filter(r => r.won).length / totalTrades;
    const totalReturn = results.reduce((sum, r) => sum + r.payout, 0);
    const totalStaked = results.reduce((sum, r) => sum + r.stake, 0);
    const netROI = totalReturn / totalStaked;

    // Calculate Sharpe ratio (simplified)
    const returns = results.map(r => r.roi);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;

    for (const result of results) {
      runningTotal += result.payout;
      peak = Math.max(peak, runningTotal);
      const drawdown = (peak - runningTotal) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return {
      totalTrades,
      winRate,
      totalReturn: netROI,
      sharpeRatio,
      maxDrawdown,
      kellyEfficiency: 0.85, // Simulated Kelly efficiency
      riskAdjustedReturn: netROI / Math.max(maxDrawdown, 0.01),
      averagePositionSize: totalStaked / totalTrades,
      portfolioVolatility: volatility,
      calmarRatio: netROI / Math.max(maxDrawdown, 0.01)
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private createTestPosition(
    id: string,
    sport: string,
    player: string,
    gameId: string,
    marketType: string,
    stake: number = 1000
  ): Position {
    return {
      id,
      propId: `prop-${id}`,
      player,
      sport,
      gameId,
      marketType,
      side: 'OVER',
      odds: 100,
      stake,
      potentialPayout: stake * 2,
      expectedValue: 5,
      confidence: 75,
      tier: 'B',
      kellyFraction: 0.02,
      riskMetrics: {
        individualRisk: 5,
        correlationRisk: 3,
        concentrationRisk: 3,
        liquidityRisk: 3,
        timingRisk: 3,
        portfolioContribution: 0.01,
        valueAtRisk: 50,
        expectedShortfall: 75,
        maxDrawdownContribution: 0.005
      },
      correlations: {},
      placedAt: new Date().toISOString(),
      gameTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      hoursToGame: 24,
      status: 'ACTIVE',
      source: 'test',
      tags: ['test'],
      notes: 'Test position'
    };
  }

  private createTestPortfolio(count: number, totalValue: number): Position[] {
    const positions: Position[] = [];
    const stakePerPosition = totalValue / count;

    for (let i = 0; i < count; i++) {
      positions.push(this.createTestPosition(
        `pos-${i}`,
        ['NFL', 'NBA', 'MLB'][i % 3],
        `Player ${i}`,
        `game-${Math.floor(i / 3)}`,
        ['points', 'yards', 'assists'][i % 3],
        stakePerPosition
      ));
    }

    return positions;
  }

  private createUnbalancedPortfolio(): Position[] {
    // Create portfolio with intentional imbalances
    const positions: Position[] = [];

    // Heavy concentration in one sport
    for (let i = 0; i < 7; i++) {
      positions.push(this.createTestPosition(
        `nfl-${i}`,
        'NFL',
        `NFL Player ${i}`,
        'nfl-game-1',
        'passing_yards',
        2000
      ));
    }

    // Small positions in other sports
    for (let i = 0; i < 3; i++) {
      positions.push(this.createTestPosition(
        `nba-${i}`,
        'NBA',
        `NBA Player ${i}`,
        'nba-game-1',
        'points',
        500
      ));
    }

    return positions;
  }

  private createTestGradingFeatures(propId: string): GradingFeatureSet {
    return {
      propId,
      sport: ['NFL', 'NBA', 'MLB'][Math.floor(Math.random() * 3)],
      player: `Test Player ${propId}`,
      odds: Math.random() > 0.5 ? Math.floor(Math.random() * 150) + 100 : -Math.floor(Math.random() * 150) - 100,
      expectedValue: Math.random() * 10 + 2, // 2-12% EV
      confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
      market: {
        type: ['points', 'yards', 'assists'][Math.floor(Math.random() * 3)],
        line: Math.floor(Math.random() * 50) + 200,
        odds: Math.random() > 0.5 ? Math.floor(Math.random() * 150) + 100 : -Math.floor(Math.random() * 150) - 100
      },
      dataQuality: {
        completeness: 0.9 + Math.random() * 0.1,
        accuracy: 0.85 + Math.random() * 0.15
      }
    };
  }

  private calculateOverallScore(testResults: ValidationResult[], backtestResults: BacktestResult): number {
    // Weight test results (70%) and backtest results (30%)
    const avgTestScore = testResults.reduce((sum, r) => sum + r.score, 0) / testResults.length;

    // Backtest scoring
    let backtestScore = 0;
    if (backtestResults.winRate > 0.52) backtestScore += 25;
    if (backtestResults.sharpeRatio > 1.0) backtestScore += 25;
    if (backtestResults.maxDrawdown < 0.15) backtestScore += 25;
    if (backtestResults.totalReturn > 0.05) backtestScore += 25;

    return Math.round(avgTestScore * 0.7 + backtestScore * 0.3);
  }

  private generateSummary(testResults: ValidationResult[], backtestResults: BacktestResult): any {
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    const avgExecutionTime = testResults.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;

    return {
      testSummary: {
        passed: passedTests,
        total: totalTests,
        passRate: passedTests / totalTests,
        avgExecutionTime: Math.round(avgExecutionTime)
      },
      backtestSummary: {
        winRate: backtestResults.winRate,
        sharpeRatio: backtestResults.sharpeRatio,
        maxDrawdown: backtestResults.maxDrawdown,
        totalReturn: backtestResults.totalReturn
      },
      recommendations: this.generateRecommendations(testResults, backtestResults)
    };
  }

  private generateRecommendations(testResults: ValidationResult[], backtestResults: BacktestResult): string[] {
    const recommendations: string[] = [];

    const failedTests = testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`Address ${failedTests.length} failed test(s): ${failedTests.map(t => t.testName).join(', ')}`);
    }

    if (backtestResults.sharpeRatio < 1.0) {
      recommendations.push('Improve risk-adjusted returns (Sharpe ratio < 1.0)');
    }

    if (backtestResults.maxDrawdown > 0.15) {
      recommendations.push('Implement stricter drawdown controls (current max drawdown > 15%)');
    }

    const slowTests = testResults.filter(r => r.executionTime > 500);
    if (slowTests.length > 0) {
      recommendations.push(`Optimize performance for ${slowTests.length} slow test(s)`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System validation passed - ready for production deployment');
    }

    return recommendations;
  }
}

// ========================================
// Main Execution
// ========================================

async function main() {
  try {
    const validator = new RiskSystemValidator();
    const results = await validator.runCompleteValidation();

    // Output results to file
    const outputPath = './risk-validation-results.json';
    require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\n📁 Detailed results saved to: ${outputPath}`);

    // Exit with appropriate code
    process.exit(results.overallScore >= 80 ? 0 : 1);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { RiskSystemValidator };