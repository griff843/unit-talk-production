"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupabaseClient = createSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const getEnv_1 = require("./getEnv");
function createSupabaseClient() {
    const env = (0, getEnv_1.getEnv)();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create Supabase client');
    }
    return (0, supabase_js_1.createClient)(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
