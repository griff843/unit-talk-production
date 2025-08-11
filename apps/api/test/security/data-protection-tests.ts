import crypto from 'crypto';

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Data Protection & Encryption Security', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Data Encryption', () => {
    describe('At Rest Encryption', () => {
      it('should encrypt sensitive data at rest', async () => {
        // Create test user with sensitive data
        const testUser = createMockUser({
          email: 'test@example.com',
          phone: '+1234567890',
          payment_info: {
            card_number: '4242424242424242',
            expiry: '12/25',
            cvv: '123'
          }
        });

        // Insert user
        const { data: user } = await supabase
          .from('users')
          .insert(testUser)
          .select()
          .single();

        // Verify sensitive data is encrypted
        expect(user?.email).not.toBe('test@example.com');
        expect(user?.phone).not.toBe('+1234567890');
        expect(user?.payment_info).not.toContain('4242');

        // Verify data can be decrypted
        const { data: decrypted } = await supabase.rpc('decrypt_user_data', {
          user_id: user?.id
        });

        expect(decrypted.email).toBe('test@example.com');
        expect(decrypted.phone).toBe('+1234567890');
        expect(decrypted.payment_info.card_number).toBe('4242424242424242');
      });

      it('should rotate encryption keys', async () => {
        // Create data with old key
        const oldKey = crypto.randomBytes(32);
        const testData = 'sensitive data';
        const encrypted = crypto.createCipheriv('aes-256-gcm', oldKey, crypto.randomBytes(12))
          .update(testData, 'utf8', 'hex');

        // Store encrypted data
        const { data: stored } = await supabase
          .from('encrypted_data')
          .insert({ data: encrypted })
          .select()
          .single();

        // Rotate key
        const newKey = crypto.randomBytes(32);
        const { data: rotated } = await supabase.rpc('rotate_encryption_key', {
          old_key: oldKey.toString('hex'),
          new_key: newKey.toString('hex')
        });

        // Verify data is still accessible
        const decrypted = crypto.createDecipheriv('aes-256-gcm', newKey, rotated.iv)
          .update(rotated.data, 'hex', 'utf8');
        expect(decrypted).toBe(testData);
      });

      it('should handle key versioning', async () => {
        // Create multiple versions of keys
        const keys = Array(3).fill(null).map(() => ({
          key: crypto.randomBytes(32),
          version: crypto.randomBytes(16).toString('hex')
        }));

        // Encrypt data with different key versions
        const testData = keys.map(({ key, version }) => {
          const encrypted = crypto.createCipheriv('aes-256-gcm', key, crypto.randomBytes(12))
            .update('test', 'utf8', 'hex');
          return { data: encrypted, key_version: version };
        });

        // Store encrypted data
        await supabase.from('versioned_data').insert(testData);

        // Verify all versions can be decrypted
        for (const { key, version } of keys) {
          const { data } = await supabase.rpc('decrypt_versioned_data', {
            key_version: version,
            key: key.toString('hex')
          });
          expect(data).toBe('test');
        }
      });
    });

    describe('In Transit Encryption', () => {
      it('should enforce TLS', async () => {
        // Try non-HTTPS connection
        const response = await fetch(process.env.APP_URL!.replace('https', 'http'));
        expect(response.status).toBe(301); // Redirect to HTTPS
      });

      it('should validate SSL certificates', async () => {
        const response = await fetch(process.env.APP_URL!, {
          method: 'HEAD'
        });

        const cert = response.headers.get('x-cert-info');
        expect(cert).toContain('SHA256');
        expect(cert).toContain('TLS 1.3');
      });

      it('should implement HSTS', async () => {
        const response = await fetch(process.env.APP_URL!);
        const hstsHeader = response.headers.get('strict-transport-security');

        expect(hstsHeader).toContain('max-age=31536000'); // 1 year
        expect(hstsHeader).toContain('includeSubDomains');
        expect(hstsHeader).toContain('preload');
      });
    });

    describe('End-to-End Encryption', () => {
      it('should handle client-side encryption', async () => {
        // Generate key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // Encrypt data client-side
        const testData = 'sensitive message';
        const encrypted = crypto.publicEncrypt(publicKey, Buffer.from(testData));

        // Send encrypted data
        const response = await fetch(`${process.env.APP_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: encrypted.toString('base64') })
        });

        expect(response.ok).toBe(true);

        // Decrypt response
        const { data: encryptedResponse } = await response.json();
        const decrypted = crypto.privateDecrypt(privateKey, Buffer.from(encryptedResponse, 'base64'));
        expect(decrypted.toString()).toBe('received');
      });

      it('should handle key exchange', async () => {
        // Generate DH parameters
        const alice = crypto.createDiffieHellman(2048);
        const aliceKey = alice.generateKeys();

        // Send public key
        const response1 = await fetch(`${process.env.APP_URL}/api/key-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prime: alice.getPrime().toString('hex'),
            generator: alice.getGenerator().toString('hex'),
            public_key: aliceKey.toString('hex')
          })
        });

        // Get server's public key
        const { public_key: bobKey } = await response1.json();
        const sharedSecret = alice.computeSecret(Buffer.from(bobKey, 'hex'));

        // Use shared secret for encryption
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret.slice(0, 32), crypto.randomBytes(12));
        const encrypted = cipher.update('test', 'utf8', 'hex');

        // Verify encrypted communication
        const response2 = await fetch(`${process.env.APP_URL}/api/secure-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: encrypted })
        });

        expect(response2.ok).toBe(true);
      });
    });
  });

  describe('Data Protection', () => {
    describe('PII Protection', () => {
      it('should mask sensitive data in logs', async () => {
        const testUser = createMockUser({
          email: 'test@example.com',
          phone: '+1234567890',
          ssn: '123-45-6789'
        });

        // Perform action that triggers logging
        await supabase.from('users').insert(testUser);

        // Get recent logs
        const { data: logs } = await supabase
          .from('system_logs')
          .select()
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        // Verify PII is masked
        expect(logs.message).not.toContain('test@example.com');
        expect(logs.message).not.toContain('+1234567890');
        expect(logs.message).not.toContain('123-45-6789');
        expect(logs.message).toContain('***@***.com');
        expect(logs.message).toContain('+*******890');
        expect(logs.message).toContain('***-**-6789');
      });

      it('should handle data export requests', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Request data export
        const response = await fetch(`${process.env.APP_URL}/api/users/export`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ format: 'json' })
        });

        const exportData = await response.json();

        // Verify export format
        expect(exportData.metadata).toBeTruthy();
        expect(exportData.metadata.timestamp).toBeTruthy();
        expect(exportData.metadata.format_version).toBeTruthy();
        expect(exportData.data).toBeTruthy();
      });

      it('should handle data deletion requests', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Request data deletion
        const response = await fetch(`${process.env.APP_URL}/api/users/delete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.token}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.ok).toBe(true);

        // Verify data is deleted
        const { data: user } = await supabase
          .from('users')
          .select()
          .eq('id', testUser.id)
          .single();

        expect(user).toBeNull();

        // Verify audit log
        const { data: auditLog } = await supabase
          .from('audit_logs')
          .select()
          .eq('user_id', testUser.id)
          .eq('action', 'delete')
          .single();

        expect(auditLog).toBeTruthy();
      });
    });

    describe('Data Retention', () => {
      it('should enforce retention policies', async () => {
        // Create old data
        const oldDate = new Date();
        oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years old

        const oldPick = createMockPick({
          created_at: oldDate.toISOString()
        });

        await supabase.from('daily_picks').insert(oldPick);

        // Run retention cleanup
        await supabase.rpc('cleanup_expired_data');

        // Verify old data is archived/deleted
        const { data: pick } = await supabase
          .from('daily_picks')
          .select()
          .eq('id', oldPick.id)
          .single();

        expect(pick).toBeNull();

        // Verify archive
        const { data: archived } = await supabase
          .from('data_archive')
          .select()
          .eq('original_id', oldPick.id)
          .single();

        expect(archived).toBeTruthy();
      });

      it('should handle data archival', async () => {
        const testPick = createMockPick();
        await supabase.from('daily_picks').insert(testPick);

        // Archive data
        const response = await fetch(`${process.env.APP_URL}/api/data/archive`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            table: 'daily_picks',
            id: testPick.id
          })
        });

        expect(response.ok).toBe(true);

        // Verify archival
        const { data: archived } = await supabase
          .from('data_archive')
          .select()
          .eq('original_id', testPick.id)
          .single();

        expect(archived.data).toEqual(testPick);
        expect(archived.archived_at).toBeTruthy();
        expect(archived.archive_reason).toBeTruthy();
      });
    });

    describe('Audit Logging', () => {
      it('should log data access', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Access sensitive data
        await fetch(`${process.env.APP_URL}/api/users/${testUser.id}/payment-info`, {
          headers: { 'Authorization': `Bearer ${testUser.token}` }
        });

        // Verify audit log
        const { data: logs } = await supabase
          .from('audit_logs')
          .select()
          .eq('user_id', testUser.id)
          .eq('action', 'read')
          .eq('resource', 'payment_info');

        expect(logs).toHaveLength(1);
        expect(logs![0].timestamp).toBeTruthy();
        expect(logs![0].ip_address).toBeTruthy();
        expect(logs![0].user_agent).toBeTruthy();
      });

      it('should log data modifications', async () => {
        const testUser = createMockUser();
        await supabase.from('users').insert(testUser);

        // Modify data
        await fetch(`${process.env.APP_URL}/api/users/${testUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${testUser.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'new@example.com'
          })
        });

        // Verify audit log
        const { data: logs } = await supabase
          .from('audit_logs')
          .select()
          .eq('user_id', testUser.id)
          .eq('action', 'update');

        expect(logs).toHaveLength(1);
        expect(logs![0].old_value).toBeTruthy();
        expect(logs![0].new_value).toBeTruthy();
        expect(logs![0].modified_fields).toContain('email');
      });
    });
  });
}); 