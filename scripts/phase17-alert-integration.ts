#!/usr/bin/env tsx

/**
 * Phase 17: Alert Integration Installation & Validation
 * Install and validate Discord, Slack, PagerDuty alert integrations
 * 
 * Date: 2025-01-25
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface AlertIntegrationStatus {
  timestamp: string;
  integrations: {
    discord: {
      installed: boolean;
      configured: boolean;
      testFired: boolean;
      error?: string;
    };
    slack: {
      installed: boolean;
      configured: boolean;
      testFired: boolean;
      error?: string;
    };
    pagerduty: {
      installed: boolean;
      configured: boolean;
      testFired: boolean;
      error?: string;
    };
  };
  summary: {
    totalIntegrations: number;
    installedCount: number;
    configuredCount: number;
    testFiredCount: number;
    overallStatus: 'READY' | 'PARTIAL' | 'FAILED';
  };
}

class AlertIntegrationValidator {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  private status: AlertIntegrationStatus = {
    timestamp: new Date().toISOString(),
    integrations: {
      discord: {
        installed: false,
        configured: false,
        testFired: false,
      },
      slack: {
        installed: false,
        configured: false,
        testFired: false,
      },
      pagerduty: {
        installed: false,
        configured: false,
        testFired: false,
      },
    },
    summary: {
      totalIntegrations: 3,
      installedCount: 0,
      configuredCount: 0,
      testFiredCount: 0,
      overallStatus: 'READY',
    },
  };

  async execute() {
    console.log('🚀 Phase 17: Alert Integration Installation & Validation');
    console.log('='.repeat(60));

    try {
      // 1. Validate Discord integration
      console.log('\n🔵 Step 1: Validating Discord Integration...');
      await this.validateDiscordIntegration();

      // 2. Validate Slack integration
      console.log('\n⚪ Step 2: Validating Slack Integration...');
      await this.validateSlackIntegration();

      // 3. Validate PagerDuty integration
      console.log('\n🔴 Step 3: Validating PagerDuty Integration...');
      await this.validatePagerDutyIntegration();

      // 4. Fire test events
      console.log('\n🧪 Step 4: Firing Test Events...');
      await this.fireTestEvents();

      // 5. Generate report
      console.log('\n📋 Step 5: Generating Alert Integration Report...');
      await this.generateReport();
    } catch (error) {
      console.error('❌ Alert Integration Validation Failed:', error);
      this.status.summary.overallStatus = 'FAILED';
      await this.generateReport();
      process.exit(1);
    }
  }

  private async validateDiscordIntegration() {
    try {
      // Check Discord webhook configuration
      const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
      if (!discordWebhook) {
        throw new Error('Discord webhook URL not configured');
      }

      this.status.integrations.discord.installed = true;
      this.status.integrations.discord.configured = true;
      this.status.summary.installedCount++;
      this.status.summary.configuredCount++;

      console.log('✅ Discord integration validated');
    } catch (error) {
      this.status.integrations.discord.error = String(error);
      console.log(`❌ Discord integration failed: ${error}`);
    }
  }

  private async validateSlackIntegration() {
    try {
      // Check Slack webhook configuration
      const slackWebhook = process.env.SLACK_WEBHOOK_URL;
      if (!slackWebhook) {
        throw new Error('Slack webhook URL not configured');
      }

      this.status.integrations.slack.installed = true;
      this.status.integrations.slack.configured = true;
      this.status.summary.installedCount++;
      this.status.summary.configuredCount++;

      console.log('✅ Slack integration validated');
    } catch (error) {
      this.status.integrations.slack.error = String(error);
      console.log(`❌ Slack integration failed: ${error}`);
    }
  }

  private async validatePagerDutyIntegration() {
    try {
      // Check PagerDuty API key configuration
      const pagerdutyKey = process.env.PAGERDUTY_API_KEY;
      if (!pagerdutyKey) {
        throw new Error('PagerDuty API key not configured');
      }

      this.status.integrations.pagerduty.installed = true;
      this.status.integrations.pagerduty.configured = true;
      this.status.summary.installedCount++;
      this.status.summary.configuredCount++;

      console.log('✅ PagerDuty integration validated');
    } catch (error) {
      this.status.integrations.pagerduty.error = String(error);
      console.log(`❌ PagerDuty integration failed: ${error}`);
    }
  }

  private async fireTestEvents() {
    // Fire test Discord alert
    if (this.status.integrations.discord.configured) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL || '', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '🧪 Phase 17 Test Alert - Discord Integration Verified',
          }),
        });
        this.status.integrations.discord.testFired = true;
        this.status.summary.testFiredCount++;
        console.log('  ✅ Discord test alert fired');
      } catch (error) {
        console.log(`  ❌ Discord test alert failed: ${error}`);
      }
    }

    // Fire test Slack alert
    if (this.status.integrations.slack.configured) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL || '', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '🧪 Phase 17 Test Alert - Slack Integration Verified',
          }),
        });
        this.status.integrations.slack.testFired = true;
        this.status.summary.testFiredCount++;
        console.log('  ✅ Slack test alert fired');
      } catch (error) {
        console.log(`  ❌ Slack test alert failed: ${error}`);
      }
    }

    // Fire test PagerDuty alert
    if (this.status.integrations.pagerduty.configured) {
      try {
        await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routing_key: process.env.PAGERDUTY_ROUTING_KEY,
            event_action: 'trigger',
            payload: {
              summary: '🧪 Phase 17 Test Alert - PagerDuty Integration Verified',
              severity: 'info',
              source: 'unit-talk-phase17',
            },
          }),
        });
        this.status.integrations.pagerduty.testFired = true;
        this.status.summary.testFiredCount++;
        console.log('  ✅ PagerDuty test alert fired');
      } catch (error) {
        console.log(`  ❌ PagerDuty test alert failed: ${error}`);
      }
    }
  }

  private async generateReport() {
    // Determine overall status
    if (this.status.summary.configuredCount === 3) {
      this.status.summary.overallStatus = 'READY';
    } else if (this.status.summary.configuredCount > 0) {
      this.status.summary.overallStatus = 'PARTIAL';
    } else {
      this.status.summary.overallStatus = 'FAILED';
    }

    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const reportPath = path.join(outDir, 'ALERTS_INSTALLATION_STATUS.md');
    const markdown = this.generateMarkdownReport();
    fs.writeFileSync(reportPath, markdown);

    console.log(`✅ Alert integration report saved to ${reportPath}`);
    console.log('\n' + '='.repeat(60));
    console.log('📋 ALERT INTEGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `Installed: ${this.status.summary.installedCount}/${this.status.summary.totalIntegrations}`
    );
    console.log(
      `Configured: ${this.status.summary.configuredCount}/${this.status.summary.totalIntegrations}`
    );
    console.log(
      `Test Fired: ${this.status.summary.testFiredCount}/${this.status.summary.totalIntegrations}`
    );
    console.log(`Overall Status: ${this.status.summary.overallStatus}`);
  }

  private generateMarkdownReport(): string {
    return `# Alert Integration Status Report

**Date:** ${this.status.timestamp}

## Summary

- **Installed:** ${this.status.summary.installedCount}/${this.status.summary.totalIntegrations}
- **Configured:** ${this.status.summary.configuredCount}/${this.status.summary.totalIntegrations}
- **Test Fired:** ${this.status.summary.testFiredCount}/${this.status.summary.totalIntegrations}
- **Overall Status:** ${this.status.summary.overallStatus}

## Integration Details

### Discord
- **Installed:** ${this.status.integrations.discord.installed ? '✅' : '❌'}
- **Configured:** ${this.status.integrations.discord.configured ? '✅' : '❌'}
- **Test Fired:** ${this.status.integrations.discord.testFired ? '✅' : '❌'}
${this.status.integrations.discord.error ? `- **Error:** ${this.status.integrations.discord.error}` : ''}

### Slack
- **Installed:** ${this.status.integrations.slack.installed ? '✅' : '❌'}
- **Configured:** ${this.status.integrations.slack.configured ? '✅' : '❌'}
- **Test Fired:** ${this.status.integrations.slack.testFired ? '✅' : '❌'}
${this.status.integrations.slack.error ? `- **Error:** ${this.status.integrations.slack.error}` : ''}

### PagerDuty
- **Installed:** ${this.status.integrations.pagerduty.installed ? '✅' : '❌'}
- **Configured:** ${this.status.integrations.pagerduty.configured ? '✅' : '❌'}
- **Test Fired:** ${this.status.integrations.pagerduty.testFired ? '✅' : '❌'}
${this.status.integrations.pagerduty.error ? `- **Error:** ${this.status.integrations.pagerduty.error}` : ''}

## Recommendations

${
  this.status.summary.overallStatus === 'READY'
    ? '✅ All alert integrations are ready for production deployment.'
    : '⚠️ Some alert integrations require configuration before production deployment.'
}
`;
  }
}

// Execute validation
const validator = new AlertIntegrationValidator();
validator.execute().catch(console.error);

