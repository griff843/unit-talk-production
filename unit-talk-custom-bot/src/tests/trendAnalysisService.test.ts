import { TrendAnalysisService, PickData } from '../services/trendAnalysisService';
import { DatabaseService } from '../services/database';

// Mock the DatabaseService
jest.mock('../services/database');

describe('TrendAnalysisService', () => {
  let trendService: TrendAnalysisService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    trendService = new TrendAnalysisService(mockDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('performTrendAnalysis', () => {
    it('should return empty analysis when no picks are found', async () => {
      // Mock empty database response
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: [], error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();

      expect(result.streaks).toHaveLength(0);
      expect(result.trend_breaks).toHaveLength(0);
      expect(result.statistical_outliers).toHaveLength(0);
      expect(result.regression_candidates).toHaveLength(0);
      expect(result.analysis_metadata.total_picks_analyzed).toBe(0);
    });

    it('should perform comprehensive analysis with real data', async () => {
      const mockPicks = createMockPicksData();
      
      // Mock database response
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: mockPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis({
        days_back: 30,
        min_sample_size: 5,
        confidence_threshold: 0.6
      });

      expect(result.analysis_metadata.total_picks_analyzed).toBe(mockPicks.length);
      expect(result.streaks.length).toBeGreaterThanOrEqual(0);
      expect(result.trend_breaks.length).toBeGreaterThanOrEqual(0);
      expect(result.statistical_outliers.length).toBeGreaterThanOrEqual(0);
      expect(result.regression_candidates.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by sport when specified', async () => {
      const mockPicks = createMockPicksData();
      
      // Mock database response with sport filter
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockReturnValue({
                          ilike: jest.fn().mockResolvedValue({ data: mockPicks.filter(p => p.pick_type.includes('nba')), error: null })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis({
        sport_filter: 'nba'
      });

      expect(result.analysis_metadata.total_picks_analyzed).toBeGreaterThan(0);
    });
  });

  describe('streak analysis', () => {
    it('should detect winning streaks correctly', async () => {
      const streakPicks = createWinningStreakData();
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: streakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.streaks.length).toBeGreaterThan(0);
      const winStreak = result.streaks.find(s => s.streak_type === 'win');
      expect(winStreak).toBeDefined();
      expect(winStreak!.current_streak).toBeGreaterThanOrEqual(3);
      expect(winStreak!.confidence_score).toBeGreaterThan(0);
    });

    it('should detect losing streaks correctly', async () => {
      const streakPicks = createLosingStreakData();
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: streakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.streaks.length).toBeGreaterThan(0);
      const lossStreak = result.streaks.find(s => s.streak_type === 'loss');
      expect(lossStreak).toBeDefined();
      expect(lossStreak!.current_streak).toBeGreaterThanOrEqual(3);
    });

    it('should calculate streak probability correctly', async () => {
      const streakPicks = createWinningStreakData();
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: streakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      const streak = result.streaks[0];
      expect(streak.streak_probability).toBeGreaterThan(0);
      expect(streak.streak_probability).toBeLessThanOrEqual(1);
      expect(streak.historical_win_rate).toBeGreaterThan(0);
      expect(streak.historical_win_rate).toBeLessThanOrEqual(1);
    });
  });

  describe('trend break analysis', () => {
    it('should detect performance decline trend breaks', async () => {
      const trendBreakPicks = createTrendBreakData('decline');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: trendBreakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.trend_breaks.length).toBeGreaterThan(0);
      const declineBreak = result.trend_breaks.find(tb => tb.trend_break_type === 'performance_decline');
      expect(declineBreak).toBeDefined();
      expect(declineBreak!.recent_hit_rate).toBeLessThan(declineBreak!.historical_hit_rate);
      expect(declineBreak!.deviation_percentage).toBeGreaterThan(20);
    });

    it('should detect performance surge trend breaks', async () => {
      const trendBreakPicks = createTrendBreakData('surge');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: trendBreakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.trend_breaks.length).toBeGreaterThan(0);
      const surgeBreak = result.trend_breaks.find(tb => tb.trend_break_type === 'performance_surge');
      expect(surgeBreak).toBeDefined();
      expect(surgeBreak!.recent_hit_rate).toBeGreaterThan(surgeBreak!.historical_hit_rate);
    });

    it('should calculate trend break confidence correctly', async () => {
      const trendBreakPicks = createTrendBreakData('decline');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: trendBreakPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      const trendBreak = result.trend_breaks[0];
      expect(trendBreak.confidence_score).toBeGreaterThan(0);
      expect(trendBreak.confidence_score).toBeLessThanOrEqual(1);
      expect(trendBreak.sample_size).toBeGreaterThanOrEqual(10);
    });
  });

  describe('statistical outlier analysis', () => {
    it('should detect high outliers correctly', async () => {
      const outlierPicks = createStatisticalOutlierData('high');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: outlierPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.statistical_outliers.length).toBeGreaterThan(0);
      const highOutlier = result.statistical_outliers.find(o => o.outlier_type === 'high');
      expect(highOutlier).toBeDefined();
      expect(highOutlier!.current_line).toBeGreaterThan(highOutlier!.historical_average);
      expect(highOutlier!.z_score).toBeGreaterThan(2);
    });

    it('should detect low outliers correctly', async () => {
      const outlierPicks = createStatisticalOutlierData('low');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: outlierPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.statistical_outliers.length).toBeGreaterThan(0);
      const lowOutlier = result.statistical_outliers.find(o => o.outlier_type === 'low');
      expect(lowOutlier).toBeDefined();
      expect(lowOutlier!.current_line).toBeLessThan(lowOutlier!.historical_average);
    });

    it('should calculate z-scores correctly', async () => {
      const outlierPicks = createStatisticalOutlierData('high');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: outlierPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      const outlier = result.statistical_outliers[0];
      const expectedZScore = Math.abs(outlier.current_line - outlier.historical_average) / outlier.standard_deviation;
      expect(outlier.z_score).toBeCloseTo(expectedZScore, 2);
    });
  });

  describe('regression analysis', () => {
    it('should detect over-performance regression candidates', async () => {
      const regressionPicks = createRegressionData('over');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: regressionPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.regression_candidates.length).toBeGreaterThan(0);
      const overPerformer = result.regression_candidates.find(r => r.current_performance > r.expected_regression);
      expect(overPerformer).toBeDefined();
      expect(overPerformer!.over_performance_streak).toBeGreaterThan(0);
    });

    it('should detect under-performance regression candidates', async () => {
      const regressionPicks = createRegressionData('under');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: regressionPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.regression_candidates.length).toBeGreaterThan(0);
      const underPerformer = result.regression_candidates.find(r => r.current_performance < r.expected_regression);
      expect(underPerformer).toBeDefined();
      expect(underPerformer!.under_performance_streak).toBeGreaterThan(0);
    });

    it('should calculate regression confidence correctly', async () => {
      const regressionPicks = createRegressionData('over');
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: regressionPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      const regression = result.regression_candidates[0];
      expect(regression.regression_confidence).toBeGreaterThan(0);
      expect(regression.regression_confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis();
      
      expect(result.streaks).toHaveLength(0);
      expect(result.trend_breaks).toHaveLength(0);
      expect(result.statistical_outliers).toHaveLength(0);
      expect(result.regression_candidates).toHaveLength(0);
    });

    it('should handle insufficient sample sizes', async () => {
      const smallDataset = createMockPicksData().slice(0, 3); // Only 3 picks
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: smallDataset, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const result = await trendService.performTrendAnalysis({
        min_sample_size: 5
      });
      
      // Should have minimal or no results due to insufficient sample size
      expect(result.analysis_metadata.total_picks_analyzed).toBe(3);
    });

    it('should respect confidence thresholds', async () => {
      const mockPicks = createMockPicksData();
      
      mockDatabaseService.client = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    not: jest.fn().mockReturnValue({
                      not: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: mockPicks, error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      } as any;

      const highConfidenceResult = await trendService.performTrendAnalysis({
        confidence_threshold: 0.9
      });
      
      const lowConfidenceResult = await trendService.performTrendAnalysis({
        confidence_threshold: 0.1
      });

      // High confidence should have fewer or equal results
      expect(highConfidenceResult.streaks.length).toBeLessThanOrEqual(lowConfidenceResult.streaks.length);
      expect(highConfidenceResult.trend_breaks.length).toBeLessThanOrEqual(lowConfidenceResult.trend_breaks.length);
    });
  });
});

