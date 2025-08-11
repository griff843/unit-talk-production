import crypto from 'crypto';

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser } from '../utils/testData';

describe('Penetration Testing', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Authentication Attacks', () => {
    describe('Brute Force Prevention', () => {
      it('should prevent password brute force', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        const attempts = Array(10).fill(null).map((_, i) =>
          fetch(`${process.env.APP_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: testUser.discord_username,
              password: `wrong-password-${i}`
            })
          })
        );

        const results = await Promise.all(attempts);
        const lastResponse = await results[results.length - 1].json();

        expect(results.some(r => r.status === 429)).toBe(true);
        expect(lastResponse.lockout_duration).toBeTruthy();
      });

      it('should prevent username enumeration', async () => {
        const responses = await Promise.all([
          // Existing user
          fetch(`${process.env.APP_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'existing-user',
              password: 'wrong-password'
            })
          }),
          // Non-existing user
          fetch(`${process.env.APP_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'non-existing-user',
              password: 'wrong-password'
            })
          })
        ]);

        const [existingResponse, nonExistingResponse] = await Promise.all(
          responses.map(r => r.json())
        );

        expect(existingResponse.message).toBe(nonExistingResponse.message);
        expect(responses[0].status).toBe(responses[1].status);
        expect(responses[0].headers.get('timing-allow-origin')).toBe('*');
      });

      it('should prevent credential stuffing', async () => {
        const commonCredentials = [
          { username: 'admin', password: 'admin' },
          { username: 'test', password: 'test123' },
          { username: 'user', password: 'password' }
        ];

        const results = await Promise.all(
          commonCredentials.map(cred =>
            fetch(`${process.env.APP_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cred)
            })
          )
        );

        expect(results.some(r => r.status === 429)).toBe(true);
        expect(results.every(r => r.headers.get('x-ratelimit-remaining'))).toBe(true);
      });
    });

    describe('Session Attacks', () => {
      it('should prevent session fixation', async () => {
        // Try to set session ID
        const response1 = await fetch(`${process.env.APP_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'session_id=fixed_session'
          },
          body: JSON.stringify({
            username: 'test',
            password: 'test123'
          })
        });

        const cookies1 = response1.headers.get('set-cookie');
        expect(cookies1).not.toContain('fixed_session');

        // Verify session changes after login
        const response2 = await fetch(`${process.env.APP_URL}/api/user`, {
          headers: {
            'Cookie': cookies1!
          }
        });

        const cookies2 = response2.headers.get('set-cookie');
        expect(cookies2).not.toBe(cookies1);
      });

      it('should prevent session hijacking', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Login and get session
        const response1 = await fetch(`${process.env.APP_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUser.discord_username,
            password: 'test-password'
          })
        });

        const cookies = response1.headers.get('set-cookie');

        // Try to use session from different IP/User-Agent
        const response2 = await fetch(`${process.env.APP_URL}/api/user`, {
          headers: {
            'Cookie': cookies!,
            'User-Agent': 'Different Browser',
            'X-Forwarded-For': '1.2.3.4'
          }
        });

        expect(response2.status).toBe(401);
      });

      it('should prevent CSRF attacks', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Get CSRF token
        const response1 = await fetch(`${process.env.APP_URL}/auth/csrf-token`);
        const { token } = await response1.json();

        // Try without CSRF token
        const response2 = await fetch(`${process.env.APP_URL}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testUser.token}`
          },
          body: JSON.stringify({ theme: 'dark' })
        });
        expect(response2.status).toBe(403);

        // Try with invalid CSRF token
        const response3 = await fetch(`${process.env.APP_URL}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testUser.token}`,
            'X-CSRF-Token': 'invalid'
          },
          body: JSON.stringify({ theme: 'dark' })
        });
        expect(response3.status).toBe(403);

        // Try with valid CSRF token
        const response4 = await fetch(`${process.env.APP_URL}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testUser.token}`,
            'X-CSRF-Token': token
          },
          body: JSON.stringify({ theme: 'dark' })
        });
        expect(response4.ok).toBe(true);
      });
    });
  });

  describe('Injection Attacks', () => {
    describe('SQL Injection', () => {
      it('should prevent SQL injection in queries', async () => {
        const maliciousInputs = [
          "' OR '1'='1",
          "'; DROP TABLE users; --",
          "' UNION SELECT * FROM users --",
          "' AND 1=CONVERT(int, (SELECT @@version)) --"
        ];

        const results = await Promise.all(
          maliciousInputs.map(input =>
            fetch(`${process.env.APP_URL}/api/users/search?q=${encodeURIComponent(input)}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent SQL injection in data', async () => {
        const maliciousData = {
          username: "test'; INSERT INTO users VALUES ('hacked');--",
          email: "test@test.com'; UPDATE users SET role='admin';--"
        };

        const response = await fetch(`${process.env.APP_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(maliciousData)
        });

        expect(response.status).toBe(400);
      });

      it('should prevent blind SQL injection', async () => {
        const timingAttacks = [
          "' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(2) ELSE pg_sleep(0) END)--",
          "' AND (SELECT CASE WHEN (username='admin') THEN pg_sleep(2) ELSE pg_sleep(0) END FROM users)--"
        ];

        const startTime = Date.now();
        await Promise.all(
          timingAttacks.map(attack =>
            fetch(`${process.env.APP_URL}/api/users/search?q=${encodeURIComponent(attack)}`)
          )
        );
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(1000); // Should not wait for sleep
      });
    });

    describe('XSS Prevention', () => {
      it('should prevent stored XSS', async () => {
        const xssPayloads = [
          '<script>alert(1)</script>',
          '"><script>alert(1)</script>',
          '<img src=x onerror=alert(1)>',
          '<svg onload=alert(1)>',
          'javascript:alert(1)'
        ];

        const results = await Promise.all(
          xssPayloads.map(payload =>
            fetch(`${process.env.APP_URL}/api/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: payload })
            })
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent reflected XSS', async () => {
        const xssPayloads = [
          '?q=<script>alert(1)</script>',
          '?name=<img src=x onerror=alert(1)>',
          '?redirect=javascript:alert(1)'
        ];

        const results = await Promise.all(
          xssPayloads.map(payload =>
            fetch(`${process.env.APP_URL}/search${payload}`)
          )
        );

        results.forEach(async response => {
          const text = await response.text();
          expect(text).not.toContain('<script>');
          expect(text).not.toContain('javascript:');
          expect(text).not.toContain('onerror=');
        });
      });

      it('should prevent DOM-based XSS', async () => {
        const xssPayloads = [
          '#<script>alert(1)</script>',
          '#"><script>alert(1)</script>',
          '#javascript:alert(1)'
        ];

        const results = await Promise.all(
          xssPayloads.map(payload =>
            fetch(`${process.env.APP_URL}/page${payload}`)
          )
        );

        results.forEach(async response => {
          const text = await response.text();
          expect(text).not.toContain('<script>');
          expect(text).not.toContain('javascript:');
        });
      });
    });

    describe('Command Injection', () => {
      it('should prevent OS command injection', async () => {
        const maliciousCommands = [
          '; cat /etc/passwd',
          '| ls -la',
          '\`whoami\`',
          '$(echo vulnerable)',
          '& net user'
        ];

        const results = await Promise.all(
          maliciousCommands.map(cmd =>
            fetch(`${process.env.APP_URL}/api/process?command=${encodeURIComponent(cmd)}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should prevent argument injection', async () => {
        const maliciousArgs = [
          '--debug',
          '-help',
          '/verbose',
          '--config=malicious.conf'
        ];

        const results = await Promise.all(
          maliciousArgs.map(arg =>
            fetch(`${process.env.APP_URL}/api/run?arg=${encodeURIComponent(arg)}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });
    });
  });

  describe('Information Disclosure', () => {
    describe('Error Handling', () => {
      it('should prevent stack trace leakage', async () => {
        const errorTriggers = [
          '/api/undefined/method',
          '/api/trigger/error',
          '/api/database/invalid'
        ];

        const results = await Promise.all(
          errorTriggers.map(path =>
            fetch(`${process.env.APP_URL}${path}`)
          )
        );

        results.forEach(async response => {
          const error = await response.json();
          expect(error.stack).toBeUndefined();
          expect(error.message).not.toContain('at ');
          expect(error.message).not.toContain(':\\');
        });
      });

      it('should prevent sensitive data exposure', async () => {
        const endpoints = [
          '/api/user/profile',
          '/api/payment/details',
          '/api/settings'
        ];

        const results = await Promise.all(
          endpoints.map(path =>
            fetch(`${process.env.APP_URL}${path}`)
          )
        );

        results.forEach(async response => {
          const data = await response.text();
          expect(data).not.toMatch(/\d{4}-\d{4}-\d{4}-\d{4}/); // Credit card
          expect(data).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); // Email
          expect(data).not.toMatch(/(?:\d{3}|\(\d{3}\))([-\/\.])\d{3}\1\d{4}/); // Phone
        });
      });
    });

    describe('Directory Traversal', () => {
      it('should prevent path traversal', async () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '%2e%2e%2f%2e%2e%2f',
          'file:///etc/passwd',
          '....//....//etc/passwd'
        ];

        const results = await Promise.all(
          maliciousPaths.map(path =>
            fetch(`${process.env.APP_URL}/api/files/${encodeURIComponent(path)}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });

      it('should validate file uploads', async () => {
        const maliciousFiles = [
          { name: '../../../etc/passwd', content: 'hack' },
          { name: 'image.jpg.php', content: '<?php ?>' },
          { name: 'valid.jpg', content: '<?php ?>' }
        ];

        const results = await Promise.all(
          maliciousFiles.map(file => {
            const formData = new FormData();
            formData.append('file', new Blob([file.content]), file.name);
            return fetch(`${process.env.APP_URL}/api/upload`, {
              method: 'POST',
              body: formData
            });
          })
        );

        results.forEach(response => {
          expect(response.status).toBe(400);
        });
      });
    });
  });

  describe('Security Misconfiguration', () => {
    describe('Headers and Settings', () => {
      it('should validate security headers', async () => {
        const response = await fetch(process.env.APP_URL!);
        const headers = response.headers;

        expect(headers.get('x-content-type-options')).toBe('nosniff');
        expect(headers.get('x-frame-options')).toBe('DENY');
        expect(headers.get('x-xss-protection')).toBe('1; mode=block');
        expect(headers.get('strict-transport-security')).toContain('max-age=31536000');
        expect(headers.get('content-security-policy')).toBeTruthy();
        expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      });

      it('should check for exposed configuration', async () => {
        const sensitiveFiles = [
          '/.env',
          '/config.json',
          '/wp-config.php',
          '/web.config',
          '/.git/config'
        ];

        const results = await Promise.all(
          sensitiveFiles.map(file =>
            fetch(`${process.env.APP_URL}${file}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(404);
        });
      });

      it('should validate CORS configuration', async () => {
        const origins = [
          'https://allowed-origin.com',
          'https://malicious.com',
          null
        ];

        const results = await Promise.all(
          origins.map(origin =>
            fetch(`${process.env.APP_URL}/api/data`, {
              headers: origin ? { 'Origin': origin } : {}
            })
          )
        );

        expect(results[0].headers.get('access-control-allow-origin')).toBe('https://allowed-origin.com');
        expect(results[1].headers.get('access-control-allow-origin')).toBeNull();
        expect(results[2].headers.get('access-control-allow-origin')).toBeNull();
      });
    });

    describe('Debug Endpoints', () => {
      it('should prevent access to debug endpoints', async () => {
        const debugEndpoints = [
          '/debug/vars',
          '/admin/console',
          '/phpinfo.php',
          '/server-status',
          '/.well-known/security.txt'
        ];

        const results = await Promise.all(
          debugEndpoints.map(endpoint =>
            fetch(`${process.env.APP_URL}${endpoint}`)
          )
        );

        results.forEach(response => {
          expect(response.status).toBe(404);
        });
      });

      it('should validate error pages', async () => {
        const errorPages = [404, 500, 403];

        const results = await Promise.all(
          errorPages.map(code =>
            fetch(`${process.env.APP_URL}/trigger-error/${code}`)
          )
        );

        results.forEach(async (response, i) => {
          expect(response.status).toBe(errorPages[i]);
          const html = await response.text();
          expect(html).not.toContain('Exception');
          expect(html).not.toContain('Stack trace');
          expect(html).not.toContain('line');
        });
      });
    });
  });
}); 