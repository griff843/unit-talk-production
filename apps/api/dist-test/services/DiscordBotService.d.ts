import { EmbedBuilder } from 'discord.js';
/**
 * DiscordBotService - Direct Discord bot integration for sending messages
 * Uses the Discord bot token to send messages directly to channels
 */
export declare class DiscordBotService {
    private static instance;
    private client;
    private isReady;
    private readyPromise;
    private constructor();
    static getInstance(): DiscordBotService;
    private initialize;
    /**
     * Send embed to specific Discord channel
     */
    sendEmbed(channelId: string, embed: EmbedBuilder): Promise<void>;
    /**
     * Send plain text message to specific Discord channel
     */
    sendMessage(channelId: string, content: string): Promise<void>;
    /**
     * Send embed to specific Discord thread
     * CRITICAL FIX: This method was missing and causing VIPPlusChannelService errors
     */
    sendEmbedToThread(threadId: string, embed: EmbedBuilder): Promise<void>;
    /**
     * Send message with embed to specific Discord thread
     */
    sendMessageToThread(threadId: string, content: string, embed?: EmbedBuilder): Promise<void>;
    /**
     * Send direct message to a specific user
     */
    sendDirectMessage(userId: string, embed: EmbedBuilder): Promise<void>;
    /**
     * Test connection by sending a test message
     */
    testConnection(channelId?: string): Promise<boolean>;
    /**
     * Get bot status information
     */
    getStatus(): {
        ready: boolean;
        guildCount: number;
        userTag: string | null;
    };
    /**
     * Gracefully shutdown the Discord bot
     */
    shutdown(): Promise<void>;
}
export declare const discordBotService: DiscordBotService;
//# sourceMappingURL=DiscordBotService.d.ts.map