// Helper functions to create test data

function createMockPicksData(): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create diverse pick data for testing
  const players = ['LeBron James', 'Stephen Curry', 'Luka Doncic', 'Jayson Tatum'];
  const statTypes = ['points', 'assists', 'rebounds', 'threes'];
  const results: ('win' | 'loss' | 'push')[] = ['win', 'loss', 'push'];

  for (let i = 0; i < 50; i++) {
    const player = players[i % players.length];
    const statType = statTypes[i % statTypes.length];
    const result = results[i % results.length];
    
    picks.push({
      id: `pick_${i}`,
      player_name: player,
      stat_type: statType,
      line: 25 + Math.random() * 10,
      over_under: Math.random() > 0.5 ? 'over' : 'under',
      odds: -110 + Math.random() * 40,
      result: result,
      actual_value: 20 + Math.random() * 20,
      confidence: 70 + Math.random() * 30,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: `user_${i % 10}`,
      stake: 100,
      profit_loss: result === 'win' ? 90 : result === 'loss' ? -100 : 0
    });
  }

  return picks;
}

function createWinningStreakData(): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create a winning streak for LeBron James points
  for (let i = 0; i < 15; i++) {
    picks.push({
      id: `streak_pick_${i}`,
      player_name: 'LeBron James',
      stat_type: 'points',
      line: 25,
      over_under: 'over',
      odds: -110,
      result: i < 5 ? 'win' : (i < 10 ? 'loss' : 'win'), // 5 wins, 5 losses, then 5 wins (current streak)
      actual_value: i < 5 ? 28 : (i < 10 ? 22 : 29),
      confidence: 80,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: 'user_1',
      stake: 100,
      profit_loss: i < 5 ? 90 : (i < 10 ? -100 : 90)
    });
  }

  return picks;
}

