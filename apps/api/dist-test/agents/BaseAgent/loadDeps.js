"use strict";
// src/agents/BaseAgent/loadDeps.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBaseAgentDependencies = loadBaseAgentDependencies;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../../config/env");
const errorHandling_1 = require("../../utils/errorHandling");
const logger_1 = require("../../utils/logger");
async function loadBaseAgentDependencies() {
    const supabaseUrl = env_1.env.supabase.url;
    const supabaseServiceRoleKey = env_1.env.supabase.serviceRoleKey;
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false }
    });
    const logger = (0, logger_1.makeLogger)('BaseAgent');
    const errorHandler = new errorHandling_1.ErrorHandler('BaseAgent', supabase);
    return {
        supabase,
        logger,
        errorHandler,
    };
}
