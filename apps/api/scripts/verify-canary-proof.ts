import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  console.log('======================================');
  console.log('CANARY PUBLISH VERIFICATION');
  console.log('======================================\n');

  const publishId = '5c30638e-2d1f-4fa0-ba21-8cb6542d3cbd';

  const { data: publishRecord, error } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('id', publishId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('SQL PROOF:');
  console.log(`\nSELECT * FROM pick_publish WHERE id = '${publishId}';\n`);
  console.log('Result:\n');
  console.log(`  id: ${publishRecord.id}`);
  console.log(`  pick_id: ${publishRecord.pick_id}`);
  console.log(`  tenant_id: ${publishRecord.tenant_id}`);
  console.log(`  channel: ${publishRecord.channel}`);
  console.log(`  discord_channel_id: ${publishRecord.discord_channel_id}`);
  console.log(`  status: ${publishRecord.status}`);
  console.log(`  external_message_id: ${publishRecord.external_message_id}`);
  console.log(`  attempts: ${publishRecord.attempts}`);
  console.log(`  last_error: ${publishRecord.last_error || 'null'}`);
  console.log(`  created_at: ${publishRecord.created_at}`);
  console.log(`  sent_at: ${publishRecord.sent_at || 'null'}`);

  console.log('\n======================================');
  console.log('VERIFICATION CHECKLIST:');
  console.log('======================================\n');

  const checks = [
    { name: 'status = \'sent\'', pass: publishRecord.status === 'sent' },
    { name: 'external_message_id IS NOT NULL', pass: !!publishRecord.external_message_id },
    { name: 'attempts <= 10 (max_attempts)', pass: publishRecord.attempts <= 10 },
    { name: 'last_error IS NULL', pass: !publishRecord.last_error },
    { name: 'channel = \'CANARY\'', pass: publishRecord.channel === 'CANARY' },
    { name: 'discord_channel_id = 1296531122234327100', pass: publishRecord.discord_channel_id === '1296531122234327100' },
  ];

  for (const check of checks) {
    console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
  }

  const allPassed = checks.every(c => c.pass);

  console.log('\n======================================');
  console.log('DISCORD PROOF:');
  console.log('======================================\n');
  console.log(`  Message ID: ${publishRecord.external_message_id}`);
  console.log(`  Channel ID: ${publishRecord.discord_channel_id}`);
  console.log(`  Channel: #✨・vip-canary`);
  console.log(`  Direct Link: https://discord.com/channels/1284478946171293736/${publishRecord.discord_channel_id}/${publishRecord.external_message_id}\n`);

  console.log('======================================');
  console.log(`FINAL VERDICT: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log('======================================\n');

  process.exit(allPassed ? 0 : 1);
})();
