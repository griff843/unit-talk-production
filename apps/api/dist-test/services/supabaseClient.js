"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseClient = exports.supabase = exports.isSupabaseConfigured = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const getEnv_1 = require("../utils/getEnv");
const env = (0, getEnv_1.getEnv)();
exports.isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
let supabase = null;
exports.supabase = supabase;
if (exports.isSupabaseConfigured) {
    exports.supabase = supabase = (0, supabase_js_1.createClient)(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
exports.supabaseClient = supabase;
