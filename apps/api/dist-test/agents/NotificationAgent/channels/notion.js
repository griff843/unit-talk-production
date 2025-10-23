"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotionNotification = sendNotionNotification;
async function sendNotionNotification(payload, config) {
    if (!config.enabled || !config.apiKey) {
        return;
    }
    // TODO: Implement Notion notification sending
    console.log('[Notion] Would send notification:', payload);
}
