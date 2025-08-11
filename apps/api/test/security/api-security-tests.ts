import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('API Security', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Input Validation', () => {
    describe('Parameter Validation', () => {
      it('should validate query parameters', async () => {
        const invalidQueries = [
          '?limit=abc',              // Non-numeric
          '?limit=-1',               // Negative number
          '?limit=1000000',          // Too large
          '?sort=invalid_field',     // Invalid field
          '?filter=invalid:value'    // Invalid filter
        ];

        const results = await Promise.all(
          invalidQueries.map(query =>
            fetch(`${process.env.APP_URL}/api/picks${query}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent SQL injection', async () => {
        const maliciousQueries = [
          "?id=1' OR '1'='1",
          "?name=test'; DROP TABLE users;--",
          "?search=test' UNION SELECT * FROM users--"
        ];

        const results = await Promise.all(
          maliciousQueries.map(query =>
            fetch(`${process.env.APP_URL}/api/users${query}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should validate path parameters', async () => {
        const invalidPaths = [
          '/api/users/invalid_id',
          '/api/users/../../secrets',
          '/api/users/<script>alert(1)</script>'
        ];

        const results = await Promise.all(
          invalidPaths.map(path =>
            fetch(`${process.env.APP_URL}${path}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });
    });

    describe('Body Validation', () => {
      it('should validate request body schema', async () => {
        const invalidBodies = [
          {},                                    // Empty
          { invalid_field: 'value' },           // Unknown field
          { username: 123 },                    // Wrong type
          { username: 'a'.repeat(1000) }        // Too long
        ];

        const results = await Promise.all(
          invalidBodies.map(body =>
            fetch(`${process.env.APP_URL}/api/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            })
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent XSS attacks', async () => {
        const maliciousData = [
          { name: '<script>alert(1)</script>' },
          { name: 'javascript:alert(1)' },
          { name: 'data:text/html,<script>alert(1)</script>' }
        ];

        const results = await Promise.all(
          maliciousData.map(data =>
            fetch(`${process.env.APP_URL}/api/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should validate nested objects', async () => {
        const invalidData = {
          user: {
            profile: {
              age: 'invalid',
              settings: {
                theme: 123,
                notifications: 'invalid'
              }
            }
          }
        };

        const response = await fetch(`${process.env.APP_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.details).toContain('age');
        expect(error.details).toContain('theme');
        expect(error.details).toContain('notifications');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce IP-based rate limits', async () => {
      const requests = Array(100).fill(null).map(() =>
        fetch(`${process.env.APP_URL}/api/public/data`)
      );

      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should enforce user-based rate limits', async () => {
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      const requests = Array(100).fill(null).map(() =>
        fetch(`${process.env.APP_URL}/api/users/data`, {
          headers: { 'Authorization': `Bearer ${testUser.token}` }
        })
      );

      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should enforce endpoint-specific limits', async () => {
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      const sensitiveEndpoints = [
        '/api/users/password',
        '/api/payment/process',
        '/api/admin/settings'
      ];

      for (const endpoint of sensitiveEndpoints) {
        const requests = Array(10).fill(null).map(() =>
          fetch(`${process.env.APP_URL}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${testUser.token}` }
          })
        );

        const results = await Promise.all(requests);
        const rateLimited = results.filter(r => r.status === 429);

        expect(rateLimited.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should sanitize error responses', async () => {
      const errorTriggers = [
        '/api/debug/error',
        '/api/users/invalid',
        '/api/data/missing'
      ];

      const results = await Promise.all(
        errorTriggers.map(path =>
          fetch(`${process.env.APP_URL}${path}`)
        )
      );

      results.forEach(async response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        const error = await response.json();
        expect(error.message).toBeTruthy();
        expect(error.stack).toBeUndefined();
        expect(error.details).not.toContain('at ');
      });
    });

    it('should log errors securely', async () => {
      // Trigger error
      await fetch(`${process.env.APP_URL}/api/debug/error`);

      // Check error logs
      const { data: logs } = await supabase
        .from('error_logs')
        .select()
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      expect(logs.error_id).toBeTruthy();
      expect(logs.message).toBeTruthy();
      expect(logs.stack_trace).toBeTruthy();
      expect(logs.sensitive_data).toBeNull();
    });

    it('should handle different error types appropriately', async () => {
      const errorScenarios = [
        { path: '/api/validation/error', expectedStatus: 400 },
        { path: '/api/auth/error', expectedStatus: 401 },
        { path: '/api/permission/error', expectedStatus: 403 },
        { path: '/api/notfound/error', expectedStatus: 404 },
        { path: '/api/conflict/error', expectedStatus: 409 },
        { path: '/api/server/error', expectedStatus: 500 }
      ];

      for (const scenario of errorScenarios) {
        const response = await fetch(`${process.env.APP_URL}${scenario.path}`);
        expect(response.status).toBe(scenario.expectedStatus);

        const error = await response.json();
        expect(error.code).toBeTruthy();
        expect(error.message).toBeTruthy();
        expect(error.type).toBeTruthy();
      }
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await fetch(process.env.APP_URL!);
      const headers = response.headers;

      expect(headers.get('x-content-type-options')).toBe('nosniff');
      expect(headers.get('x-frame-options')).toBe('DENY');
      expect(headers.get('x-xss-protection')).toBe('1; mode=block');
      expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(headers.get('content-security-policy')).toBeTruthy();
    });

    it('should set CORS headers', async () => {
      const response = await fetch(process.env.APP_URL!, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://allowed-origin.com',
          'Access-Control-Request-Method': 'POST'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://allowed-origin.com');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toBeTruthy();
      expect(response.headers.get('access-control-max-age')).toBeTruthy();
    });

    it('should validate origin', async () => {
      const origins = [
        'https://allowed-origin.com',
        'https://another-allowed.com',
        'https://malicious.com'
      ];

      const results = await Promise.all(
        origins.map(origin =>
          fetch(process.env.APP_URL!, {
            headers: { 'Origin': origin }
          })
        )
      );

      expect(results[0].headers.get('access-control-allow-origin')).toBe(origins[0]);
      expect(results[1].headers.get('access-control-allow-origin')).toBe(origins[1]);
      expect(results[2].headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('API Versioning', () => {
    it('should handle version deprecation', async () => {
      const versions = ['v1', 'v2', 'v3'];

      const results = await Promise.all(
        versions.map(version =>
          fetch(`${process.env.APP_URL}/api/${version}/resource`)
        )
      );

      // v1 is deprecated
      expect(results[0].headers.get('x-api-deprecated')).toBeTruthy();
      expect(results[0].headers.get('x-api-sunset')).toBeTruthy();

      // v2 and v3 are active
      expect(results[1].headers.get('x-api-deprecated')).toBeNull();
      expect(results[2].headers.get('x-api-deprecated')).toBeNull();
    });

    it('should validate version-specific features', async () => {
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Feature only available in v2+
      const response1 = await fetch(`${process.env.APP_URL}/api/v1/new-feature`, {
        headers: { 'Authorization': `Bearer ${testUser.token}` }
      });
      expect(response1.status).toBe(404);

      // Feature available in v2
      const response2 = await fetch(`${process.env.APP_URL}/api/v2/new-feature`, {
        headers: { 'Authorization': `Bearer ${testUser.token}` }
      });
      expect(response2.ok).toBe(true);
    });

    it('should handle version fallbacks', async () => {
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Old endpoint with fallback
      const response = await fetch(`${process.env.APP_URL}/api/v1/legacy-endpoint`, {
        headers: { 'Authorization': `Bearer ${testUser.token}` }
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('x-api-version-used')).toBe('v2');
    });
  });
}); 