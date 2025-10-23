import { EmbedBuilder } from 'discord.js';
interface DiscordConfig {
    webhookUrl: string;
    rateLimitMs: number;
    maxRetries: number;
    backoffMultiplier: number;
}
declare class DiscordAlertService {
    private client?;
    private config;
    private lastSentTime;
    private requestQueue;
    private isProcessingQueue;
    constructor(config?: Partial<DiscordConfig>);
    private enforceRateLimit;
    private retryWithBackoff;
    private processQueue;
    sendAlert(embed: EmbedBuilder): Promise<void>;
    sendBatchAlerts(embeds: EmbedBuilder[]): Promise<void>;
    getQueueStatus(): {
        queueLength: number;
        isProcessing: boolean;
    };
    testConnection(): Promise<boolean>;
}
declare const discordService: DiscordAlertService;
export declare function sendDiscordAlert(embed: EmbedBuilder): Promise<void>;
export declare function sendBatchDiscordAlerts(embeds: EmbedBuilder[]): Promise<void>;
export declare function getDiscordQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
};
export declare function testDiscordConnection(): Promise<boolean>;
export { discordService };
//# sourceMappingURL=discord.d.ts.map