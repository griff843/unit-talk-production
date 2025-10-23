import { SupabaseClient } from '@supabase/supabase-js';
import { ErrorHandler } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { BaseAgentConfig } from '../BaseAgent/types/index';
import { Contest } from './types';
export declare class ContestManager {
    private supabase;
    private logger;
    private errorHandler;
    private realtimeChannel;
    private metrics;
    constructor(supabase: SupabaseClient, logger: Logger, errorHandler: ErrorHandler, _config: BaseAgentConfig);
    private logContestEvent;
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    createContest(payload: Omit<Contest, 'id' | 'metrics'>): Promise<Contest>;
    checkHealth(): Promise<{
        status: string;
        timestamp: string;
        details: any;
    }>;
    getMetrics(): {
        contests: {
            active: number;
            completed: number;
            totalParticipants: number;
            prizeValueDistributed: number;
        };
        fairPlay: {
            checksPerformed: number;
            violationsDetected: number;
            appealRate: number;
            averageFairPlayScore: number;
        };
        performance: {
            processingTime: number;
            updateFrequency: number;
            errorRate: number;
            uptime: number;
        };
        healthStatus: {
            status: string;
            timestamp: string;
            details: {};
        };
    };
    private handleContestUpdate;
}
//# sourceMappingURL=contests.d.ts.map