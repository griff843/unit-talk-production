/**
 * Test Alert Integrations - Phase 13
 * Tests Slack, Discord, and Prometheus integrations
 * 
 * @date 2025-10-31
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.shared' });
require('dotenv').config({ path: '.env' });

const https = require('https');
const http = require('http');

const args = process.argv.slice(2);
const channelsArg = args.find(a => a.startsWith('--channels='));
const severityArg = args.find(a => a.startsWith('--severity='));

const channels = channelsArg ? channelsArg.split('=')[1].split(',') : ['discord'];
const severity = severityArg ? severityArg.split('=')[1] : 'test';

const results = {
  timestamp: new Date().toISOString(),
  severity,
  channels: {},
  summary: { total: 0, passed: 0, failed: 0 }
};

async function testDiscord() {
  console.log('[Test Alerts] Testing Discord webhook...');
  
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_TEST_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[Test Alerts] ⚠️  Discord webhook URL not configured');
    return { status: 'SKIP', reason: 'No webhook URL configured' };
  }

  try {
    const payload = JSON.stringify({
      content: `🧪 **Phase 13 Alert Test** - ${severity.toUpperCase()}`,
      embeds: [{
        title: 'Alert Integration Test',
        description: 'Testing Discord alert delivery for Phase 13 validation',
        color: severity === 'test' ? 3447003 : 15158332,
        fields: [
          { name: 'Severity', value: severity, inline: true },
          { name: 'Timestamp', value: new Date().toISOString(), inline: true },
          { name: 'Status', value: '✅ Test Message', inline: false }
        ],
        footer: { text: 'Unit Talk Phase 13 Validation' }
      }]
    });

    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 204 || res.statusCode === 200) {
            console.log('[Test Alerts] ✅ Discord webhook test passed');
            resolve({ status: 'PASS', statusCode: res.statusCode });
          } else {
            console.log(`[Test Alerts] ❌ Discord webhook failed: ${res.statusCode}`);
            resolve({ status: 'FAIL', statusCode: res.statusCode, error: data });
          }
        });
      });

      req.on('error', (error) => {
        console.log(`[Test Alerts] ❌ Discord webhook error: ${error.message}`);
        resolve({ status: 'FAIL', error: error.message });
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    console.log(`[Test Alerts] ❌ Discord test failed: ${error.message}`);
    return { status: 'FAIL', error: error.message };
  }
}

async function testSlack() {
  console.log('[Test Alerts] Testing Slack webhook...');
  
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[Test Alerts] ⚠️  Slack webhook URL not configured');
    return { status: 'SKIP', reason: 'No webhook URL configured' };
  }

  try {
    const payload = JSON.stringify({
      text: `🧪 Phase 13 Alert Test - ${severity.toUpperCase()}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🧪 Alert Integration Test' }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${severity}` },
            { type: 'mrkdwn', text: `*Status:*\n✅ Test Message` }
          ]
        }
      ]
    });

    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('[Test Alerts] ✅ Slack webhook test passed');
            resolve({ status: 'PASS', statusCode: res.statusCode });
          } else {
            console.log(`[Test Alerts] ❌ Slack webhook failed: ${res.statusCode}`);
            resolve({ status: 'FAIL', statusCode: res.statusCode, error: data });
          }
        });
      });

      req.on('error', (error) => {
        console.log(`[Test Alerts] ❌ Slack webhook error: ${error.message}`);
        resolve({ status: 'FAIL', error: error.message });
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    console.log(`[Test Alerts] ❌ Slack test failed: ${error.message}`);
    return { status: 'FAIL', error: error.message };
  }
}

async function testPrometheus() {
  console.log('[Test Alerts] Testing Prometheus scraping...');
  
  const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
  
  try {
    const readyUrl = `${prometheusUrl}/-/ready`;
    
    return new Promise((resolve) => {
      http.get(readyUrl, (res) => {
        if (res.statusCode === 200) {
          console.log('[Test Alerts] ✅ Prometheus is ready');
          resolve({ status: 'PASS', statusCode: res.statusCode });
        } else {
          console.log(`[Test Alerts] ⚠️  Prometheus returned: ${res.statusCode}`);
          resolve({ status: 'WARN', statusCode: res.statusCode, reason: 'Prometheus not ready' });
        }
      }).on('error', (error) => {
        console.log(`[Test Alerts] ⚠️  Prometheus not accessible: ${error.message}`);
        resolve({ status: 'SKIP', reason: 'Prometheus not running locally', error: error.message });
      });
    });
  } catch (error) {
    console.log(`[Test Alerts] ⚠️  Prometheus test skipped: ${error.message}`);
    return { status: 'SKIP', reason: 'Prometheus not configured', error: error.message };
  }
}

async function runTests() {
  console.log('\n================================================================================');
  console.log('ALERT INTEGRATIONS TEST');
  console.log('================================================================================\n');
  console.log(`[Test Alerts] Channels: ${channels.join(', ')}`);
  console.log(`[Test Alerts] Severity: ${severity}\n`);

  for (const channel of channels) {
    results.summary.total++;
    
    let result;
    switch (channel.toLowerCase()) {
      case 'discord':
        result = await testDiscord();
        break;
      case 'slack':
        result = await testSlack();
        break;
      case 'prometheus':
        result = await testPrometheus();
        break;
      default:
        result = { status: 'SKIP', reason: `Unknown channel: ${channel}` };
    }
    
    results.channels[channel] = result;
    
    if (result.status === 'PASS') {
      results.summary.passed++;
    } else if (result.status === 'FAIL') {
      results.summary.failed++;
    }
  }

  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================\n');
  console.log(JSON.stringify(results, null, 2));
  
  // Exit with appropriate code
  if (results.summary.failed > 0) {
    console.log('\n❌ Some alert tests failed');
    process.exit(1);
  } else if (results.summary.passed === 0) {
    console.log('\n⚠️  No alert tests passed (all skipped)');
    process.exit(0);
  } else {
    console.log('\n✅ Alert tests completed successfully');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('[Test Alerts] Fatal error:', error);
  process.exit(1);
});

