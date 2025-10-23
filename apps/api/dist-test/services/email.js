"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logging_1 = require("./logging");
class EmailService {
    constructor() {
        this.config = {
            host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
            port: parseInt(process.env['SMTP_PORT'] || '587'),
            secure: process.env['SMTP_SECURE'] === 'true',
            auth: {
                user: process.env['SMTP_USER'] || '',
                pass: process.env['SMTP_PASS'] || ''
            }
        };
        this.transporter = nodemailer_1.default.createTransport(this.config);
    }
    async sendAlert(to, subject, html) {
        try {
            const info = await this.transporter.sendMail({
                from: process.env['SMTP_FROM'] || this.config.auth.user,
                to,
                subject,
                html
            });
            logging_1.logger.info('Email sent successfully:', info.messageId);
            return true;
        }
        catch (error) {
            logging_1.logger.error('Email send failed:', error);
            return false;
        }
    }
    async healthCheck() {
        try {
            await this.transporter.verify();
            return true;
        }
        catch (error) {
            logging_1.logger.error('Email service health check failed:', error);
            return false;
        }
    }
}
exports.EmailService = EmailService;
exports.emailService = new EmailService();
