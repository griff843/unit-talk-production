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
export declare function sendEmailNotification(payload: NotificationPayload, config: EmailConfig): Promise<void>;
export {};
//# sourceMappingURL=email.d.ts.map