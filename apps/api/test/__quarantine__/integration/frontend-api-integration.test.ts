import axios from 'axios';

import { createMockPick, createMockCapper, createMockUser } from '../utils/testData';

// Initialize API client
const apiClient = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

describe('Frontend ↔ Backend API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const response = await apiClient.post('/auth/login', {
      username: process.env.TEST_USERNAME,
      password: process.env.TEST_PASSWORD,
    });
    authToken = response.data.token;
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  });

  afterEach(async () => {
    // Clean up test data
    await apiClient.post('/test/cleanup');
  });

  describe('Authentication Flow', () => {
    it('should handle user login', async () => {
      const response = await apiClient.post('/auth/login', {
        username: process.env.TEST_USERNAME,
        password: process.env.TEST_PASSWORD,
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            id: expect.any(String),
            username: expect.any(String),
          }),
        })
      );
    });

    it('should handle token refresh', async () => {
      const response = await apiClient.post('/auth/refresh', {
        refreshToken: authToken,
      });

      expect(response.status).toBe(200);
      expect(response.data.token).toBeTruthy();
    });

    it('should handle invalid credentials', async () => {
      try {
        await apiClient.post('/auth/login', {
          username: 'invalid',
          password: 'invalid',
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('User Profile Operations', () => {
    it('should fetch user profile', async () => {
      const response = await apiClient.get('/users/profile');

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          username: expect.any(String),
          tier: expect.any(String),
        })
      );
    });

    it('should update user preferences', async () => {
      const preferences = {
        notifications: {
          email: true,
          discord: true,
          sms: false,
        },
        theme: 'dark',
      };

      const response = await apiClient.put('/users/preferences', preferences);

      expect(response.status).toBe(200);
      expect(response.data.preferences).toEqual(preferences);
    });

    it('should handle missing profile', async () => {
      // Use client without auth token
      const unauthClient = axios.create({
        baseURL: process.env.API_URL,
      });

      try {
        await unauthClient.get('/users/profile');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Pick Management', () => {
    it('should fetch user picks', async () => {
      const response = await apiClient.get('/picks', {
        params: {
          status: 'active',
          limit: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        picks: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            status: expect.any(String),
            type: expect.any(String),
          }),
        ]),
        total: expect.any(Number),
      });
    });

    it('should submit new pick', async () => {
      const testPick = createMockPick();
      const response = await apiClient.post('/picks', testPick);

      expect(response.status).toBe(201);
      expect(response.data.pick).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          status: 'pending',
        })
      );
    });

    it('should update pick status', async () => {
      // Create test pick
      const testPick = createMockPick();
      const {
        data: { pick },
      } = await apiClient.post('/picks', testPick);

      // Update status
      const response = await apiClient.put(`/picks/${pick.id}`, {
        status: 'finalized',
        result: 'win',
      });

      expect(response.status).toBe(200);
      expect(response.data.pick.status).toBe('graded');
      expect(response.data.pick.result).toBe('win');
    });

    it('should handle validation errors', async () => {
      const invalidPick = {
        type: 'invalid',
        odds: 'not-a-number',
      };

      try {
        await apiClient.post('/picks', invalidPick);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.errors).toBeTruthy();
      }
    });
  });

  describe('Analytics Dashboard', () => {
    it('should fetch performance metrics', async () => {
      const response = await apiClient.get('/analytics/performance', {
        params: {
          timeframe: '30d',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.objectContaining({
          wins: expect.any(Number),
          losses: expect.any(Number),
          roi: expect.any(Number),
          winRate: expect.any(Number),
        })
      );
    });

    it('should fetch historical data', async () => {
      const response = await apiClient.get('/analytics/history', {
        params: {
          start: '2024-01-01',
          end: '2024-12-31',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            picks: expect.any(Number),
            winRate: expect.any(Number),
          }),
        ]),
      });
    });

    it('should handle invalid date ranges', async () => {
      try {
        await apiClient.get('/analytics/history', {
          params: {
            start: 'invalid-date',
            end: '2024-12-31',
          },
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should establish WebSocket connection', async () => {
      const ws = new WebSocket(`${process.env.WS_URL}?token=${authToken}`);

      await new Promise(resolve => {
        ws.onopen = () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve(true);
        };
      });

      ws.close();
    });

    it('should receive pick updates', async () => {
      const ws = new WebSocket(`${process.env.WS_URL}?token=${authToken}`);

      // Create test pick
      const testPick = createMockPick();
      const {
        data: { pick },
      } = await apiClient.post('/picks', testPick);

      // Wait for update notification
      const update = await new Promise(resolve => {
        ws.onmessage = event => {
          resolve(JSON.parse(event.data));
        };
      });

      expect(update).toEqual(
        expect.objectContaining({
          type: 'pick_created',
          data: expect.objectContaining({
            id: pick.id,
          }),
        })
      );

      ws.close();
    });

    it('should handle connection errors', async () => {
      const invalidWs = new WebSocket(`${process.env.WS_URL}?token=invalid`);

      await new Promise(resolve => {
        invalidWs.onerror = error => {
          expect(error).toBeTruthy();
          resolve(true);
        };
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      const requests = Array(100)
        .fill(null)
        .map(() => apiClient.get('/picks'));

      const results = await Promise.allSettled(requests);
      const tooManyRequests = results.filter(
        r => r.status === 'rejected' && (r.reason as any).response?.status === 429
      );

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should handle server errors', async () => {
      try {
        await apiClient.get('/test/trigger-error');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toBeTruthy();
      }
    });

    it('should handle network errors', async () => {
      const invalidClient = axios.create({
        baseURL: 'http://invalid-url',
        timeout: 1000,
      });

      try {
        await invalidClient.get('/picks');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });

  describe('API Performance', () => {
    it('should respond within timeout', async () => {
      const startTime = Date.now();
      const timeout = 1000; // 1 second

      const response = await apiClient.get('/picks');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(timeout);
      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests', async () => {
      const startTime = Date.now();
      const requests = [
        apiClient.get('/picks'),
        apiClient.get('/users/profile'),
        apiClient.get('/analytics/performance'),
      ];

      const responses = await Promise.all(requests);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // 3 seconds
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain response time under load', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await apiClient.get('/picks');
        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(500); // 500ms average
    });
  });
});
