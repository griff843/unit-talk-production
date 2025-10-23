"use strict";
/**
 * Provider Health Endpoint
 * Exposes provider status and last success time for monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProviderHealthEndpoint = getProviderHealthEndpoint;
const supabaseClient_1 = require("../../services/supabaseClient");
const activities_1 = require("../../agents/FeedAgent/activities");
async function getProviderHealthEndpoint(req, res) {
    try {
        // Get provider health from FeedAgent activities
        const providerData = await (0, activities_1.getProviderHealth)();
        // Get last raw props created time from database
        const { data: lastProp } = await supabaseClient_1.supabaseClient
            .from('raw_props')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
        const lastIngestion = lastProp?.[0]?.created_at || null;
        const lastIngestionTime = lastIngestion ? new Date(lastIngestion) : null;
        const minutesSinceLastIngestion = lastIngestionTime
            ? Math.floor((Date.now() - lastIngestionTime.getTime()) / (1000 * 60))
            : null;
        // Calculate freshness status
        let freshnessStatus = 'critical';
        if (minutesSinceLastIngestion !== null) {
            if (minutesSinceLastIngestion < 15) {
                freshnessStatus = 'fresh';
            }
            else if (minutesSinceLastIngestion < 60) {
                freshnessStatus = 'stale';
            }
        }
        const response = {
            timestamp: new Date().toISOString(),
            dataFreshness: {
                status: freshnessStatus,
                lastIngestion: lastIngestion,
                minutesSinceLastIngestion,
                statusText: getFreshnessStatusText(freshnessStatus, minutesSinceLastIngestion)
            },
            providers: providerData.providers,
            circuitBreakers: providerData.circuitBreakers
        };
        // Set cache headers to prevent caching
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.json(response);
    }
    catch (error) {
        console.error('Provider health endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get provider health',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}
function getFreshnessStatusText(status, minutes) {
    if (minutes === null)
        return 'No data ingested';
    switch (status) {
        case 'fresh':
            return `Fresh (${minutes}m ago)`;
        case 'stale':
            return `Stale (${minutes}m ago)`;
        case 'critical':
            return `Critical (${minutes}m ago)`;
        default:
            return 'Unknown';
    }
}
