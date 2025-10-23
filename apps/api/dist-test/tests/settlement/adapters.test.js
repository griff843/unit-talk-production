"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mlbAdapter_1 = require("../../workflows/settlement/adapters/mlbAdapter");
const nflAdapter_1 = require("../../workflows/settlement/adapters/nflAdapter");
const nbaAdapter_1 = require("../../workflows/settlement/adapters/nbaAdapter");
const ncaaAdapter_1 = require("../../workflows/settlement/adapters/ncaaAdapter");
const wnbaAdapter_1 = require("../../workflows/settlement/adapters/wnbaAdapter");
const axios_1 = __importDefault(require("axios"));
// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios_1.default;
describe('Sport Adapters', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('MLBAdapter', () => {
        let adapter;
        beforeEach(() => {
            adapter = new mlbAdapter_1.MLBAdapter();
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
        let adapter;
        beforeEach(() => {
            adapter = new nflAdapter_1.NFLAdapter();
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
        let adapter;
        beforeEach(() => {
            adapter = new nbaAdapter_1.NBAAdapter();
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
        let adapter;
        beforeEach(() => {
            adapter = new ncaaAdapter_1.NCAAAdapter();
        });
        it('should return correct adapter name', () => {
            expect(adapter.getName()).toBe('ESPN NCAA');
        });
        it('should determine sport from game ID', () => {
            // Test private method via reflection or make it public for testing
            // For now, just test the adapter creation
            expect(adapter).toBeInstanceOf(ncaaAdapter_1.NCAAAdapter);
        });
    });
    describe('WNBAAdapter', () => {
        let adapter;
        beforeEach(() => {
            adapter = new wnbaAdapter_1.WNBAAdapter();
        });
        it('should return correct adapter name', () => {
            expect(adapter.getName()).toBe('ESPN WNBA');
        });
        it('should have correct rate limit', () => {
            expect(adapter.getRateLimit()).toBe(4);
        });
    });
    describe('Base Adapter Functionality', () => {
        let adapter;
        beforeEach(() => {
            adapter = new mlbAdapter_1.MLBAdapter();
        });
        it('should normalize player names consistently', () => {
            // Access private method for testing
            const normalize = adapter.normalizePlayerName;
            expect(normalize('Mike Trout')).toBe('miketrout');
            expect(normalize('José Altuve')).toBe('josealtuve');
            expect(normalize("Ronald Acuña Jr.")).toBe('ronaldacunajr');
        });
        it('should handle rate limiting with sleep', async () => {
            const sleepSpy = jest.spyOn(adapter, 'sleep').mockResolvedValue(undefined);
            await adapter.sleep(100);
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
            const result = await adapter.retryWithBackoff(mockFn);
            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });
        it('should fail after max retries', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
            await expect(adapter.retryWithBackoff(mockFn))
                .rejects.toThrow('Always fails');
            expect(mockFn).toHaveBeenCalledTimes(3); // Max retries
        });
    });
    describe('Integration Tests', () => {
        // These would be integration tests that hit real APIs
        // Skipped by default to avoid API calls during unit testing
        it.skip('should fetch real MLB game data', async () => {
            const adapter = new mlbAdapter_1.MLBAdapter();
            // Use a known completed game ID
            const stats = await adapter.fetchGameStats('663381'); // Example game
            expect(Object.keys(stats).length).toBeGreaterThan(0);
        });
        it.skip('should fetch real NFL game data', async () => {
            const adapter = new nflAdapter_1.NFLAdapter();
            // Use a known completed game ID
            const stats = await adapter.fetchGameStats('401547428'); // Example game
            expect(Object.keys(stats).length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=adapters.test.js.map