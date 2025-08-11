import fs from 'fs';
import path from 'path';

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import yaml from 'js-yaml';

import { Database } from '../../src/db/types/supabase';
import { createMockUser } from '../utils/testData';


describe('Infrastructure Security', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Network Security', () => {
    describe('Firewall Rules', () => {
      it('should enforce network access rules', async () => {
        const restrictedPorts = [22, 3306, 6379, 27017];

        const results = await Promise.all(
          restrictedPorts.map(port =>
            fetch(`${process.env.APP_URL}:${port}`)
              .then(() => ({ port, accessible: true }))
              .catch(() => ({ port, accessible: false }))
          )
        );

        results.forEach(result => {
          expect(result.accessible).toBe(false);
        });
      });

      it('should validate allowed IP ranges', async () => {
        const response = await fetch(`${process.env.APP_URL}/api/network/info`);
        const { client_ip } = await response.json();

        // Check if IP is in allowed range
        const allowedRanges = [
          '10.0.0.0/8',     // Internal network
          '172.16.0.0/12',  // VPC network
          '192.168.0.0/16'  // Local network
        ];

        const isAllowed = allowedRanges.some(range => {
          const [network, bits] = range.split('/');
          const ip = client_ip.split('.')
            .map(octet => parseInt(octet))
            .reduce((acc, octet) => (acc << 8) + octet);
          const mask = ~((1 << (32 - parseInt(bits))) - 1);
          return (ip & mask) === (network & mask);
        });

        expect(isAllowed).toBe(true);
      });

      it('should block malicious traffic', async () => {
        const maliciousRequests = [
          { path: '/wp-admin', expectedStatus: 403 },    // WordPress probe
          { path: '/phpmyadmin', expectedStatus: 403 },  // phpMyAdmin probe
          { path: '/.env', expectedStatus: 403 },        // Environment file probe
          { path: '/config.php', expectedStatus: 403 }   // Configuration file probe
        ];

        for (const request of maliciousRequests) {
          const response = await fetch(`${process.env.APP_URL}${request.path}`);
          expect(response.status).toBe(request.expectedStatus);
        }
      });
    });

    describe('SSL/TLS Configuration', () => {
      it('should enforce strong SSL/TLS settings', async () => {
        const response = await fetch(process.env.APP_URL!, {
          method: 'HEAD'
        });

        const securityInfo = response.headers.get('x-security-info');
        expect(securityInfo).toContain('TLS 1.3');
        expect(securityInfo).toContain('ECDHE');
        expect(securityInfo).not.toContain('RC4');
        expect(securityInfo).not.toContain('DES');
        expect(securityInfo).not.toContain('MD5');
      });

      it('should validate certificate configuration', async () => {
        const response = await fetch(process.env.APP_URL!, {
          method: 'HEAD'
        });

        const cert = response.headers.get('x-cert-info');
        expect(cert).toContain('SHA256');
        expect(cert).toContain('EV');
        expect(cert).toContain('DNS:');
        expect(cert).toContain('Subject Alternative Names');
      });

      it('should handle certificate renewal', async () => {
        const response = await fetch(process.env.APP_URL!, {
          method: 'HEAD'
        });

        const cert = response.headers.get('x-cert-info');
        const expiryDate = new Date(cert!.match(/Not After: (.+)/)?.[1] || '');
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        expect(daysUntilExpiry).toBeGreaterThan(30);
      });
    });
  });

  describe('Container Security', () => {
    describe('Docker Configuration', () => {
      it('should validate Docker security settings', () => {
        const dockerCompose = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8')
        ) as any;

        // Check security options
        Object.values(dockerCompose.services).forEach((service: any) => {
          expect(service.security_opt).toContain('no-new-privileges:true');
          expect(service.cap_drop).toContain('ALL');
          if (service.cap_add) {
            expect(service.cap_add.length).toBeLessThan(3);
          }
        });
      });

      it('should validate container user permissions', () => {
        const dockerCompose = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8')
        ) as any;

        Object.values(dockerCompose.services).forEach((service: any) => {
          expect(service.user).not.toBe('root');
          if (service.volumes) {
            service.volumes.forEach((volume: string) => {
              expect(volume).not.toContain(':rw');
            });
          }
        });
      });

      it('should check container resource limits', () => {
        const dockerCompose = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8')
        ) as any;

        Object.values(dockerCompose.services).forEach((service: any) => {
          expect(service.deploy?.resources?.limits?.memory).toBeTruthy();
          expect(service.deploy?.resources?.limits?.cpus).toBeTruthy();
        });
      });
    });

    describe('Image Security', () => {
      it('should validate base images', () => {
        const dockerfile = fs.readFileSync(
          path.join(process.cwd(), 'Dockerfile'),
          'utf8'
        );

        // Check base image
        expect(dockerfile).toMatch(/FROM \w+:([\d.]+(-slim)?|alpine)/);
        expect(dockerfile).not.toMatch(/FROM \w+:latest/);

        // Check multi-stage builds
        const stages = dockerfile.match(/FROM .+ as \w+/g);
        expect(stages?.length).toBeGreaterThan(1);
      });

      it('should check security scanning', async () => {
        const response = await fetch(`${process.env.CI_API}/security/scan/latest`);
        const scanResults = await response.json();

        expect(scanResults.critical_vulnerabilities).toBe(0);
        expect(scanResults.high_vulnerabilities).toBeLessThan(5);
        expect(scanResults.scan_date).toBeTruthy();
      });

      it('should validate image signing', async () => {
        const response = await fetch(`${process.env.CI_API}/images/latest/signature`);
        const signature = await response.json();

        expect(signature.signed).toBe(true);
        expect(signature.signer).toBeTruthy();
        expect(signature.timestamp).toBeTruthy();
      });
    });
  });

  describe('Infrastructure Configuration', () => {
    describe('Kubernetes Security', () => {
      it('should validate pod security policies', () => {
        const psp = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'k8s/pod-security-policy.yml'), 'utf8')
        ) as any;

        expect(psp.spec.privileged).toBe(false);
        expect(psp.spec.allowPrivilegeEscalation).toBe(false);
        expect(psp.spec.readOnlyRootFilesystem).toBe(true);
        expect(psp.spec.runAsUser.rule).toBe('MustRunAsNonRoot');
      });

      it('should check network policies', () => {
        const networkPolicy = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'k8s/network-policy.yml'), 'utf8')
        ) as any;

        expect(networkPolicy.spec.ingress).toBeTruthy();
        expect(networkPolicy.spec.egress).toBeTruthy();
        expect(networkPolicy.spec.policyTypes).toContain('Ingress');
        expect(networkPolicy.spec.policyTypes).toContain('Egress');
      });

      it('should validate RBAC configuration', () => {
        const rbac = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'k8s/rbac.yml'), 'utf8')
        ) as any;

        expect(rbac.rules).not.toContain({
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*']
        });

        rbac.rules.forEach((rule: any) => {
          expect(rule.resources).not.toContain('secrets');
          expect(rule.verbs).not.toContain('delete');
        });
      });
    });

    describe('Cloud Security', () => {
      it('should validate IAM policies', async () => {
        const response = await fetch(`${process.env.CLOUD_API}/iam/policies`);
        const policies = await response.json();

        policies.forEach((policy: any) => {
          expect(policy.Statement).not.toContain({
            Effect: 'Allow',
            Action: '*',
            Resource: '*'
          });

          expect(policy.Statement).not.toContain({
            Effect: 'Allow',
            Action: ['iam:*']
          });
        });
      });

      it('should check security groups', async () => {
        const response = await fetch(`${process.env.CLOUD_API}/security-groups`);
        const groups = await response.json();

        groups.forEach((group: any) => {
          group.IpPermissions.forEach((permission: any) => {
            expect(permission.IpRanges).not.toContain('0.0.0.0/0');
            expect(permission.FromPort).not.toBe(22);
          });
        });
      });

      it('should validate encryption settings', async () => {
        const response = await fetch(`${process.env.CLOUD_API}/encryption/status`);
        const encryption = await response.json();

        expect(encryption.databases.encrypted).toBe(true);
        expect(encryption.storage.encrypted).toBe(true);
        expect(encryption.key_rotation_enabled).toBe(true);
      });
    });

    describe('Monitoring & Logging', () => {
      it('should validate logging configuration', () => {
        const loggingConfig = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'config/logging.yml'), 'utf8')
        ) as any;

        expect(loggingConfig.retention_days).toBeGreaterThan(30);
        expect(loggingConfig.encryption_enabled).toBe(true);
        expect(loggingConfig.audit_logs_enabled).toBe(true);
      });

      it('should check alert configurations', () => {
        const alertConfig = yaml.load(
          fs.readFileSync(path.join(process.cwd(), 'config/alerts.yml'), 'utf8')
        ) as any;

        const requiredAlerts = [
          'high_error_rate',
          'unusual_traffic_pattern',
          'authentication_failure',
          'api_latency'
        ];

        requiredAlerts.forEach(alert => {
          expect(alertConfig.alerts[alert]).toBeTruthy();
          expect(alertConfig.alerts[alert].enabled).toBe(true);
          expect(alertConfig.alerts[alert].threshold).toBeTruthy();
        });
      });

      it('should validate metrics collection', async () => {
        const response = await fetch(`${process.env.METRICS_API}/status`);
        const metrics = await response.json();

        expect(metrics.collectors.security).toBe('active');
        expect(metrics.retention_period).toBeGreaterThan(90);
        expect(metrics.secure_transport).toBe(true);
      });
    });
  });
}); 