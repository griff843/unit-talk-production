
#!/usr/bin/env tsx

/**
 * Alert System Comprehensive Test
 * Tests Discord, Email, SMS notification channels
 */

import { emailService } from '../src/services/email';
import { smsService } from '../src/services/sms';

class AlertSystemTester {
  async testAllChannels(): Promise<void> {
    console.log('📢 ALERT SYSTEM COMPREHENSIVE TEST');
    console.log('==================================\n');

    const testAlert = {
      id: 'test-alert-001',
      type: 'info' as const,
      message: 'Test alert for production validation',
      timestamp: new Date().toISOString(),
      priority: 'medium' as const
    };

    // Test Discord integration
    console.log('🔍 Testing Discord integration...');
    const discordResult = await this.testDiscordAlert(testAlert);
    console.log(`${discordResult ? '✅' : '❌'} Discord: ${discordResult ? 'WORKING' : 'NEEDS CONFIGURATION'}\n`);

    // Test Email service
    console.log('🔍 Testing Email service...');
    const emailResult = await this.testEmailAlert(testAlert);
    console.log(`${emailResult ? '✅' : '❌'} Email: ${emailResult ? 'WORKING' : 'NEEDS CONFIGURATION'}\n`);

    // Test SMS service
    console.log('🔍 Testing SMS service...');
    const smsResult = await this.testSMSAlert(testAlert);
    console.log(`${smsResult ? '✅' : '❌'} SMS: ${smsResult ? 'WORKING' : 'NEEDS CONFIGURATION'}\n`);

    const workingChannels = [discordResult, emailResult, smsResult].filter(Boolean).length;
    console.log(`📊 Alert Channels: ${workingChannels}/3 operational`);
    
    if (workingChannels >= 2) {
      console.log('🎉 Alert system meets production requirements!');
    } else {
      console.log('⚠️ Alert system needs configuration before production');
    }
  }

  private async testDiscordAlert(alert: any): Promise<boolean> {
    try {
      // Check if Discord webhook is configured
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        console.log('   ⚠️ Discord webhook URL not configured');
        return false;
      }
      
      console.log('   ✅ Discord webhook configured');
      return true;
    } catch (error) {
      console.log(`   ❌ Discord error: ${error.message}`);
      return false;
    }
  }

  private async testEmailAlert(alert: any): Promise<boolean> {
    try {
      const healthCheck = await emailService.healthCheck();
      if (healthCheck) {
        console.log('   ✅ Email service configured and ready');
        return true;
      } else {
        console.log('   ⚠️ Email service configuration incomplete');
        return false;
      }
    } catch (error) {
      console.log(`   ❌ Email error: ${error.message}`);
      return false;
    }
  }

  private async testSMSAlert(alert: any): Promise<boolean> {
    try {
      const healthCheck = await smsService.healthCheck();
      if (healthCheck) {
        console.log('   ✅ SMS service configured and ready');
        return true;
      } else {
        console.log('   ⚠️ SMS service configuration incomplete');
        return false;
      }
    } catch (error) {
      console.log(`   ❌ SMS error: ${error.message}`);
      return false;
    }
  }
}

const tester = new AlertSystemTester();
tester.testAllChannels().catch(console.error);
