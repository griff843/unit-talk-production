import bcrypt from 'bcryptjs';
import { supabaseService } from '../services/supabase';
import { verifyStaffCode } from '../services/onboarding/flows/staffGate';
import { getCache } from '../services/enterpriseCache';

async function main() {
  const correctCode = '919191';
  const wrongCode = '000000';

  // Ensure Redis is connected before triggering increments inside verifyStaffCode
  const health = await getCache().healthCheck();
  console.log('Redis health:', health);

  // 1) Insert a fresh staff code (active, future expiry)
  const hash = bcrypt.hashSync(correctCode, 10);
  const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString(); // +4h

  const insertRes = await supabaseService.client
    .from('staff_access_codes')
    .insert({
      code_hash: hash,
      created_by: 'smoke-test',
      expires_at: expiresAt,
      max_attempts: 3,
      status: 'active',
      metadata: { label: 'smoke-test' },
    } as any)
    .select('id')
    .single();

  if (insertRes.error) {
    console.error('Failed to insert test staff code:', insertRes.error.message);
    process.exit(1);
  }

  const codeId = insertRes.data.id;
  console.log('Inserted test staff code id:', codeId);

  // Prepare a minimal GuildMember stub (only what verifyStaffCode uses)
  const member: any = {
    id: '999999999999999999',
    roles: {
      add: async (roleId: string) => {
        console.log(`[stub] roles.add called with roleId=${roleId}`);
      },
    },
  };

  // 2) Intentional failure with wrong code
  const failRes = await verifyStaffCode(member, wrongCode);
  console.log('Fail attempt result:', failRes);

  // 3) Success with correct code
  const successRes = await verifyStaffCode(member, correctCode);
  console.log('Success attempt result:', successRes);

  console.log('Smoke test complete. Use redis-cli to read ut:metrics:discord:staff_code_* counters.');
}

main().catch((err) => {
  console.error('Smoke test error:', err);
  process.exit(1);
});

