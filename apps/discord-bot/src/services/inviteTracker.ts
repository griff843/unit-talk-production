import { Client, Guild, Invite, Collection } from 'discord.js';
import { getCache } from './enterpriseCache';
import { logger } from '../utils/logger';

/**
 * InviteTracker
 * - Snapshots guild invites and detects which invite was used when a member joins
 * - Resolves role_intent stored by /gen-invite in Redis at key:
 *   ut:invites:intents:<guildId>:<inviteCode>
 */
export class InviteTracker {
  private client: Client;
  // guildId -> (inviteCode -> uses)
  private previousInvites: Map<string, Map<string, number>> = new Map();
  // guildId -> last deleted invite (helps attribute single-use invites that disappear on use)
  private lastDeleted: Map<string, { code: string; at: number }> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  /** Initialize snapshot for all guilds */
  async init(): Promise<void> {
    try {
      const guilds = this.client.guilds.cache;
      for (const [, guild] of guilds) {
        await this.snapshotGuildInvites(guild).catch(err => {
          logger.warn('[InviteTracker] snapshotGuildInvites failed', {
            guildId: guild.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
      logger.info('[InviteTracker] Initial invite snapshots completed');
    } catch (error) {
      logger.error('[InviteTracker] init error', error);
    }
  }

  /** Update snapshot when an invite is created */
  async handleInviteCreate(invite: Invite): Promise<void> {
    try {
      const guild = invite.guild;
      if (!guild) return;
      // Ensure snapshot exists
      await this.ensureSnapshot(guild);
      // Add/refresh this invite with current uses (0 or existing)
      const map = this.previousInvites.get(guild.id)!;
      map.set(invite.code, invite.uses ?? 0);
    } catch (error) {
      logger.warn('[InviteTracker] handleInviteCreate error', { error: String(error) });
    }
  }

  /** Update snapshot when an invite is deleted */
  async handleInviteDelete(invite: Invite): Promise<void> {
    try {
      const guild = invite.guild;
      if (!guild) return;
      const map = this.previousInvites.get(guild.id);
      if (map) {
        map.delete(invite.code);
      }
      // Track last deleted invite for attribution of single-use codes
      this.lastDeleted.set(guild.id, { code: invite.code, at: Date.now() });
    } catch (error) {
      logger.warn('[InviteTracker] handleInviteDelete error', { error: String(error) });
    }
  }

  /** Resolve role_intent for the invite used by the latest joining member */
  async resolveInviteIntent(guild: Guild): Promise<{ code: string; intent: string } | null> {
    try {
      const usedCode = await this.detectUsedInvite(guild);
      if (!usedCode) {
        logger.info('[InviteTracker] No used invite detected on join', { guildId: guild.id });
        return null;
      }

      const cache = getCache();
      const key = `invites:intents:${guild.id}:${usedCode}`;
      const data = await cache.get<any>(key);

      const intent = data?.role_intent || data?.intent || null;

      logger.info('[InviteTracker] Invite attribution result', {
        guildId: guild.id,
        usedCode,
        intent,
        cacheHit: !!data,
      });

      if (!intent) return null;
      return { code: usedCode, intent };
    } catch (error) {
      logger.warn('[InviteTracker] resolveInviteIntent error', {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Detect which invite code was used: compare current vs previous uses and update snapshot */
  private async detectUsedInvite(guild: Guild): Promise<string | null> {
    try {
      const prev = await this.ensureSnapshot(guild);
      const currentInvites = await guild.invites.fetch().catch(() => null);
      if (!currentInvites) {
        logger.warn('[InviteTracker] Unable to fetch invites (permissions?)', { guildId: guild.id });
        return null;
      }

      // Build current map and find increased uses
      let usedCode: string | null = null;
      const nextMap: Map<string, number> = new Map();

      currentInvites.forEach(inv => {
        const uses = inv.uses ?? 0;
        nextMap.set(inv.code, uses);
        const prevUses = prev.get(inv.code) ?? 0;
        if (uses > prevUses) {
          usedCode = inv.code;
        }
      });

      // Update snapshot
      this.previousInvites.set(guild.id, nextMap);

      // If we didn't detect increased uses, check for a very recent deletion (single-use invite)
      if (!usedCode) {
        const last = this.lastDeleted.get(guild.id);
        if (last && Date.now() - last.at < 60_000) {
          usedCode = last.code;
        }
      }

      return usedCode;
    } catch (error) {
      logger.warn('[InviteTracker] detectUsedInvite error', { guildId: guild.id, error: String(error) });
      return null;
    }
  }

  /** Ensure we have a snapshot for the guild; if not, create one now */
  private async ensureSnapshot(guild: Guild): Promise<Map<string, number>> {
    let map = this.previousInvites.get(guild.id);
    if (map) return map;

    map = await this.snapshotGuildInvites(guild);
    return map;
  }

  /** Fetch invites for guild and store snapshot */
  private async snapshotGuildInvites(guild: Guild): Promise<Map<string, number>> {
    const invites = await guild.invites.fetch().catch(() => null);
    const map: Map<string, number> = new Map();
    if (invites) {
      invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
    }
    this.previousInvites.set(guild.id, map);
    return map;
  }
}

