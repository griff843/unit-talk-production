"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementTracker = void 0;
class EngagementTracker {
    constructor(supabase, _config) {
        this.supabase = supabase;
    }
    async checkHealth() {
        // If metrics are just a view, still check queryability
        const { error } = await this.supabase.from('engagement_metrics').select('usersReached').limit(1);
        return { status: error ? 'failed' : 'healthy' };
    }
    async generateReport(params = {}) {
        let query = this.supabase.from('engagement_metrics').select('*').order('timestamp', { ascending: false }).limit(1);
        if (params.start && params.end) {
            query = this.supabase.from('engagement_metrics').select('*')
                .gte('timestamp', params.start.toISOString())
                .lte('timestamp', params.end.toISOString())
                .order('timestamp', { ascending: false })
                .limit(1);
        }
        const { data, error } = await query.single();
        if (error) {
            throw error;
        }
        return data;
    }
}
exports.EngagementTracker = EngagementTracker;
