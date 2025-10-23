import type { Campaign } from '../../types/marketing';
import type { SupabaseClient } from '@supabase/supabase-js';
export declare class CampaignManager {
    private supabase;
    constructor(supabase: SupabaseClient, _config: any);
    checkHealth(): Promise<{
        status: string;
    }>;
    createCampaign(params: Partial<Campaign>): Promise<Campaign>;
    updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign>;
    listCampaigns(): Promise<Campaign[]>;
}
//# sourceMappingURL=campaigns.d.ts.map