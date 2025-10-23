import { Client } from 'discord.js';
export interface CapperSystemConfig {
    discordClient: Client;
    publishingChannelId: string;
    enabled: boolean;
}
export declare class CapperSystem {
    private config;
    private publisher;
    private initialized;
    constructor(config: CapperSystemConfig);
    initialize(): Promise<void>;
    publishDailyPicks(): Promise<void>;
    getStatus(): {
        initialized: boolean;
        error: string;
        client?: undefined;
        database?: undefined;
        publisher?: undefined;
        config?: undefined;
    } | {
        initialized: boolean;
        client: {
            ready: boolean;
            user: string | null;
            guilds: number;
            uptime: number | null;
        };
        database: {
            connected: boolean;
        };
        publisher: {
            running: boolean;
            nextRun: string;
        };
        config: {
            enabled: boolean;
            publishingChannelId: string;
        };
        error?: undefined;
    };
    isInitialized(): boolean;
}
export declare function createCapperSystem(config: CapperSystemConfig): CapperSystem;
export declare function getCapperSystem(): CapperSystem;
//# sourceMappingURL=capperSystem.d.ts.map