import nodemailer from 'nodemailer';
import { NotificationPayload } from '../types';

interface EmailConfig {
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  enabled: boolean;
}

let transporter: nodemailer.Transporter | null = null;

export async function sendEmailNotification(
  payload: NotificationPayload,
  config: EmailConfig
): Promise<void> {
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
  } catch (error) {
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

function formatEmailContent(payload: NotificationPayload): { text: string; html: string } {
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