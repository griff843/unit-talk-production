"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRetoolAlert = sendRetoolAlert;
const axios_1 = __importDefault(require("axios"));
// import { env } from '../../../config/env';
const retoolWebhookUrl = process.env.RETOOL_ALERT_WEBHOOK || '';
/**
 * Sends an alert with advice to Retool via webhook or API.
 * The Retool dashboard should be set up to receive these for live ops display.
 */
async function sendRetoolAlert(alert, advice) {
    if (!retoolWebhookUrl) {
        throw new Error('No Retool webhook configured. Set RETOOL_ALERT_WEBHOOK in env.');
    }
    const payload = {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        source: alert.source,
        createdAt: alert.createdAt,
        meta: alert.meta,
        advice, // "Unit Talk advice"
    };
    try {
        const res = await axios_1.default.post(retoolWebhookUrl, payload);
        if (res.status >= 200 && res.status < 300) {
            return { status: 'sent', response: res.data };
        }
        else {
            throw new Error(`Retool webhook failed: ${res.status} ${res.statusText}`);
        }
    }
    catch (error) {
        console.error('Retool alert send failed:', error);
        throw error;
    }
}
