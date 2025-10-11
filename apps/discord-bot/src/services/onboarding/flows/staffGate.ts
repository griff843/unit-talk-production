import { GuildMember } from 'discord.js';
import { supabaseService } from '../../../services/supabase';
import { getCache } from '../../../services/enterpriseCache';
import bcrypt from 'bcryptjs';

export async function verifyStaffCode(member: GuildMember, inputCode: string): Promise<{ ok: boolean; message: string }>{
  const { data: codes, error } = await supabaseService.client
    .from('staff_access_codes')
    .select('id, code_hash, status, expires_at, max_attempts, attempts')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (error) return { ok: false, message: `DB error: ${error.message}` };

  let matched: any = null;
  for (const row of codes || []) {
    if (await bcrypt.compare(inputCode, row.code_hash)) { matched = row; break; }
  }

  if (!matched) {
    // increment fail metric (24h TTL)
    await getCache().increment('metrics:discord:staff_code_fail', 1, { ttl: 24 * 3600 });
    return { ok: false, message: 'Invalid or expired code' };
  }

  const roleId = process.env.STAFF_ROLE_ID;
  if (!roleId) return { ok: false, message: 'STAFF_ROLE_ID not configured' };

  try {
    await member.roles.add(roleId);
  } catch (e) {
    return { ok: false, message: `Failed to assign role: ${(e as Error).message}` };
  }

  await supabaseService.client
    .from('staff_access_codes')
    .update({ status: 'used', verified_by: 'bot', verified_at: new Date().toISOString(), discord_id: member.id })
    .eq('id', matched.id);

  // increment success metric (24h TTL)
  await getCache().increment('metrics:discord:staff_code_success', 1, { ttl: 24 * 3600 });

  return { ok: true, message: 'Staff role assigned' };
}

