"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordService = void 0;
exports.sendDiscordAlert = sendDiscordAlert;
exports.sendBatchDiscordAlerts = sendBatchDiscordAlerts;
exports.getDiscordQueueStatus = getDiscordQueueStatus;
exports.testDiscordConnection = testDiscordConnection;
const discord_js_1 = require("discord.js");
const ShadowMode_1 = require("../../../shadow/ShadowMode");
class DiscordAlertService {
    constructor(config) {
        this.lastSentTime = 0;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        // Priority: Use dedicated alerts channel ID if available, fallback to webhook
        const alertsChannelId = process.env.ALERTS_CHANNEL_ID;
        const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
        // In development mode, allow startup without valid Discord webhooks
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (!isDevelopment && !alertsChannelId && !webhookUrl) {
            throw new Error('Either ALERTS_CHANNEL_ID or DISCORD_ALERT_WEBHOOK environment variable is required');
        }
        this.config = {
            webhookUrl: webhookUrl || '',
            rateLimitMs: 2000, // 2 seconds between requests (Discord allows 30/min)
            maxRetries: 3,
            backoffMultiplier: 2,
            ...config
        };
        // Only create webhook client in production or with valid webhook URL
        if (webhookUrl && !isDevelopment && webhookUrl.includes('discord.com/api/webhooks/') && !webhookUrl.includes('placeholder')) {
            this.client = new discord_js_1.WebhookClient({ url: this.config.webhookUrl });
        }
    }
    async enforceRateLimit() {
        const timeSinceLastSent = Date.now() - this.lastSentTime;
        if (timeSinceLastSent < this.config.rateLimitMs) {
            const waitTime = this.config.rateLimitMs - timeSinceLastSent;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastSentTime = Date.now();
    }
    async retryWithBackoff(operation, attempt = 1) {
        try {
            return await operation();
        }
        catch (error) {
            if (attempt >= this.config.maxRetries) {
                throw error;
            }
            const delay = Math.pow(this.config.backoffMultiplier, attempt - 1) * 1000;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`Discord send failed (attempt ${attempt}/${this.config.maxRetries}), retrying in ${delay}ms:`, errorMessage);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryWithBackoff(operation, attempt + 1);
        }
    }
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (request) {
                try {
                    await this.enforceRateLimit();
                    await request();
                }
                catch (error) {
                    console.error('Failed to process Discord queue item:', error);
                }
            }
        }
        this.isProcessingQueue = false;
    }
    async sendAlert(embed) {
        // In shadow mode, route to shadow preview instead of public channels
        if ((0, ShadowMode_1.isShadowMode)()) {
            await (0, ShadowMode_1.shadowPublishPreview)(embed.data);
            return;
        }
        return new Promise((resolve, reject) => {
            const request = async () => {
                try {
                    if (!this.client) {
                        throw new Error('Discord client not initialized');
                    }
                    await this.retryWithBackoff(async () => {
                        await this.client.send({ embeds: [embed] });
                    });
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            this.requestQueue.push(request);
            this.processQueue();
        });
    }
    async sendBatchAlerts(embeds) {
        // In shadow mode, route to shadow preview instead of public channels
        if ((0, ShadowMode_1.isShadowMode)()) {
            // Send each embed to shadow preview
            for (const embed of embeds) {
                await (0, ShadowMode_1.shadowPublishPreview)(embed.data);
            }
            return;
        }
        // Discord allows up to 10 embeds per message
        const batches = [];
        for (let i = 0; i < embeds.length; i += 10) {
            batches.push(embeds.slice(i, i + 10));
        }
        const batchPromises = batches.map(batch => new Promise((resolve, reject) => {
            const request = async () => {
                try {
                    if (!this.client) {
                        throw new Error('Discord client not initialized');
                    }
                    await this.retryWithBackoff(async () => {
                        await this.client.send({ embeds: batch });
                    });
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            this.requestQueue.push(request);
        }));
        this.processQueue();
        await Promise.all(batchPromises);
    }
    getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessingQueue
        };
    }
    async testConnection() {
        try {
            // Send a minimal test embed
            const testEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('🔧 Discord Connection Test')
                .setDescription('This is a test message to verify webhook connectivity')
                .setColor(0x00FF00)
                .setTimestamp();
            // In shadow mode, test goes to shadow preview
            if ((0, ShadowMode_1.isShadowMode)()) {
                await (0, ShadowMode_1.shadowPublishPreview)(testEmbed.data);
                return true;
            }
            await this.sendAlert(testEmbed);
            return true;
        }
        catch (error) {
            console.error('Discord connection test failed:', error);
            return false;
        }
    }
}
// Create singleton instance
const discordService = new DiscordAlertService();
exports.discordService = discordService;
// Export the main function for backward compatibility
async function sendDiscordAlert(embed) {
    // In shadow mode, route to shadow preview instead of public channels
    if ((0, ShadowMode_1.isShadowMode)()) {
        await (0, ShadowMode_1.shadowPublishPreview)(embed.data);
        return;
    }
    return discordService.sendAlert(embed);
}
// Export additional functions for enhanced functionality
async function sendBatchDiscordAlerts(embeds) {
    // In shadow mode, route to shadow preview instead of public channels
    if ((0, ShadowMode_1.isShadowMode)()) {
        for (const embed of embeds) {
            await (0, ShadowMode_1.shadowPublishPreview)(embed.data);
        }
        return;
    }
    return discordService.sendBatchAlerts(embeds);
}
function getDiscordQueueStatus() {
    return discordService.getQueueStatus();
}
async function testDiscordConnection() {
    return discordService.testConnection();
}
