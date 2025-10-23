import { NotificationPayload } from '../types';
interface SMSConfig {
    provider: string;
    apiKey: string;
    accountSid?: string;
    fromNumber?: string;
    enabled: boolean;
}
export declare function sendSMSNotification(payload: NotificationPayload, config: SMSConfig): Promise<void>;
export {};
//# sourceMappingURL=sms.d.ts.map