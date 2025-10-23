import { Client } from 'discord.js';
export declare class DailyPickPublisher {
    private client;
    private channelId;
    private isRunning;
    constructor(client: Client, channelId: string);
    publishDailyPicks(): Promise<void>;
    private publishCapperPicks;
    getStatus(): {
        running: boolean;
        nextRun: string;
    };
}
export declare const dailyPickPublisher: (client: Client, channelId: string) => DailyPickPublisher;
//# sourceMappingURL=dailyPickPublisher.d.ts.map