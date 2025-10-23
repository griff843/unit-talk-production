"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEdgeConfig = fetchEdgeConfig;
const supabaseClient_1 = require("../services/supabaseClient");
async function fetchEdgeConfig() {
    const { data, error } = await supabaseClient_1.supabase
        .from('edge_config')
        .select('config')
        .eq('key', 'default')
        .single();
    if (error || !data) {
        throw new Error('Failed to fetch edge config');
    }
    return data.config;
}
