"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignManager = void 0;
class CampaignManager {
    constructor(supabase, _config) {
        this.supabase = supabase;
        // Config can be used for feature toggles, etc.
    }
    async checkHealth() {
        // Health: Check if campaigns table is queryable
        const { error } = await this.supabase.from('campaigns').select('id').limit(1);
        return { status: error ? 'failed' : 'healthy' };
    }
    async createCampaign(params) {
        if (!params.name || !params.startDate) {
            throw new Error('name and startDate are required');
        }
        const { data, error } = await this.supabase
            .from('campaigns')
            .insert([params])
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    async updateCampaign(id, updates) {
        const { data, error } = await this.supabase
            .from('campaigns')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    async listCampaigns() {
        const { data, error } = await this.supabase.from('campaigns').select('*');
        if (error) {
            throw error;
        }
        return data;
    }
}
exports.CampaignManager = CampaignManager;
