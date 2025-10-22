// Environment is read directly from process.env in cloud container
// (centralized /config/environment is not mounted in api-cloud profile)
import { normalizeCapperName } from '../utils/capperNormalization';
import { discordBotIntegration } from './DiscordBotIntegration';
import { createLogger } from '../utils/logger';

export type ThreadType = 'picks'|'qa';

export interface EnsureParams {
  discordId: string;
  capperHandle?: string;
  require?: ThreadType[]; // defaults to ['picks','qa']
  correlationId?: string;
}

export interface EnsureResult {
  picks_thread_id?: string;
  qa_thread_id?: string;
  source: 'db'|'env'|'auto_created'|'partial_env'|'not_found';
  created?: boolean;
}

/**
 * CapperThreadResolver
 * Lookup order: DB → .env → auto-provision (if enabled)
 * Persists any env-based lookups into DB for future authority.
 */
export class CapperThreadResolver {
  private logger = createLogger('CapperThreadResolver');
  private supabase = require('../utils/supabaseUtils').requireSupabase();

  private get flags() {
    return {
      dbEnabled: process.env.CAPPER_THREAD_DB_ENABLED === 'true',
      autoCreate: process.env.CAPPER_THREAD_AUTOCREATE === 'true',
    };
  }

  async getFromDb(discordId: string, type: ThreadType): Promise<string|null> {
    if (!this.flags.dbEnabled) return null;
    const { data, error } = await this.supabase
      .from('user_threads')
      .select('thread_id')
      .eq('discord_id', discordId)
      .eq('thread_type', type)
      .maybeSingle();
    if (error) {
      this.logger.warn({ error: error.message, discordId, type }, 'user_threads lookup failed');
      return null;
    }
    return data?.thread_id || null;
  }

  private getFromEnv(handle?: string, type?: ThreadType): string|null {
    if (!handle) return null;
    const canonical = normalizeCapperName(handle) || handle;
    // Only picks thread mapping was present historically; qa not stored in env
    if (type === 'qa') return null;
    const legacyMap = require('../config/env').env.capperThreads as Record<string,string>;
    return legacyMap[canonical] || null;
  }

  private async persistToDb(discordId: string, type: ThreadType, threadId: string, metadata?: any) {
    if (!this.flags.dbEnabled) return;
    const { error } = await this.supabase
      .from('user_threads')
      .upsert({ discord_id: discordId, thread_type: type, thread_id: threadId, metadata })
      .eq('discord_id', discordId)
      .eq('thread_type', type);
    if (error) this.logger.warn({ error: error.message, discordId, type, threadId }, 'persistToDb failed');
  }

  /** Ensure threads exist; auto-create if enabled. */
  async ensure(params: EnsureParams): Promise<EnsureResult> {
    const { discordId, capperHandle, require = ['picks','qa'], correlationId } = params;
    const result: EnsureResult = { source: 'not_found' };
    const meta = { correlationId, discordId, capperHandle };

    // 1) DB
    const dbPicks = require.includes('picks') ? await this.getFromDb(discordId, 'picks') : undefined;
    const dbQa = require.includes('qa') ? await this.getFromDb(discordId, 'qa') : undefined;

    if (dbPicks) result.picks_thread_id = dbPicks;
    if (dbQa) result.qa_thread_id = dbQa;
    if (dbPicks || dbQa) result.source = 'db';

    // 2) Env fallback (persist to DB when found)
    if (!result.picks_thread_id) {
      const envThread = this.getFromEnv(capperHandle, 'picks');
      if (envThread) {
        result.picks_thread_id = envThread;
        result.source = result.source === 'db' ? 'partial_env' : 'env';
        await this.persistToDb(discordId, 'picks', envThread, { persisted_from: 'env' });
      }
    }

    // 3) Auto-provision if enabled, missing, and forum configured
    const forumId = process.env.CAPPERS_FORUM_ID || '';
    if (this.flags.autoCreate && forumId) {
      if (require.includes('picks') && !result.picks_thread_id) {
        const created = await this.createCapperThread(forumId, capperHandle, 'picks', meta);
        if (created) {
          result.picks_thread_id = created;
          result.source = 'auto_created';
          result.created = true;
          await this.persistToDb(discordId, 'picks', created, { auto_created: true });
        }
      }
      if (require.includes('qa') && !result.qa_thread_id) {
        const created = await this.createCapperThread(forumId, capperHandle, 'qa', meta);
        if (created) {
          result.qa_thread_id = created;
          result.source = 'auto_created';
          result.created = true;
          await this.persistToDb(discordId, 'qa', created, { auto_created: true });
        }
      }
    }

    // Staff alerts on auto-create or unresolved
    if (result.source === 'auto_created') {
      await this.alertOps(`Auto-created personal thread(s) for ${capperHandle || discordId}`, result, meta);
    }
    if (!result.picks_thread_id && require.includes('picks')) {
      await this.alertOps(`Missing picks thread for ${capperHandle || discordId}`, result, meta);
    }

    return result;
  }

  private async createCapperThread(forumId: string, handle: string|undefined, type: ThreadType, meta: any): Promise<string|null> {
    try {
      const name = handle ? `[${type.toUpperCase()}] ${handle}` : `[${type.toUpperCase()}] Unknown`;
      const content = type === 'picks'
        ? 'Personal Picks Thread - Automated provisioning'
        : 'Personal Q&A Thread - Automated provisioning';
      const id = await discordBotIntegration.createForumThread(forumId, name, content);
      return id || null;
    } catch (e:any) {
      this.logger.error({ err: e?.message, forumId, type, meta }, 'createCapperThread failed');
      return null;
    }
  }

  private async alertOps(message: string, result: EnsureResult, meta: any) {
    try {
      const channelId = process.env.CH_OPS_BRIEFING || '';
      if (!channelId) return;
      await discordBotIntegration.postPlainText(channelId, `🔔 ${message}\nsource=${result.source} created=${result.created ? 'true' : 'false'}\nmeta=${JSON.stringify(meta)}`);
    } catch (e) {
      this.logger.warn({ err: (e as any)?.message }, 'alertOps failed');
    }
  }
}

export const capperThreadResolver = new CapperThreadResolver();

