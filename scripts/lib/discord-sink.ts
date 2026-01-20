/**
 * Discord Sink - Dual-Mode Discord Publishing Module
 *
 * Purpose: Enable E2E testing both locally (no webhook) and in CI (real webhook)
 * - REAL mode: Posts to actual Discord webhook when DISCORD_WEBHOOK_URL is set
 * - SINK mode: Writes to local files when no webhook is available
 *
 * This allows local E2E tests to pass without requiring Discord credentials
 * while CI tests can verify real Discord integration.
 */

import * as fs from 'fs';
import * as path from 'path';

export type DiscordMode = 'REAL' | 'SINK';

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface DiscordPostResult {
  success: boolean;
  mode: DiscordMode;
  timestamp: string;
  messageId?: string;
  sinkFile?: string;
  error?: string;
}

export interface DiscordSinkOptions {
  webhookUrl?: string;
  outputDir?: string;
}

export class DiscordSink {
  private webhookUrl: string | null;
  private outputDir: string;
  private messageCount: number = 0;

  constructor(options: DiscordSinkOptions = {}) {
    this.webhookUrl = options.webhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
    this.outputDir = options.outputDir || './e2e-output/discord-sink';
  }

  getMode(): DiscordMode {
    return this.webhookUrl ? 'REAL' : 'SINK';
  }

  isRealMode(): boolean {
    return this.webhookUrl !== null;
  }

  isSinkMode(): boolean {
    return this.webhookUrl === null;
  }

  async post(message: DiscordMessage): Promise<DiscordPostResult> {
    const timestamp = new Date().toISOString();

    if (this.isRealMode()) {
      return this.postReal(message, timestamp);
    } else {
      return this.postToSink(message, timestamp);
    }
  }

  private async postReal(
    message: DiscordMessage,
    timestamp: string
  ): Promise<DiscordPostResult> {
    try {
      const response = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          mode: 'REAL',
          timestamp,
          error: `Discord API error: ${response.status} - ${errorText}`,
        };
      }

      // Discord webhooks return 204 No Content on success
      // or JSON with message ID if wait=true
      let messageId: string | undefined;
      if (response.status !== 204) {
        try {
          const data = await response.json();
          messageId = data.id;
        } catch {
          // No JSON response, that's fine
        }
      }

      return {
        success: true,
        mode: 'REAL',
        timestamp,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        mode: 'REAL',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async postToSink(
    message: DiscordMessage,
    timestamp: string
  ): Promise<DiscordPostResult> {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      this.messageCount++;
      const filename = `discord-message-${this.messageCount}-${Date.now()}.json`;
      const filepath = path.join(this.outputDir, filename);

      const sinkData = {
        timestamp,
        mode: 'SINK',
        message,
        metadata: {
          messageNumber: this.messageCount,
          note: 'This message was sunk to file because no DISCORD_WEBHOOK_URL was set',
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(sinkData, null, 2));

      return {
        success: true,
        mode: 'SINK',
        timestamp,
        sinkFile: filepath,
      };
    } catch (error) {
      return {
        success: false,
        mode: 'SINK',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getSinkFiles(): string[] {
    if (!fs.existsSync(this.outputDir)) {
      return [];
    }
    return fs
      .readdirSync(this.outputDir)
      .filter((f) => f.startsWith('discord-message-'))
      .map((f) => path.join(this.outputDir, f));
  }

  clearSink(): void {
    const files = this.getSinkFiles();
    for (const file of files) {
      fs.unlinkSync(file);
    }
    this.messageCount = 0;
  }
}

/**
 * Create a pick announcement embed for Discord
 */
export function createPickEmbed(params: {
  username: string;
  betSlipId: string;
  pickType: string;
  selection: string;
  odds: number;
  game?: string;
  confidence?: number;
}): DiscordEmbed {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Bet Slip ID', value: params.betSlipId, inline: true },
    { name: 'Pick Type', value: params.pickType, inline: true },
    { name: 'Selection', value: params.selection, inline: false },
    { name: 'Odds', value: formatOdds(params.odds), inline: true },
  ];

  if (params.game) {
    fields.push({ name: 'Game', value: params.game, inline: true });
  }

  if (params.confidence !== undefined) {
    fields.push({
      name: 'Confidence',
      value: `${params.confidence}%`,
      inline: true,
    });
  }

  return {
    title: `New Pick from ${params.username}`,
    color: 0x00ff00, // Green
    fields,
    footer: { text: 'Unit Talk Picks' },
    timestamp: new Date().toISOString(),
  };
}

function formatOdds(odds: number): string {
  if (odds >= 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

// Default export for convenience
export default DiscordSink;
