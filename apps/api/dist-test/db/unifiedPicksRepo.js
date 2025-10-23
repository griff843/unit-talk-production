"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUnifiedPick = createUnifiedPick;
exports.patchUnifiedPick = patchUnifiedPick;
exports.findUnifiedPick = findUnifiedPick;
exports.listUnifiedPicks = listUnifiedPicks;
const supabaseClient_1 = require("../services/supabaseClient");
const shared_utils_1 = require("@unit-talk/shared-utils");
async function createUnifiedPick(pick) {
    const snake = (0, shared_utils_1.toSnakeKeys)(pick);
    const { data, error } = await supabaseClient_1.supabaseClient.from('unified_picks').insert(snake).select().single();
    if (error)
        throw error;
    return (0, shared_utils_1.toCamelKeys)(data);
}
async function patchUnifiedPick(id, patch) {
    const snake = (0, shared_utils_1.toSnakeKeys)(patch);
    const { data, error } = await supabaseClient_1.supabaseClient.from('unified_picks').update(snake).eq('id', id).select().single();
    if (error)
        throw error;
    return (0, shared_utils_1.toCamelKeys)(data);
}
async function findUnifiedPick(id) {
    const { data, error } = await supabaseClient_1.supabaseClient.from('unified_picks').select('*').eq('id', id).single();
    if (error)
        throw error;
    return (0, shared_utils_1.toCamelKeys)(data);
}
async function listUnifiedPicks(params = {}) {
    const { status, published, limit = 100 } = params;
    let q = supabaseClient_1.supabaseClient.from('unified_picks').select('*');
    if (status)
        q = q.eq('status', status);
    if (typeof published === 'boolean')
        q = q.eq('published', published);
    const { data, error } = await q.order('placed_at', { ascending: false }).limit(limit);
    if (error)
        throw error;
    return (0, shared_utils_1.toCamelKeys)(data);
}
