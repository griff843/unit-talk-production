"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.sendBatchNotifications = sendBatchNotifications;
exports.sendNotifications = sendNotifications;
const logger_1 = require("../../../shared/logger");
const NotificationAgent_1 = require("../NotificationAgent");
const getDependencies = () => {
    return {
        logger: logger_1.logger,
        supabase: null, // Will be set by the agent
        errorHandler: {
            handleError: (error, context) => {
                logger_1.logger.error('Error in NotificationAgent', { error, context });
            }
        }
    };
};
const getConfig = () => {
    return {
        name: 'NotificationAgent',
        enabled: true,
        metrics: {
            enabled: true,
            interval: 30000
        }
    };
};
async function sendNotification(params) {
    const agent = NotificationAgent_1.NotificationAgent.getInstance(getConfig(), getDependencies());
    await agent.sendNotification(params);
}
async function sendBatchNotifications(params) {
    const agent = NotificationAgent_1.NotificationAgent.getInstance(getConfig(), getDependencies());
    await agent.sendBatchNotifications(params);
}
// Helper function to send notifications
async function sendNotifications(params) {
    const agent = NotificationAgent_1.NotificationAgent.getInstance(getConfig(), getDependencies());
    await agent.sendBatchNotifications(params);
}
