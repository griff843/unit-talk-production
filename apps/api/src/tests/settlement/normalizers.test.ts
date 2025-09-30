import { normalizeMarket, getSupportedMarkets } from '../../workflows/settlement/normalizers';

describe('Market Normalizers', () => {
  describe('MLB Normalizer', () => {
    const mlbStats = {
      H: 3,
      HR: 2,
      R: 2,
      RBI: 4,
      BB: 1,
      TB: 8, // 1 single + 0 doubles + 0 triples + 2 HRs = 1 + 8 = 9, but mock as 8
      SO: 2,
      SB: 0,
      '2B': 0,
      '3B': 0
    };

    test('should normalize total bases correctly', () => {
      expect(normalizeMarket('MLB', 'total_bases', mlbStats)).toBe(8);
      expect(normalizeMarket('MLB', 'TB', mlbStats)).toBe(8);
      expect(normalizeMarket('MLB', 'totalbases', mlbStats)).toBe(8);
    });

    test('should normalize hits', () => {
      expect(normalizeMarket('MLB', 'hits', mlbStats)).toBe(3);
      expect(normalizeMarket('MLB', 'H', mlbStats)).toBe(3);
    });

    test('should normalize home runs', () => {
      expect(normalizeMarket('MLB', 'home_runs', mlbStats)).toBe(2);
      expect(normalizeMarket('MLB', 'HR', mlbStats)).toBe(2);
      expect(normalizeMarket('MLB', 'homers', mlbStats)).toBe(2);
    });

    test('should normalize runs and RBIs', () => {
      expect(normalizeMarket('MLB', 'runs', mlbStats)).toBe(2);
      expect(normalizeMarket('MLB', 'R', mlbStats)).toBe(2);
      expect(normalizeMarket('MLB', 'RBI', mlbStats)).toBe(4);
      expect(normalizeMarket('MLB', 'runs_batted_in', mlbStats)).toBe(4);
    });

    test('should normalize walks and strikeouts', () => {
      expect(normalizeMarket('MLB', 'walks', mlbStats)).toBe(1);
      expect(normalizeMarket('MLB', 'BB', mlbStats)).toBe(1);
      expect(normalizeMarket('MLB', 'strikeouts', mlbStats)).toBe(2);
      expect(normalizeMarket('MLB', 'SO', mlbStats)).toBe(2);
    });

    test('should handle combined stats', () => {
      expect(normalizeMarket('MLB', 'H+R+RBI', mlbStats)).toBe(9); // 3+2+4
      expect(normalizeMarket('MLB', 'hits_runs_rbis', mlbStats)).toBe(9);
    });

    test('should return null for unknown MLB markets', () => {
      expect(normalizeMarket('MLB', 'unknown_stat', mlbStats)).toBe(null);
    });

    // Test pitching stats
    const pitchingStats = {
      K: 8,
      BB_ALLOWED: 3,
      H_ALLOWED: 7,
      ER: 2,
      OUTS: 21, // 7 innings = 21 outs
      PITCHES: 95
    };

    test('should normalize pitching stats', () => {
      expect(normalizeMarket('MLB', 'pitching_strikeouts', pitchingStats)).toBe(8);
      expect(normalizeMarket('MLB', 'K', pitchingStats)).toBe(8);
      expect(normalizeMarket('MLB', 'walks_allowed', pitchingStats)).toBe(3);
      expect(normalizeMarket('MLB', 'earned_runs', pitchingStats)).toBe(2);
      expect(normalizeMarket('MLB', 'pitching_outs', pitchingStats)).toBe(21);
    });
  });

  describe('NFL Normalizer', () => {
    const nflStats = {
      PASS_YDS: 285,
      PASS_TD: 2,
      PASS_INT: 1,
      PASS_COMP: 22,
      PASS_ATT: 35,
      RUSH_YDS: 45,
      RUSH_TD: 1,
      RUSH_ATT: 8,
      REC_YDS: 0,
      REC: 0,
      REC_TD: 0,
      TARGETS: 0,
      TOTAL_YDS: 330,
      TOTAL_TD: 3,
      TACKLES: 5,
      SACKS: 1.5,
      FG_MADE: 2,
      XP_MADE: 3
    };

    test('should normalize passing stats', () => {
      expect(normalizeMarket('NFL', 'passing_yards', nflStats)).toBe(285);
      expect(normalizeMarket('NFL', 'pass_yds', nflStats)).toBe(285);
      expect(normalizeMarket('NFL', 'passing_touchdowns', nflStats)).toBe(2);
      expect(normalizeMarket('NFL', 'interceptions', nflStats)).toBe(1);
      expect(normalizeMarket('NFL', 'completions', nflStats)).toBe(22);
    });

    test('should normalize rushing stats', () => {
      expect(normalizeMarket('NFL', 'rushing_yards', nflStats)).toBe(45);
      expect(normalizeMarket('NFL', 'rush_yds', nflStats)).toBe(45);
      expect(normalizeMarket('NFL', 'rushing_touchdowns', nflStats)).toBe(1);
      expect(normalizeMarket('NFL', 'carries', nflStats)).toBe(8);
    });

    test('should normalize receiving stats', () => {
      expect(normalizeMarket('NFL', 'receiving_yards', nflStats)).toBe(0);
      expect(normalizeMarket('NFL', 'receptions', nflStats)).toBe(0);
      expect(normalizeMarket('NFL', 'targets', nflStats)).toBe(0);
    });

    test('should normalize combined stats', () => {
      expect(normalizeMarket('NFL', 'total_yards', nflStats)).toBe(330);
      expect(normalizeMarket('NFL', 'total_touchdowns', nflStats)).toBe(3);
      expect(normalizeMarket('NFL', 'anytime_td', nflStats)).toBe(3);
    });

    test('should normalize defensive stats', () => {
      expect(normalizeMarket('NFL', 'tackles', nflStats)).toBe(5);
      expect(normalizeMarket('NFL', 'sacks', nflStats)).toBe(1.5);
    });

    test('should normalize kicking stats', () => {
      expect(normalizeMarket('NFL', 'field_goals_made', nflStats)).toBe(2);
      expect(normalizeMarket('NFL', 'extra_points_made', nflStats)).toBe(3);
    });

    test('should calculate rush+rec yards', () => {
      const mixedStats = { ...nflStats, REC_YDS: 55 };
      expect(normalizeMarket('NFL', 'rush_rec_yards', mixedStats)).toBe(100); // 45+55
    });
  });

  describe('NBA Normalizer', () => {
    const nbaStats = {
      PTS: 28,
      REB: 12,
      AST: 7,
      STL: 2,
      BLK: 1,
      TO: 3,
      '3PM': 4,
      FGM: 11,
      FGA: 20,
      FTM: 6,
      MIN: 35.5,
      'PTS+REB': 40,
      'PTS+AST': 35,
      'REB+AST': 19,
      'PTS+REB+AST': 47,
      'STL+BLK': 3,
      DOUBLE_DOUBLE: 1,
      TRIPLE_DOUBLE: 0
    };

    test('should normalize basic stats', () => {
      expect(normalizeMarket('NBA', 'points', nbaStats)).toBe(28);
      expect(normalizeMarket('NBA', 'PTS', nbaStats)).toBe(28);
      expect(normalizeMarket('NBA', 'rebounds', nbaStats)).toBe(12);
      expect(normalizeMarket('NBA', 'assists', nbaStats)).toBe(7);
      expect(normalizeMarket('NBA', 'steals', nbaStats)).toBe(2);
      expect(normalizeMarket('NBA', 'blocks', nbaStats)).toBe(1);
    });

    test('should normalize shooting stats', () => {
      expect(normalizeMarket('NBA', '3_pointers_made', nbaStats)).toBe(4);
      expect(normalizeMarket('NBA', '3PM', nbaStats)).toBe(4);
      expect(normalizeMarket('NBA', 'threes', nbaStats)).toBe(4);
      expect(normalizeMarket('NBA', 'field_goals_made', nbaStats)).toBe(11);
      expect(normalizeMarket('NBA', 'free_throws_made', nbaStats)).toBe(6);
    });

    test('should normalize combined stats', () => {
      expect(normalizeMarket('NBA', 'points_rebounds', nbaStats)).toBe(40);
      expect(normalizeMarket('NBA', 'PTS+REB', nbaStats)).toBe(40);
      expect(normalizeMarket('NBA', 'points_assists', nbaStats)).toBe(35);
      expect(normalizeMarket('NBA', 'rebounds_assists', nbaStats)).toBe(19);
      expect(normalizeMarket('NBA', 'PRA', nbaStats)).toBe(47); // Points+Rebounds+Assists
      expect(normalizeMarket('NBA', 'steals_blocks', nbaStats)).toBe(3);
    });

    test('should normalize special markets', () => {
      expect(normalizeMarket('NBA', 'double_double', nbaStats)).toBe(1);
      expect(normalizeMarket('NBA', 'triple_double', nbaStats)).toBe(0);
      expect(normalizeMarket('NBA', 'minutes', nbaStats)).toBe(35.5);
    });
  });

  describe('WNBA Normalizer', () => {
    test('should use same normalization as NBA', () => {
      const wnbaStats = { PTS: 25, REB: 8, AST: 5 };
      
      expect(normalizeMarket('WNBA', 'points', wnbaStats)).toBe(25);
      expect(normalizeMarket('WNBA', 'rebounds', wnbaStats)).toBe(8);
      expect(normalizeMarket('WNBA', 'assists', wnbaStats)).toBe(5);
    });
  });

  describe('NCAA Normalizer', () => {
    test('should detect basketball vs football markets', () => {
      const basketballStats = { PTS: 20, REB: 10 };
      const footballStats = { PASS_YDS: 250, RUSH_YDS: 100 };

      // Basketball market
      expect(normalizeMarket('NCAAB', 'points', basketballStats)).toBe(20);
      expect(normalizeMarket('NCAAB', 'rebounds', basketballStats)).toBe(10);

      // Football market
      expect(normalizeMarket('NCAAF', 'passing_yards', footballStats)).toBe(250);
      expect(normalizeMarket('NCAAF', 'rushing_yards', footballStats)).toBe(100);
    });
  });

  describe('Supported Markets', () => {
    test('should return correct markets for each league', () => {
      const mlbMarkets = getSupportedMarkets('MLB');
      expect(mlbMarkets).toContain('total_bases');
      expect(mlbMarkets).toContain('home_runs');
      expect(mlbMarkets).toContain('strikeouts');

      const nflMarkets = getSupportedMarkets('NFL');
      expect(nflMarkets).toContain('passing_yards');
      expect(nflMarkets).toContain('rushing_touchdowns');
      expect(nflMarkets).toContain('receiving_yards');

      const nbaMarkets = getSupportedMarkets('NBA');
      expect(nbaMarkets).toContain('points');
      expect(nbaMarkets).toContain('rebounds');
      expect(nbaMarkets).toContain('points_rebounds_assists');

      expect(getSupportedMarkets('UNKNOWN')).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing stats gracefully', () => {
      expect(normalizeMarket('MLB', 'hits', {})).toBe(null);
      expect(normalizeMarket('NFL', 'passing_yards', {})).toBe(null);
      expect(normalizeMarket('NBA', 'points', {})).toBe(null);
    });

    test('should handle unknown leagues', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = normalizeMarket('UNKNOWN_LEAGUE', 'points', { points: 20 });
      expect(result).toBe(null);
      
      consoleWarnSpy.mockRestore();
    });

    test('should handle case variations in market names', () => {
      const stats = { PTS: 25 };
      
      expect(normalizeMarket('NBA', 'POINTS', stats)).toBe(25);
      expect(normalizeMarket('NBA', 'points', stats)).toBe(25);
      expect(normalizeMarket('NBA', 'Points', stats)).toBe(25);
      expect(normalizeMarket('NBA', 'pts', stats)).toBe(25);
    });

    test('should handle whitespace and special characters', () => {
      const stats = { PTS: 30, REB: 10, AST: 5 };
      
      expect(normalizeMarket('NBA', 'points + rebounds', stats)).toBe(null); // Unknown format
      expect(normalizeMarket('NBA', 'points_rebounds', stats)).toBe(40); // Should work
    });
  });

  describe('Real-world Examples', () => {
    test('should handle LeBron James triple-double', () => {
      const lebronStats = {
        PTS: 32,
        REB: 11,
        AST: 10,
        STL: 2,
        BLK: 1,
        'PTS+REB+AST': 53,
        TRIPLE_DOUBLE: 1
      };

      expect(normalizeMarket('NBA', 'points', lebronStats)).toBe(32);
      expect(normalizeMarket('NBA', 'triple_double', lebronStats)).toBe(1);
      expect(normalizeMarket('NBA', 'PRA', lebronStats)).toBe(53);
    });

    test('should handle Mike Trout hitting performance', () => {
      const troutStats = {
        H: 2,
        HR: 1,
        R: 2,
        RBI: 3,
        BB: 2,
        TB: 5, // Single + HR = 1 + 4 = 5
        SO: 1
      };

      expect(normalizeMarket('MLB', 'hits', troutStats)).toBe(2);
      expect(normalizeMarket('MLB', 'home_runs', troutStats)).toBe(1);
      expect(normalizeMarket('MLB', 'total_bases', troutStats)).toBe(5);
    });

    test('should handle Josh Allen passing game', () => {
      const allenStats = {
        PASS_YDS: 315,
        PASS_TD: 3,
        PASS_INT: 0,
        RUSH_YDS: 52,
        RUSH_TD: 1,
        TOTAL_YDS: 367,
        TOTAL_TD: 4
      };

      expect(normalizeMarket('NFL', 'passing_yards', allenStats)).toBe(315);
      expect(normalizeMarket('NFL', 'total_touchdowns', allenStats)).toBe(4);
    });
  });
});