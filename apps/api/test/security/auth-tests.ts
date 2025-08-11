import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick, createMockCapper } from '../utils/testData';

describe('Authentication & Authorization Security', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Authentication Security', () => {
    describe('Discord OAuth', () => {
      it('should validate OAuth state parameter', async () => {
        // Generate OAuth URL
        const state = Math.random().toString(36);
        const oauthUrl = `${process.env.APP_URL}/auth/discord?state=${state}`;

        // Try with invalid state
        const invalidResponse = await fetch(
          `${process.env.APP_URL}/auth/discord/callback?code=test&state=invalid`
        );
        expect(invalidResponse.status).toBe(400);

        // Try with valid state
        const validResponse = await fetch(
          `${process.env.APP_URL}/auth/discord/callback?code=test&state=${state}`
        );
        expect(validResponse.status).toBe(302); // Redirect to Discord
      });

      it('should prevent CSRF attacks', async () => {
        // Try without CSRF token
        const response1 = await fetch(`${process.env.APP_URL}/auth/discord/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        expect(response1.status).toBe(403);

        // Try with invalid CSRF token
        const response2 = await fetch(`${process.env.APP_URL}/auth/discord/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'invalid'
          }
        });
        expect(response2.status).toBe(403);
      });

      it('should validate OAuth tokens', async () => {
        // Try with expired token
        const expiredToken = jwt.sign(
          { sub: 'test', exp: Math.floor(Date.now() / 1000) - 3600 },
          'secret'
        );

        const response1 = await fetch(`${process.env.APP_URL}/api/user`, {
          headers: { 'Authorization': `Bearer ${expiredToken}` }
        });
        expect(response1.status).toBe(401);

        // Try with invalid signature
        const invalidToken = jwt.sign({ sub: 'test' }, 'wrong-secret');

        const response2 = await fetch(`${process.env.APP_URL}/api/user`, {
          headers: { 'Authorization': `Bearer ${invalidToken}` }
        });
        expect(response2.status).toBe(401);
      });
    });

    describe('Session Management', () => {
      it('should enforce secure session settings', async () => {
        const response = await fetch(`${process.env.APP_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: process.env.TEST_USERNAME,
            password: process.env.TEST_PASSWORD
          })
        });

        const cookies = response.headers.get('set-cookie');
        expect(cookies).toContain('Secure');
        expect(cookies).toContain('HttpOnly');
        expect(cookies).toContain('SameSite=Strict');
      });

      it('should handle concurrent sessions', async () => {
        // Create test user
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Create multiple sessions
        const sessions = await Promise.all(
          Array(5).fill(null).map(() =>
            fetch(`${process.env.APP_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: testUser.discord_username,
                password: 'test-password'
              })
            })
          )
        );

        // Verify session limits
        const validSessions = sessions.filter(s => s.ok);
        expect(validSessions.length).toBeLessThanOrEqual(3); // Max 3 concurrent sessions
      });

      it('should enforce session timeouts', async () => {
        const response = await fetch(`${process.env.APP_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: process.env.TEST_USERNAME,
            password: process.env.TEST_PASSWORD
          })
        });

        const cookies = response.headers.get('set-cookie');
        expect(cookies).toContain('Max-Age=3600'); // 1 hour timeout
      });
    });

    describe('Password Security', () => {
      it('should enforce password complexity', async () => {
        const weakPasswords = [
          'short',
          'nodigits',
          'no-special-chars',
          'NO-lower-case',
          'no-UPPER-case'
        ];

        const results = await Promise.all(
          weakPasswords.map(password =>
            fetch(`${process.env.APP_URL}/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: 'test',
                password
              })
            })
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent password reuse', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Change password
        const response1 = await fetch(`${process.env.APP_URL}/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldPassword: 'old-password',
            newPassword: 'new-password'
          })
        });
        expect(response1.ok).toBe(true);

        // Try to reuse old password
        const response2 = await fetch(`${process.env.APP_URL}/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldPassword: 'new-password',
            newPassword: 'old-password'
          })
        });
        expect(response2.status).toBe(400);
      });

      it('should handle password reset securely', async () => {
        // Request reset
        const response1 = await fetch(`${process.env.APP_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com'
          })
        });
        expect(response1.ok).toBe(true);

        // Try invalid token
        const response2 = await fetch(`${process.env.APP_URL}/auth/reset-password/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'invalid',
            newPassword: 'new-password'
          })
        });
        expect(response2.status).toBe(400);

        // Try expired token
        const expiredToken = jwt.sign(
          { sub: 'test', exp: Math.floor(Date.now() / 1000) - 3600 },
          'secret'
        );

        const response3 = await fetch(`${process.env.APP_URL}/auth/reset-password/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: expiredToken,
            newPassword: 'new-password'
          })
        });
        expect(response3.status).toBe(400);
      });
    });
  });

  describe('Authorization Security', () => {
    describe('Role-Based Access Control', () => {
      it('should enforce role-based permissions', async () => {
        // Create users with different roles
        const users = {
          admin: createMockUser({ role: 'admin' }),
          moderator: createMockUser({ role: 'moderator' }),
          user: createMockUser({ role: 'user' })
        };

        await supabase.from('users').insert(Object.values(users));

        // Test admin endpoints
        const adminEndpoints = [
          '/api/admin/users',
          '/api/admin/settings',
          '/api/admin/logs'
        ];

        for (const [role, user] of Object.entries(users)) {
          const results = await Promise.all(
            adminEndpoints.map(endpoint =>
              fetch(`${process.env.APP_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
              })
            )
          );

          if (role === 'admin') {
            results.forEach(r => expect(r.ok).toBe(true));
          } else {
            results.forEach(r => expect(r.status).toBe(403));
          }
        }
      });

      it('should prevent role escalation', async () => {
        const user = createMockUser({ role: 'user' });
        await supabase.from('users').insert(user);

        // Try to escalate role
        const response = await fetch(`${process.env.APP_URL}/api/users/role`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'admin' })
        });

        expect(response.status).toBe(403);
      });

      it('should handle nested permissions', async () => {
        const moderator = createMockUser({ role: 'moderator' });
        await supabase.from('users').insert(moderator);

        // Test nested resource access
        const resources = [
          '/api/forums/1/posts',              // Allowed
          '/api/forums/1/posts/1/edit',       // Allowed
          '/api/forums/1/settings',           // Denied
          '/api/forums/1/moderators/remove'   // Denied
        ];

        const results = await Promise.all(
          resources.map(resource =>
            fetch(`${process.env.APP_URL}${resource}`, {
              headers: { 'Authorization': `Bearer ${moderator.token}` }
            })
          )
        );

        expect(results[0].ok).toBe(true);
        expect(results[1].ok).toBe(true);
        expect(results[2].status).toBe(403);
        expect(results[3].status).toBe(403);
      });
    });

    describe('Resource Access Control', () => {
      it('should enforce resource ownership', async () => {
        // Create users and their resources
        const user1 = createMockUser();
        const user2 = createMockUser();
        await supabase.from('users').insert([user1, user2]);

        const pick = createMockPick({ capper_discord_id: user1.discord_id });
        await supabase.from('daily_picks').insert(pick);

        // Try to access other user's resource
        const response = await fetch(`${process.env.APP_URL}/api/picks/${pick.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user2.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'graded' })
        });

        expect(response.status).toBe(403);
      });

      it('should handle shared resources', async () => {
        // Create users and shared resource
        const owner = createMockUser();
        const collaborator = createMockUser();
        await supabase.from('users').insert([owner, collaborator]);

        const pick = createMockPick({
          capper_discord_id: owner.discord_id,
          shared_with: [collaborator.discord_id]
        });
        await supabase.from('daily_picks').insert(pick);

        // Test collaborator access
        const response = await fetch(`${process.env.APP_URL}/api/picks/${pick.id}`, {
          headers: { 'Authorization': `Bearer ${collaborator.token}` }
        });

        expect(response.ok).toBe(true);
      });

      it('should enforce resource scoping', async () => {
        const user = createMockUser({ tier: 'free' });
        await supabase.from('users').insert(user);

        // Try to access premium resources
        const premiumEndpoints = [
          '/api/picks/premium',
          '/api/analytics/advanced',
          '/api/ai/analysis'
        ];

        const results = await Promise.all(
          premiumEndpoints.map(endpoint =>
            fetch(`${process.env.APP_URL}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${user.token}` }
            })
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(403);
        });
      });
    });

    describe('API Authorization', () => {
      it('should validate API keys', async () => {
        // Try invalid API key
        const response1 = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          headers: { 'X-API-Key': 'invalid' }
        });
        expect(response1.status).toBe(401);

        // Try expired API key
        const response2 = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          headers: { 'X-API-Key': 'expired-key' }
        });
        expect(response2.status).toBe(401);

        // Try valid API key
        const response3 = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          headers: { 'X-API-Key': process.env.TEST_API_KEY }
        });
        expect(response3.ok).toBe(true);
      });

      it('should enforce API rate limits', async () => {
        const requests = Array(100).fill(null).map(() =>
          fetch(`${process.env.APP_URL}/api/v1/data`, {
            headers: { 'X-API-Key': process.env.TEST_API_KEY }
          })
        );

        const results = await Promise.all(requests);
        const rateLimited = results.filter(r => r.status === 429);

        expect(rateLimited.length).toBeGreaterThan(0);
      });

      it('should scope API access', async () => {
        const readOnlyKey = 'read-only-key';
        const writeKey = 'write-key';

        // Test read-only key
        const readResponse = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          headers: { 'X-API-Key': readOnlyKey }
        });
        expect(readResponse.ok).toBe(true);

        const writeResponse = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          method: 'POST',
          headers: {
            'X-API-Key': readOnlyKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: 'test' })
        });
        expect(writeResponse.status).toBe(403);

        // Test write key
        const writeResponse2 = await fetch(`${process.env.APP_URL}/api/v1/data`, {
          method: 'POST',
          headers: {
            'X-API-Key': writeKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: 'test' })
        });
        expect(writeResponse2.ok).toBe(true);
      });
    });
  });
}); 