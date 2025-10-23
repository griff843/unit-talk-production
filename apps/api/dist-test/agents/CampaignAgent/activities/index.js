"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCampaign = executeCampaign;
exports.validateCampaign = validateCampaign;
exports.applyDiscounts = applyDiscounts;
exports.cleanupExpiredCampaigns = cleanupExpiredCampaigns;
const __1 = require("..");
// Mock dependencies for activities
const getDependencies = () => {
    // This would be properly injected in production
    return {
        supabase: null,
        logger: console,
        errorHandler: null
    };
};
async function executeCampaign(params) {
    const agent = __1.CampaignAgent.getInstance(getDependencies());
    await agent.executeCampaign(params);
}
async function validateCampaign(params) {
    const agent = __1.CampaignAgent.getInstance(getDependencies());
    await agent.validateCampaign(params);
}
async function applyDiscounts() {
    const agent = __1.CampaignAgent.getInstance(getDependencies());
    await agent.applyDiscounts();
}
async function cleanupExpiredCampaigns() {
    const agent = __1.CampaignAgent.getInstance(getDependencies());
    await agent.cleanupExpired();
}
