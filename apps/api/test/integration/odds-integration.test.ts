import axios from 'axios';

import { createMockPick } from '../utils/testData';

// Initialize API clients
const optimalClient = axios.create({
  baseURL: process.env.OPTIMAL_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.OPTIMAL_API_KEY}`
  }
});

const sgoClient = axios.create({
  baseURL: process.env.SGO_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.SGO_API_KEY}`
  }
});

const oddsApiClient = axios.create({
  baseURL: process.env.ODDS_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.ODDS_API_KEY}`
  }
});

describe('Odds Provider Integration', () => {
  describe('Optimal API Integration', () => {
    it('should fetch live odds', async () => {
      const response = await optimalClient.get('/odds/live', {
        params: {
          sport: 'NBA',
          market: 'spread'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            game_id: expect.any(String),
            home_team: expect.any(String),
            away_team: expect.any(String),
            spread: expect.any(Number),
            odds: expect.any(Number)
          })
        ])
      );
    });

    it('should fetch historical odds', async () => {
      const date = new Date().toISOString().split('T')[0];
      const response = await optimalClient.get('/odds/historical', {
        params: {
          sport: 'NBA',
          date,
          market: 'spread'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            game_id: expect.any(String),
            timestamp: expect.any(String),
            spread: expect.any(Number),
            odds: expect.any(Number)
          })
        ])
      );
    });

    it('should handle API errors gracefully', async () => {
      const invalidClient = axios.create({
        baseURL: process.env.OPTIMAL_API_URL,
        headers: {
          'Authorization': 'invalid-key'
        }
      });

      try {
        await invalidClient.get('/odds/live');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('SGO API Integration', () => {
    it('should fetch live odds', async () => {
      const response = await sgoClient.get('/odds/live', {
        params: {
          league: 'NBA',
          type: 'spread'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event_id: expect.any(String),
            teams: expect.arrayContaining([
              expect.any(String)
            ]),
            line: expect.any(Number),
            price: expect.any(Number)
          })
        ])
      );
    });

    it('should fetch line movement', async () => {
      const response = await sgoClient.get('/odds/movement', {
        params: {
          event_id: 'test-event',
          type: 'spread'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.any(String),
            line: expect.any(Number),
            price: expect.any(Number)
          })
        ])
      );
    });

    it('should handle API errors gracefully', async () => {
      const invalidClient = axios.create({
        baseURL: process.env.SGO_API_URL,
        headers: {
          'Authorization': 'invalid-key'
        }
      });

      try {
        await invalidClient.get('/odds/live');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Odds API Integration', () => {
    it('should fetch live odds', async () => {
      const response = await oddsApiClient.get('/odds/live', {
        params: {
          sport: 'basketball_nba',
          regions: 'us',
          markets: 'spreads'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            sport_key: 'basketball_nba',
            home_team: expect.any(String),
            away_team: expect.any(String),
            bookmakers: expect.arrayContaining([
              expect.objectContaining({
                key: expect.any(String),
                markets: expect.arrayContaining([
                  expect.objectContaining({
                    key: 'spreads',
                    outcomes: expect.any(Array)
                  })
                ])
              })
            ])
          })
        ])
      );
    });

    it('should fetch odds by sport', async () => {
      const response = await oddsApiClient.get('/sports', {
        params: {
          sport: 'basketball_nba'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.objectContaining({
          key: 'basketball_nba',
          active: expect.any(Boolean),
          group: 'Basketball',
          description: expect.any(String)
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const invalidClient = axios.create({
        baseURL: process.env.ODDS_API_URL,
        headers: {
          'Authorization': 'invalid-key'
        }
      });

      try {
        await invalidClient.get('/odds/live');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Odds Comparison', () => {
    it('should compare odds across providers', async () => {
      const [optimalOdds, sgoOdds, oddsApiOdds] = await Promise.all([
        optimalClient.get('/odds/live', {
          params: {
            sport: 'NBA',
            market: 'spread'
          }
        }),
        sgoClient.get('/odds/live', {
          params: {
            league: 'NBA',
            type: 'spread'
          }
        }),
        oddsApiClient.get('/odds/live', {
          params: {
            sport: 'basketball_nba',
            regions: 'us',
            markets: 'spreads'
          }
        })
      ]);

      // Verify all providers returned data
      expect(optimalOdds.data).toBeTruthy();
      expect(sgoOdds.data).toBeTruthy();
      expect(oddsApiOdds.data).toBeTruthy();

      // Compare odds for consistency
      const optimalGame = optimalOdds.data[0];
      const sgoGame = sgoOdds.data[0];
      const oddsApiGame = oddsApiOdds.data[0];

      expect(Math.abs(optimalGame.spread - sgoGame.line)).toBeLessThan(1);
      expect(Math.abs(optimalGame.odds - sgoGame.price)).toBeLessThan(10);
    });

    it('should handle provider failures gracefully', async () => {
      const results = await Promise.allSettled([
        // Optimal (should fail)
        axios.create({
          baseURL: process.env.OPTIMAL_API_URL,
          headers: { 'Authorization': 'invalid-key' }
        }).get('/odds/live'),

        // SGO (should succeed)
        sgoClient.get('/odds/live', {
          params: {
            league: 'NBA',
            type: 'spread'
          }
        }),

        // Odds API (should fail)
        axios.create({
          baseURL: process.env.ODDS_API_URL,
          headers: { 'Authorization': 'invalid-key' }
        }).get('/odds/live')
      ]);

      // At least one provider should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
      // Some providers should fail
      expect(results.some(r => r.status === 'rejected')).toBe(true);
    });
  });

  describe('Odds Processing', () => {
    it('should normalize odds formats', () => {
      const odds = {
        american: -110,
        decimal: 1.91,
        fractional: '10/11'
      };

      expect(toAmerican(odds.decimal)).toBe(-110);
      expect(toAmerican(odds.fractional)).toBe(-110);
      expect(toDecimal(odds.american)).toBe(1.91);
      expect(toFractional(odds.american)).toBe('10/11');
    });

    it('should validate odds values', () => {
      expect(isValidOdds(-110)).toBe(true);
      expect(isValidOdds(1.91)).toBe(true);
      expect(isValidOdds('10/11')).toBe(true);
      expect(isValidOdds('invalid')).toBe(false);
    });

    it('should calculate implied probability', () => {
      expect(calculateImpliedProbability(-110)).toBeCloseTo(0.524, 3);
      expect(calculateImpliedProbability(1.91)).toBeCloseTo(0.524, 3);
      expect(calculateImpliedProbability('10/11')).toBeCloseTo(0.524, 3);
    });
  });
});

// Helper functions
function toAmerican(odds: number | string): number {
  if (typeof odds === 'number') {
    // Convert from decimal
    return odds >= 2 ? Math.round((odds - 1) * 100) : Math.round(-100 / (odds - 1));
  } else {
    // Convert from fractional
    const [num, den] = odds.split('/').map(Number);
    const decimal = num / den + 1;
    return toAmerican(decimal);
  }
}

function toDecimal(odds: number): number {
  return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
}

function toFractional(odds: number): string {
  const decimal = toDecimal(odds);
  const fraction = decimalToFraction(decimal - 1);
  return `${fraction[0]}/${fraction[1]}`;
}

function isValidOdds(odds: any): boolean {
  if (typeof odds === 'number') {
    return !isNaN(odds) && odds !== 0;
  }
  if (typeof odds === 'string') {
    const parts = odds.split('/').map(Number);
    return parts.length === 2 && !parts.some(isNaN);
  }
  return false;
}

function calculateImpliedProbability(odds: number | string): number {
  const decimal = typeof odds === 'number' ? toDecimal(odds) : toDecimal(toAmerican(odds));
  return 1 / decimal;
}

function decimalToFraction(decimal: number): [number, number] {
  const tolerance = 1.0E-6;
  const h = [1, 0];
  const k = [0, 1];
  let a = Math.floor(decimal);
  let x = decimal - a;
  
  while (x !== 0) {
    const y = 1 / x;
    a = Math.floor(y);
    
    let tmp = h[0];
    h[0] = a * h[0] + h[1];
    h[1] = tmp;
    
    tmp = k[0];
    k[0] = a * k[0] + k[1];
    k[1] = tmp;
    
    x = y - a;
    
    if (Math.abs(decimal - h[0] / k[0]) < tolerance) {
      return [h[0], k[0]];
    }
  }
  
  return [h[0], k[0]];
} 