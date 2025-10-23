"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralManager = void 0;
class ReferralManager {
    constructor(supabase, _config) {
        this.supabase = supabase;
    }
    async checkHealth() {
        const { error } = await this.supabase.from('referral_programs').select('id').limit(1);
        return { status: error ? 'failed' : 'healthy' };
    }
    async createReferral(params) {
        if (!params.name) {
            throw new Error('name is required');
        }
        const { data, error } = await this.supabase
            .from('referral_programs')
            .insert([params])
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    async updateReferral(id, updates) {
        const { data, error } = await this.supabase
            .from('referral_programs')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    async listReferrals() {
        const { data, error } = await this.supabase.from('referral_programs').select('*');
        if (error) {
            throw error;
        }
        return data;
    }
}
exports.ReferralManager = ReferralManager;
