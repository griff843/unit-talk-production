/**
 * Unit Talk SaaS - Comprehensive Test Suite
 * Production-ready automated testing
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { SecurityManager, InputValidator, AbuseProtection, EncryptionUtils, RateLimiter } from '../src/security/index.js';
import { RecapAgent } from '../src/utils/recapStub.js';
import { ManagerStub } from '../src/utils/managerStub.js';
import { createSOP, createKPI } from '../src/services/operatorHelpers.js';

// Mock Supabase for testing
jest.mock('../src/services/supabaseClient.js', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: '1', role: 'admin', status: 'active' }, error: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }
}));

describe('Security Module Tests', () => {
  describe('InputValidator', () => {
    test('should sanitize string input correctly', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = InputValidator.sanitizeString(input, 50);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello World');
    });

    test('should validate email addresses correctly', () => {
      expect(InputValidator.validateEmail('test@example.com')).toBe(true);
      expect(InputValidator.validateEmail('invalid-email')).toBe(false);
      expect(InputValidator.validateEmail('test@')).toBe(false);
    });

    test('should validate pick data correctly', () => {
      const validPick = {
        game_id: 123,
        bet_type: 'spread',
        selection: 'Team A -3.5',
        confidence: 4
      };
      
      const result = InputValidator.validatePickData(validPick);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid pick data', () => {
      const invalidPick = {
        game_id: 'not-a-number',
        bet_type: '',
        selection: null
      };
      
      const result = InputValidator.validatePickData(invalidPick);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('SecurityManager', () => {
    test('should verify valid tokens', async () => {
      const result = await SecurityManager.verifyToken('valid-token-123');
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });

    test('should reject invalid tokens', async () => {
      const result = await SecurityManager.verifyToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should check user roles correctly', () => {
      const adminUser = { id: '1', role: 'admin', status: 'active' };
      const regularUser = { id: '2', role: 'user', status: 'active' };
      
      expect(SecurityManager.isAdmin(adminUser)).toBe(true);
      expect(SecurityManager.isAdmin(regularUser)).toBe(false);
    });
  });

  describe('AbuseProtection', () => {
    test('should detect suspicious SQL injection attempts', () => {
      const suspiciousInput = "'; DROP TABLE users; --";
      expect(AbuseProtection.detectSuspiciousInput(suspiciousInput)).toBe(true);
    });

    test('should detect XSS attempts', () => {
      const xssInput = '<script>alert("xss")</script>';
      expect(AbuseProtection.detectSuspiciousInput(xssInput)).toBe(true);
    });

    test('should allow normal input', () => {
      const normalInput = 'This is a normal comment about the game';
      expect(AbuseProtection.detectSuspiciousInput(normalInput)).toBe(false);
    });
  });

  describe('EncryptionUtils', () => {
    test('should hash and verify passwords correctly', () => {
      const password = 'testPassword123';
      const hashed = EncryptionUtils.hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(EncryptionUtils.verifyPassword(password, hashed)).toBe(true);
      expect(EncryptionUtils.verifyPassword('wrongPassword', hashed)).toBe(false);
    });

    test('should generate secure tokens', () => {
      const token1 = EncryptionUtils.generateSecureToken();
      const token2 = EncryptionUtils.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('RateLimiter', () => {
    test('should allow requests within limit', () => {
      const ip = '192.168.1.1';
      expect(RateLimiter.checkRateLimit(ip, 5, 60000)).toBe(true);
      expect(RateLimiter.checkRateLimit(ip, 5, 60000)).toBe(true);
    });

    test('should block requests exceeding limit', () => {
      const ip = '192.168.1.2';
      // Make 5 requests (should all pass)
      for (let i = 0; i < 5; i++) {
        expect(RateLimiter.checkRateLimit(ip, 5, 60000)).toBe(true);
      }
      // 6th request should be blocked
      expect(RateLimiter.checkRateLimit(ip, 5, 60000)).toBe(false);
    });
  });
});

describe('Agent System Tests', () => {
  let recapAgent: RecapAgent;
  let managerStub: ManagerStub;

  beforeAll(async () => {
    recapAgent = new RecapAgent();
    managerStub = new ManagerStub();
    
    await recapAgent.initialize();
    await managerStub.initialize();
  });

  afterAll(async () => {
    await recapAgent.cleanup();
    await managerStub.cleanup();
  });

  describe('RecapAgent', () => {
    test('should initialize successfully', async () => {
      expect(recapAgent).toBeDefined();
      const health = await recapAgent.checkHealth();
      expect(health.status).toBe('healthy');
    });

    test('should process game data correctly', async () => {
      const gameData = {
        game_id: 123,
        home_team: 'Team A',
        away_team: 'Team B',
        final_score: '21-14',
        game_date: new Date().toISOString()
      };

      const result = await recapAgent.process(gameData);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should collect metrics', async () => {
      const metrics = await recapAgent.collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.processed_games).toBeDefined();
      expect(metrics.success_rate).toBeDefined();
    });
  });

  describe('ManagerStub', () => {
    test('should initialize successfully', async () => {
      expect(managerStub).toBeDefined();
      const health = await managerStub.checkHealth();
      expect(health.status).toBe('healthy');
    });

    test('should manage agents correctly', async () => {
      const task = {
        type: 'process_game',
        data: { game_id: 123 },
        priority: 'high'
      };

      const result = await managerStub.process(task);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should collect system metrics', async () => {
      const metrics = await managerStub.collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.active_agents).toBeDefined();
      expect(metrics.queue_size).toBeDefined();
    });
  });
});

describe('Operator Helpers Tests', () => {
  describe('SOP Management', () => {
    test('should create SOP successfully', async () => {
      const title = 'Test SOP';
      const content = 'This is a test standard operating procedure';
      
      const sopId = await createSOP(title, content);
      expect(sopId).toBeDefined();
      expect(typeof sopId).toBe('string');
    });
  });

  describe('KPI Management', () => {
    test('should create KPI successfully', async () => {
      const name = 'Test KPI';
      const target = 100;
      const current = 75;
      const unit = 'percentage';
      
      const kpiId = await createKPI(name, target, current, unit);
      expect(kpiId).toBeDefined();
      expect(typeof kpiId).toBe('string');
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete user workflow', async () => {
    // Simulate user registration and pick submission
    const userData = {
      email: 'test@example.com',
      display_name: 'Test User'
    };

    const userValidation = InputValidator.validateUserData(userData);
    expect(userValidation.isValid).toBe(true);

    const pickData = {
      game_id: 123,
      bet_type: 'spread',
      selection: 'Team A -3.5',
      confidence: 4,
      reasoning: 'Team A has better stats'
    };

    const pickValidation = InputValidator.validatePickData(pickData);
    expect(pickValidation.isValid).toBe(true);
  });

  test('should handle security threats correctly', async () => {
    const maliciousData = {
      game_id: 123,
      bet_type: '<script>alert("xss")</script>',
      selection: "'; DROP TABLE picks; --",
      reasoning: 'javascript:alert("xss")'
    };

    const validation = InputValidator.validatePickData(maliciousData);
    expect(validation.isValid).toBe(true); // Should be valid after sanitization
    expect(maliciousData.bet_type).not.toContain('<script>');
    expect(maliciousData.selection).not.toContain('DROP TABLE');
  });
});

describe('Performance Tests', () => {
  test('should handle high load efficiently', async () => {
    const startTime = Date.now();
    const promises = [];

    // Simulate 100 concurrent operations
    for (let i = 0; i < 100; i++) {
      promises.push(InputValidator.validateEmail(`test${i}@example.com`));
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  test('should maintain performance under rate limiting', () => {
    const startTime = Date.now();
    
    // Test rate limiter performance
    for (let i = 0; i < 1000; i++) {
      RateLimiter.checkRateLimit(`192.168.1.${i % 255}`, 100, 60000);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100); // Should be very fast
  });
});

export default {
  SecurityManager,
  InputValidator,
  AbuseProtection,
  EncryptionUtils,
  RateLimiter,
  RecapAgent,
  ManagerStub,
  createSOP,
  createKPI
};