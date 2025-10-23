import { NotificationPayload } from '../types';
export interface NotionChannelConfig {
    enabled: boolean;
    apiKey?: string;
    databaseId?: string;
}
export declare function sendNotionNotification(payload: NotificationPayload, config: NotionChannelConfig): Promise<void>;
//# sourceMappingURL=notion.d.ts.map