"use strict";
// src/logic/zoneThreat.ts
// INTERNAL ONLY - Zone Threat Rating Module
// Business Objective: Advanced pitcher/hitter matchup metrics for HR/rocket prop edge scoring
// This module is NOT exposed to public or Discord messages
Object.defineProperty(exports, "__esModule", { value: true });
exports.zoneThreatRating = void 0;
exports.calculateZoneThreat = calculateZoneThreat;
exports.calculateZoneThreatBoost = calculateZoneThreatBoost;
exports.logZoneThreatDecision = logZoneThreatDecision;
function calculateZoneThreat(data, config) {
    // Calculate weighted score
    let score = 0;
    const factors = {};
    for (const [key, weight] of Object.entries(config.weights)) {
        const value = data[key] || 0;
        const factor = value * weight;
        factors[key] = factor;
        score += factor;
    }
    // Determine threat level
    let level;
    if (score >= config.thresholds.high) {
        level = 'high';
    }
    else if (score >= config.thresholds.medium) {
        level = 'medium';
    }
    else {
        level = 'low';
    }
    return {
        level,
        score,
        factors
    };
}
// Additional exports required by edgeScoring.ts
exports.zoneThreatRating = calculateZoneThreat;
function calculateZoneThreatBoost(threatResult) {
    // Convert threat level to a boost multiplier
    switch (threatResult.level) {
        case 'high':
            return 1.5;
        case 'medium':
            return 1.2;
        case 'low':
            return 1.0;
        default:
            return 1.0;
    }
}
function logZoneThreatDecision(decision) {
    // Log zone threat decision for debugging/analytics
    console.log('[Zone Threat Decision]', decision);
}
