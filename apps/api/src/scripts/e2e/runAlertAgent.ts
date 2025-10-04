/**
 * E2E Alert Agent Runner
 *
 * Sends Discord alerts with telemetry for E2E audit
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { getSupabaseClient } from '../../config/db';
import fetch from 'node-fetch';

interface E2ETelemetry {
  timestamp: string;
  duration: number;
  webhookConfigured: boolean;
  result: {
    success: boolean;
    picksFound: number;
    alertsSent: number;
    errors: number;
  };
  error?: string;
}

async function sendDiscordWebhook(webhook: string, embed: any): Promise<boolean> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Unit Talk E2E Test',
        embeds: [embed]
      })
    });

    return response.ok;
  } catch (error) {
    console.log(`❌ Webhook error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function createPickEmbed(pick: any): any {
  const score = pick.professional_score || 0;
  let color = 0xA9A9A9;
  if (score >= 0.9) color = 0xFF215E; // Red (S-tier)
  else if (score >= 0.8) color = 0xFF8C42; // Orange (A-tier)
  else if (score >= 0.7) color = 0xFFD700; // Gold (B-tier)

  return {
    title: `🔥 ${pick.tier || '?'}-Tier Pick`,
    description: `**${pick.player_name}** - ${pick.market}`,
    color,
    fields: [
      { name: 'Selection', value: pick.outcome || pick.selection || 'N/A', inline: true },
      { name: 'Line', value: pick.line?.toString() || 'N/A', inline: true },
      { name: 'Score', value: (score * 100).toFixed(1) + '%', inline: true }
    ],
    timestamp: new Date().toISOString()
  };
}

export async function runAlertAgentE2E(): Promise<E2ETelemetry> {
  const start = Date.now();
  const webhook = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_ALERT_WEBHOOK;

  console.log('\n' + '='.repeat(80));
  console.log('E2E ALERT AGENT TEST');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Webhook: ${webhook ? '✅ Configured' : '❌ Not configured'}\n`);

  const telemetry: E2ETelemetry = {
    timestamp: new Date().toISOString(),
    duration: 0,
    webhookConfigured: !!webhook,
    result: {
      success: false,
      picksFound: 0,
      alertsSent: 0,
      errors: 0
    }
  };

  try {
    const supabase = getSupabaseClient();

    // Fetch recently approved S/A tier picks from raw_props
    console.log('Fetching approved S/A tier picks from raw_props...\n');

    const { data: picks, error } = await supabase
      .from('raw_props')
      .select('*')
      .in('tier', ['S', 'A'])
      .eq('status', 'approved')
      .not('professional_score', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error(`Failed to fetch picks: ${error.message}`);
    }

    telemetry.result.picksFound = picks?.length || 0;

    console.log(`Found ${picks?.length || 0} approved picks\n`);

    if (!picks || picks.length === 0) {
      telemetry.result.success = true;
      console.log('No approved picks to alert');
    } else {
      if (webhook) {
        // Send alerts via Discord webhook
        console.log('Sending Discord alerts...\n');

        for (const pick of picks) {
          const embed = createPickEmbed(pick);
          const sent = await sendDiscordWebhook(webhook, embed);

          if (sent) {
            console.log(`✅ Sent alert for: ${pick.player_name} - ${pick.market}`);
            telemetry.result.alertsSent++;
          } else {
            console.log(`❌ Failed to send alert for: ${pick.player_name}`);
            telemetry.result.errors++;
          }

          // Rate limit: wait 1 second between alerts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        telemetry.result.success = telemetry.result.errors === 0;
      } else {
        console.log('⚠️  No webhook configured - DRY RUN');
        console.log('\nWould send alerts for:');
        picks.forEach(pick => {
          console.log(`  - ${pick.player_name} - ${pick.market} ${pick.selection} (${pick.tier} tier)`);
        });
        telemetry.result.success = true;
      }
    }

    // Display results
    console.log('\n' + '-'.repeat(80));
    console.log('RESULTS:');
    console.log(`  ✅ Picks Found: ${telemetry.result.picksFound}`);
    console.log(`  ✅ Alerts Sent: ${telemetry.result.alertsSent}`);
    console.log(`  ❌ Errors: ${telemetry.result.errors}`);

  } catch (error) {
    telemetry.result.success = false;
    telemetry.error = error instanceof Error ? error.message : String(error);

    console.log('\n❌ ERROR:');
    console.log(telemetry.error);
  }

  telemetry.duration = Date.now() - start;

  console.log(`\n⏱️  Duration: ${telemetry.duration}ms`);
  console.log('='.repeat(80) + '\n');

  return telemetry;
}

async function main() {
  const result = await runAlertAgentE2E();

  // Save telemetry to file
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-alert-agent.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`📊 Telemetry saved to: ${outPath}`);

  process.exit(result.result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
