"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = exports.SMSService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const env_1 = require("../config/env");
const logging_1 = require("./logging");
class SMSService {
    constructor() {
        this.client = null;
        const accountSid = env_1.env.TWILIO_ACCOUNT_SID;
        const authToken = env_1.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = env_1.env.TWILIO_FROM_NUMBER || '';
        if (accountSid && authToken) {
            this.client = (0, twilio_1.default)(accountSid, authToken);
        }
        else {
            logging_1.logger.warn('Twilio credentials not configured, SMS service disabled');
        }
    }
    async sendAlert(to, message) {
        if (!this.client) {
            logging_1.logger.warn('SMS service not configured');
            return false;
        }
        try {
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to
            });
            logging_1.logger.info('SMS sent successfully:', result.sid);
            return true;
        }
        catch (error) {
            logging_1.logger.error('SMS send failed:', error);
            return false;
        }
    }
    async healthCheck() {
        if (!this.client) {
            return false;
        }
        try {
            const accountSid = env_1.env.TWILIO_ACCOUNT_SID;
            if (!accountSid) {
                return false;
            }
            await this.client.api.accounts(accountSid).fetch();
            return true;
        }
        catch (error) {
            logging_1.logger.error('SMS service health check failed:', error);
            return false;
        }
    }
}
exports.SMSService = SMSService;
exports.smsService = new SMSService();
