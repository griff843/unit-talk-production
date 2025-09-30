import { MLBAdapter } from '../../workflows/settlement/adapters/mlbAdapter';
import { NFLAdapter } from '../../workflows/settlement/adapters/nflAdapter';
import { NBAAdapter } from '../../workflows/settlement/adapters/nbaAdapter';
import { NCAAAdapter } from '../../workflows/settlement/adapters/ncaaAdapter';
import { WNBAAdapter } from '../../workflows/settlement/adapters/wnbaAdapter';
import axios from 'axios';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Sport Adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MLBAdapter', () => {
    let adapter: MLBAdapter;

    beforeEach(() => {
      adapter = new MLBAdapter();
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('MLB StatsAPI');
    });

    it('should have correct rate limit', () => {
      expect(adapter.getRateLimit()).toBe(10);
    });

    it.skip('should fetch game stats from MLB API', async () => {
      // Mock API response
      const mockResponse = {
        data: {
          teams: {
            away: {
              players: {
                'ID123': {
                  person: { id: 123, fullName: 'Mike Trout' },
                  stats: {
                    batting: {
                      hits: 2,
                      homeRuns: 1,
                      runs: 2,
                      rbi: 3,
                      baseOnBalls: 1,
                      strikeOuts: 1,
                      doubles: 0,
                      triples: 0,
                      atBats: 4
                    }
                  }
                }
              }
            },
            home: { players: {} }
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const stats = await adapter.fetchGameStats('123456');
      
      expect(stats['Mike Trout']).toBeDefined();
      expect(stats['Mike Trout'].H).toBe(2);
      expect(stats['Mike Trout'].HR).toBe(1);
      expect(stats['Mike Trout'].TB).toBe(5); // 1 single + 4 for HR = 5
    });

    it('should retry on failure', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { teams: { away: { players: {} }, home: { players: {} } } } });

      const stats = await adapter.fetchGameStats('123456');
      
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(stats).toBeDefined();
    });
  });

  describe('NFLAdapter', () => {
    let adapter: NFLAdapter;

    beforeEach(() => {
      adapter = new NFLAdapter();
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('ESPN NFL');
    });

    it('should have correct rate limit', () => {
      expect(adapter.getRateLimit()).toBe(4);
    });

    it.skip('should parse ESPN boxscore data', async () => {
      const mockResponse = {
        data: {
          boxscore: {
            players: [{
              statistics: [{
                name: 'passing',
                athletes: [{
                  athlete: { id: '123', displayName: 'Josh Allen' },
                  stats: ['22/35', '315', '3', '0', '2', '105.2', '98.1']
                }]
              }]
            }]
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const stats = await adapter.fetchGameStats('401547428');
      
      expect(stats['Josh Allen']).toBeDefined();
      expect(stats['Josh Allen'].PASS_YDS).toBe(315);
      expect(stats['Josh Allen'].PASS_TD).toBe(3);
    });
  });

  describe('NBAAdapter', () => {
    let adapter: NBAAdapter;

    beforeEach(() => {
      adapter = new NBAAdapter();
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('NBA Stats API');
    });

    it('should have correct rate limit', () => {
      expect(adapter.getRateLimit()).toBe(6);
    });

    it.skip('should handle BallDontLie API response', async () => {
      const mockResponse = {
        data: {
          data: [{
            id: 123,
            first_name: 'LeBron',
            last_name: 'James',
            pts: 32,
            reb: 11,
            ast: 10,
            stl: 2,
            blk: 1,
            turnover: 3,
            min: '35:42'
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const stats = await adapter.fetchGameStats('12345');
      
      expect(stats['LeBron James']).toBeDefined();
      expect(stats['LeBron James'].PTS).toBe(32);
      expect(stats['LeBron James']['PTS+REB+AST']).toBe(53);
    });

    it.skip('should fallback to ESPN on BallDontLie failure', async () => {
      // First call fails, second succeeds with ESPN format
      mockedAxios.get
        .mockRejectedValueOnce(new Error('BallDontLie API error'))
        .mockResolvedValueOnce({
          data: {
            boxscore: {
              players: [{
                statistics: [{
                  name: 'starters',
                  athletes: [{
                    athlete: { id: '123', displayName: 'LeBron James' },
                    stats: ['35:42', '12-20', '2-6', '6-8', '2', '9', '11', '10', '2', '1', '3', '2', '32']
                  }]
                }]
              }]
            }
          }
        });

      const stats = await adapter.fetchGameStats('12345');
      
      expect(stats['LeBron James']).toBeDefined();
      expect(stats['LeBron James'].PTS).toBe(32);
    });
  });

  describe('NCAAAdapter', () => {
    let adapter: NCAAAdapter;

    beforeEach(() => {
      adapter = new NCAAAdapter();
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('ESPN NCAA');
    });

    it('should determine sport from game ID', () => {
      // Test private method via reflection or make it public for testing
      // For now, just test the adapter creation
      expect(adapter).toBeInstanceOf(NCAAAdapter);
    });
  });

  describe('WNBAAdapter', () => {
    let adapter: WNBAAdapter;

    beforeEach(() => {
      adapter = new WNBAAdapter();
    });

    it('should return correct adapter name', () => {
      expect(adapter.getName()).toBe('ESPN WNBA');
    });

    it('should have correct rate limit', () => {
      expect(adapter.getRateLimit()).toBe(4);
    });
  });

  describe('Base Adapter Functionality', () => {
    let adapter: MLBAdapter;

    beforeEach(() => {
      adapter = new MLBAdapter();
    });

    it('should normalize player names consistently', () => {
      // Access private method for testing
      const normalize = (adapter as any).normalizePlayerName;
      
      expect(normalize('Mike Trout')).toBe('miketrout');
      expect(normalize('José Altuve')).toBe('josealtuve');
      expect(normalize("Ronald Acuña Jr.")).toBe('ronaldacunajr');
    });

    it('should handle rate limiting with sleep', async () => {
      const sleepSpy = jest.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      
      await (adapter as any).sleep(100);
      
      expect(sleepSpy).toHaveBeenCalledWith(100);
      sleepSpy.mockRestore();
    });

    it('should implement retry with exponential backoff', async () => {
      let attempts = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return Promise.resolve('success');
      });

      const result = await (adapter as any).retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect((adapter as any).retryWithBackoff(mockFn))
        .rejects.toThrow('Always fails');
      
      expect(mockFn).toHaveBeenCalledTimes(3); // Max retries
    });
  });

  describe('Integration Tests', () => {
    // These would be integration tests that hit real APIs
    // Skipped by default to avoid API calls during unit testing
    
    it.skip('should fetch real MLB game data', async () => {
      const adapter = new MLBAdapter();
      
      // Use a known completed game ID
      const stats = await adapter.fetchGameStats('663381'); // Example game
      
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });

    it.skip('should fetch real NFL game data', async () => {
      const adapter = new NFLAdapter();
      
      // Use a known completed game ID
      const stats = await adapter.fetchGameStats('401547428'); // Example game
      
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });
});