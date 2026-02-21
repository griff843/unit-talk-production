/**
 * run-discord-worker-once.mjs
 * Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
 *
 * Simple script to post pending outbox items to Discord once.
 */
import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== DISCORD TICKET WORKER (ONCE) ===');
console.log('Webhook:', DISCORD_WEBHOOK_URL ? 'SET' : 'NOT SET');
console.log('Supabase URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('Supabase Key:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

if (!DISCORD_WEBHOOK_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Get pending items
  const { data: items, error } = await supabase.rpc('get_pending_discord_outbox', { p_limit: 10 });
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log(`\nPending items: ${items.length}`);

  for (const item of items) {
    console.log(`\nProcessing: ${item.ticket_id}`);
    console.log(`  Ticket type: ${item.ticket_type}`);
    console.log(`  Bet slip: ${item.bet_slip_id}`);

    // Build simple embed
    const legs = item.legs || [];
    const legsText = legs.map((l, i) => {
      const pv = l.provider_value || {};
      const sel = pv.selection || l.selection || '';
      const line = pv.line ?? l.provider_line ?? '';
      const odds = pv.odds ?? l.provider_odds ?? -110;
      const oddsStr = odds > 0 ? `+${odds}` : `${odds}`;
      if (pv.player_name) {
        return `${i+1}. ${pv.player_name} ${sel.toUpperCase()} ${line} ${pv.prop_type || ''} (${oddsStr})`;
      }
      if (pv.bet_type === 'moneyline') {
        const team = sel.toLowerCase() === 'home' ? pv.home_team : pv.away_team;
        return `${i+1}. ${team} ML (${oddsStr})`;
      }
      return `${i+1}. ${pv.sport || ''} ${pv.bet_type || ''} ${sel} (${oddsStr})`;
    }).join('\n');

    const embed = {
      title: `🎟️ ${item.ticket_type === 'parlay' ? `Parlay (${legs.length} Legs)` : 'Single'}`,
      color: legs.length >= 3 ? 0x00FF00 : 0x5865F2,
      description: legsText,
      fields: [
        { name: 'Stake', value: `${item.total_stake}U`, inline: true },
        { name: 'Provider', value: (legs[0]?.provider || legs[0]?.provider_value?.provider || 'Unknown').toUpperCase(), inline: true },
      ],
      footer: { text: `Unit Talk | Not Financial Advice | ${item.bet_slip_id.slice(0, 12)}...` },
      timestamp: new Date().toISOString(),
    };

    console.log('  Embed built, posting...');

    try {
      const resp = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
        username: 'Unit Talk Tickets',
        embeds: [embed],
      });
      const msgId = resp.data?.id;
      console.log(`  ✓ Posted! Message ID: ${msgId}`);

      // Mark as posted
      await supabase.rpc('mark_discord_outbox_posted', {
        p_outbox_id: item.outbox_id,
        p_discord_message_id: msgId,
        p_discord_channel_id: resp.data?.channel_id || null,
      });
      console.log('  ✓ Marked as posted');
    } catch (e) {
      console.error(`  ✗ Post failed: ${e.message}`);
      await supabase.rpc('mark_discord_outbox_failed', {
        p_outbox_id: item.outbox_id,
        p_error: e.message,
      });
    }
  }
  console.log('\nDone');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
