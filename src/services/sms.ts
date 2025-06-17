
import twilio from 'twilio';
import { logger } from './logging';

export class SMSService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      logger.warn('Twilio credentials not configured, SMS service disabled');
    }
  }

  async sendAlert(to: string, message: string): Promise<boolean> {
    if (!this.client) {
      logger.warn('SMS service not configured');
      return false;
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to
      });

      logger.info('SMS sent successfully:', result.sid);
      return true;
    } catch (error) {
      logger.error('SMS send failed:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      if (!accountSid) return false;
      await this.client.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      logger.error('SMS service health check failed:', error);
      return false;
    }
  }
}

export const smsService = new SMSService();
