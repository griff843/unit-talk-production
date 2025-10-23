import type { ReferralProgram } from '../../types/marketing';
import type { SupabaseClient } from '@supabase/supabase-js';
export declare class ReferralManager {
    private supabase;
    constructor(supabase: SupabaseClient, _config: any);
    checkHealth(): Promise<{
        status: string;
    }>;
    createReferral(params: Partial<ReferralProgram>): Promise<ReferralProgram>;
    updateReferral(id: string, updates: Partial<ReferralProgram>): Promise<ReferralProgram>;
    listReferrals(): Promise<ReferralProgram[]>;
}
//# sourceMappingURL=referrals.d.ts.map