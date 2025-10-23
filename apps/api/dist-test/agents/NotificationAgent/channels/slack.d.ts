import { NotificationPayload } from '../types';
interface SlackConfig {
    webhookUrl: string;
    enabled: boolean;
    defaultChannel?: string;
}
export declare function sendSlackNotification(payload: NotificationPayload, config: SlackConfig): Promise<void>;
export {};
//# sourceMappingURL=slack.d.ts.map