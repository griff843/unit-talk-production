import Redis from 'ioredis';
import { Client, GuildMember } from 'discord.js';
import botConfig from '../config';
import { logger } from '../utils/logger';
import { OnboardingService } from './onboardingService';
import { Suppression } from './suppression';

// Minimal, production-safe subscriber for role change events
// Channel: ut:roles:change
// Message shape: { type: 'role.change', source: 'whop', userId: string, targetTier: 'trial'|'member'|'vip'|'vip_plus', occurred_at?: string }
export class RoleAssignmentConsumer {
  private client: Client;
  private sub: Redis;
  private onboarding: OnboardingService;
  private readonly channel = 'ut:roles:change';

  constructor(client: Client, onboardingService: OnboardingService) {
    this.client = client;
    this.onboarding = onboardingService;
    this.sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.sub.on('error', (err) => logger.warn('[RoleConsumer] Redis error', { error: (err as Error).message }));
  }

  async start(): Promise<void> {
    await this.sub.subscribe(this.channel);
    logger.info(`[RoleConsumer] Subscribed to ${this.channel}`);

    this.sub.on('message', async (channel, message) => {
      if (channel !== this.channel) return;
      try {
        const evt = JSON.parse(message);
        if (!evt || evt.type !== 'role.change' || !evt.userId || !evt.targetTier) return;
        await this.applyRoleChange(evt.userId as string, String(evt.targetTier) as any);
      } catch (e) {
        logger.error('[RoleConsumer] Failed processing message', { error: (e as Error).message });
      }
    });
  }

  private async applyRoleChange(userId: string, targetTier: 'trial'|'member'|'vip'|'vip_plus'): Promise<void> {
    const guildId = botConfig.discord.guildId;
    const guild = this.client.guilds.cache.get(guildId) || await this.client.guilds.fetch(guildId);
    let member: GuildMember;
    try {
      member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
    } catch (e) {
      logger.warn('[RoleConsumer] Member not found in guild', { userId });
      return;
    }

    // Mark suppression so the guildMemberUpdate listener doesn't double-trigger onboarding
    Suppression.mark(userId, 15000);

    const roleIds = {
      trial: (botConfig as any).roles.trial || '',
      vip: (botConfig as any).roles.vip || '',
      vip_plus: (botConfig as any).roles.vipPlus || '',
    } as const;

    const toRemove = [roleIds.trial, roleIds.vip, roleIds.vip_plus].filter(Boolean);
    const add: string[] = [];

    if (targetTier === 'trial' && roleIds.trial) add.push(roleIds.trial);
    if (targetTier === 'vip' && roleIds.vip) add.push(roleIds.vip);
    if (targetTier === 'vip_plus' && roleIds.vip_plus) add.push(roleIds.vip_plus);

    try {
      // Remove higher/lateral roles to maintain invariants
      const current = member.roles.cache;
      for (const r of toRemove) {
        if (r && current.has(r)) await member.roles.remove(r).catch(() => undefined);
      }
      for (const r of add) {
        if (r && !current.has(r)) await member.roles.add(r).catch(() => undefined);
      }

      logger.info('[RoleConsumer] Applied role change', { userId, targetTier, added: add, removed: toRemove });

      // Trigger onboarding DMs based on tier
      if (targetTier === 'trial') {
        await this.onboarding.handleUserOnboarding(member.user, 'trial', false).catch(() => undefined);
      } else if (targetTier === 'vip') {
        await this.onboarding.handleUserOnboarding(member.user, 'vip', false).catch(() => undefined);
      } else if (targetTier === 'vip_plus') {
        await this.onboarding.handleUserOnboarding(member.user, 'vip_plus', false).catch(() => undefined);
      }
    } catch (e) {
      logger.error('[RoleConsumer] Failed to apply role change', { error: (e as Error).message });
    }
  }
}

