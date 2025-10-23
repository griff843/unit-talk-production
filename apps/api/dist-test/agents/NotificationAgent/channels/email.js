"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailNotification = sendEmailNotification;
const nodemailer = __importStar(require("nodemailer"));
let transporter = null;
async function sendEmailNotification(payload, config) {
    if (!config.enabled) {
        throw new Error('Email notifications are not enabled');
    }
    if (!transporter) {
        transporter = nodemailer.createTransport(config.smtpConfig);
    }
    const emailContent = formatEmailContent(payload);
    try {
        await transporter.sendMail({
            from: config.smtpConfig.auth.user,
            to: payload.to?.join(',') || config.smtpConfig.auth.user,
            subject: payload.title || 'Unit Talk Notification',
            text: emailContent.text,
            html: emailContent.html,
            attachments: payload.attachments
        });
    }
    catch (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
function formatEmailContent(payload) {
    const text = `${payload.title || 'Notification'}\n\n${payload.message}`;
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { padding: 20px; }
          .header { background: #f8f9fa; padding: 10px; }
          .content { margin: 20px 0; }
          .footer { color: #6c757d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${payload.title || 'Notification'}</h2>
          </div>
          <div class="content">
            ${payload.message}
          </div>
          <div class="footer">
            Sent by Unit Talk Platform
          </div>
        </div>
      </body>
    </html>
  `;
    return { text, html };
}
