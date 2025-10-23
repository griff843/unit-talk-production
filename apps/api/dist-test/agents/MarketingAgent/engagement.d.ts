import type { EngagementMetrics } from '../../types/marketing';
import type { SupabaseClient } from '@supabase/supabase-js';
export declare class EngagementTracker {
    private supabase;
    constructor(supabase: SupabaseClient, _config: any);
    checkHealth(): Promise<{
        status: string;
    }>;
    generateReport(params?: {
        start?: Date;
        end?: Date;
    }): Promise<EngagementMetrics>;
}
//# sourceMappingURL=engagement.d.ts.map