function createLosingStreakData(): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create a losing streak for Stephen Curry threes
  for (let i = 0; i < 15; i++) {
    picks.push({
      id: `loss_streak_pick_${i}`,
      player_name: 'Stephen Curry',
      stat_type: 'threes',
      line: 4.5,
      over_under: 'over',
      odds: -110,
      result: i < 5 ? 'win' : (i < 10 ? 'loss' : 'loss'), // 5 wins, then 10 losses (current streak)
      actual_value: i < 5 ? 6 : (i < 10 ? 3 : 2),
      confidence: 75,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: 'user_2',
      stake: 100,
      profit_loss: i < 5 ? 90 : -100
    });
  }

  return picks;
}

function createTrendBreakData(type: 'decline' | 'surge'): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create trend break data for Luka Doncic assists
  for (let i = 0; i < 20; i++) {
    const isRecent = i >= 15; // Last 5 games are "recent"
    let result: 'win' | 'loss';

    if (type === 'decline') {
      // Historical: 80% win rate, Recent: 20% win rate
      result = isRecent ? (Math.random() < 0.2 ? 'win' : 'loss') : (Math.random() < 0.8 ? 'win' : 'loss');
    } else {
      // Historical: 40% win rate, Recent: 80% win rate  
      result = isRecent ? (Math.random() < 0.8 ? 'win' : 'loss') : (Math.random() < 0.4 ? 'win' : 'loss');
    }

    picks.push({
      id: `trend_break_pick_${i}`,
      player_name: 'Luka Doncic',
      stat_type: 'assists',
      line: 8.5,
      over_under: 'over',
      odds: -110,
      result: result,
      actual_value: result === 'win' ? 10 : 7,
      confidence: 80,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: 'user_3',
      stake: 100,
      profit_loss: result === 'win' ? 90 : -100
    });
  }

  return picks;
}

function createStatisticalOutlierData(type: 'high' | 'low'): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create statistical outlier data for Jayson Tatum points
  const historicalAverage = 25;
  const standardDeviation = 3;

  for (let i = 0; i < 15; i++) {
    const isOutlier = i === 14; // Last pick is the outlier
    let line: number;
    let actualValue: number;

    if (isOutlier) {
      if (type === 'high') {
        line = historicalAverage + 3 * standardDeviation; // 3 standard deviations above
        actualValue = line + 2;
      } else {
        line = historicalAverage - 3 * standardDeviation; // 3 standard deviations below
        actualValue = line - 2;
      }
    } else {
      line = historicalAverage + (Math.random() - 0.5) * standardDeviation;
      actualValue = line + (Math.random() - 0.5) * 4;
    }

    picks.push({
      id: `outlier_pick_${i}`,
      player_name: 'Jayson Tatum',
      stat_type: 'points',
      line: line,
      over_under: 'over',
      odds: -110,
      result: actualValue > line ? 'win' : 'loss',
      actual_value: actualValue,
      confidence: 80,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: 'user_4',
      stake: 100,
      profit_loss: actualValue > line ? 90 : -100
    });
  }

  return picks;
}

function createRegressionData(type: 'over' | 'under'): PickData[] {
  const baseDate = new Date('2024-01-01');
  const picks: PickData[] = [];

  // Create regression data for Giannis Antetokounmpo rebounds
  const line = 12;

  for (let i = 0; i < 20; i++) {
    const isRecent = i >= 15; // Last 5 games are "recent"
    let actualValue: number;

    if (type === 'over') {
      // Historical: performs around line, Recent: significantly over-performing
      actualValue = isRecent ? line + 3 + Math.random() * 2 : line + (Math.random() - 0.5) * 2;
    } else {
      // Historical: performs around line, Recent: significantly under-performing
      actualValue = isRecent ? line - 3 - Math.random() * 2 : line + (Math.random() - 0.5) * 2;
    }

    picks.push({
      id: `regression_pick_${i}`,
      player_name: 'Giannis Antetokounmpo',
      stat_type: 'rebounds',
      line: line,
      over_under: 'over',
      odds: -110,
      result: actualValue > line ? 'win' : 'loss',
      actual_value: actualValue,
      confidence: 80,
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      pick_type: 'nba_player_prop',
      discord_id: 'user_5',
      stake: 100,
      profit_loss: actualValue > line ? 90 : -100
    });
  }

  return picks;
}