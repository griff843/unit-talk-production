"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidenceScore = calculateConfidenceScore;
function calculateConfidenceScore(scores) {
    // Example: simple weighted average
    const { trend_score, matchup_score, ev_percent } = scores;
    return Math.round(0.4 * (trend_score ?? 0) +
        0.3 * (matchup_score ?? 0) +
        0.3 * ((ev_percent ?? 0) / 10));
}
