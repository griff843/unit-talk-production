import { Guild, Invite } from 'discord.js';
import { getCache } from '../../services/enterpriseCache';

export class InviteIntentService {
  private cache = getCache();

  private snapshotKey(guildId: string) {
    return `invites:snapshot:${guildId}`;
  }

  async preloadInvites(guild: Guild): Promise<void> {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    const snapshot = Array.from(invites.values()).map((i: any) => ({ code: i.code, uses: i.uses ?? 0 }));
    await this.cache.set(this.snapshotKey(guild.id), snapshot, { ttl: 24 * 3600 });
  }

  async resolveJoin(guild: Guild, delayMs: number = 800): Promise<{ code?: string; role_intent?: string } | null> {
    await new Promise(r => setTimeout(r, delayMs));
    const before = (await this.cache.get<any[]>(this.snapshotKey(guild.id))) || [];
    const nowInvites = await guild.invites.fetch().catch(() => null);
    if (!nowInvites) return null;

    const after = Array.from(nowInvites.values()).map((i: any) => ({ code: i.code, uses: i.uses ?? 0 }));

    // Find code whose uses increased
    for (const a of after) {
      const prev = before.find(b => b.code === a.code);
      if (prev && a.uses > prev.uses) {
        const intent = await this.cache.get<any>(`invites:intents:${guild.id}:${a.code}`);
        return { code: a.code, role_intent: intent?.role_intent };
      }
    }

    // Unknown invite - increment metric
    await this.cache.increment('metrics:discord:invite_unknown', 1);
    return null;
  }
}

