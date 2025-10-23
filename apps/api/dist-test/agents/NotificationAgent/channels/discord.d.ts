import { EmbedBuilder } from 'discord.js';
import { NotificationPayload, NotificationChannelConfig } from '../types';
export interface UnitTalkAlert {
    type: 'injury' | 'line_move' | 'middling' | 'info';
    title: string;
    summary: string;
    instruction: string;
    impact?: string | number;
    market?: string;
    player?: string;
    team?: string;
    oldLine?: string;
    oldOdds?: string;
    newLine?: string;
    newOdds?: string;
    source?: string;
    extraFields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
    timestamp?: Date | string;
}
export declare function buildUnitTalkAlertEmbed(alert: UnitTalkAlert): EmbedBuilder;
export declare function sendDiscordNotification(payload: NotificationPayload, config: NotificationChannelConfig): Promise<void>;
//# sourceMappingURL=discord.d.ts.map