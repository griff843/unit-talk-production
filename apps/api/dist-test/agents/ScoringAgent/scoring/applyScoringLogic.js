"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyScoringLogic = applyScoringLogic;
const confidenceScore_1 = require("./confidenceScore");
const determineTier_1 = require("./determineTier");
const expectedValue_1 = require("./expectedValue");
const lineValueScore_1 = require("./lineValueScore");
const matchupScore_1 = require("./matchupScore");
const roleStabilityScore_1 = require("./roleStabilityScore");
const trendScore_1 = require("./trendScore");
function applyScoringLogic(prop) {
    const trend_score = (0, trendScore_1.calculateTrendScore)(prop);
    const matchup_score = (0, matchupScore_1.calculateMatchupScore)(prop);
    const ev_percent = (0, expectedValue_1.calculateExpectedValue)(prop);
    const confidence_score = (0, confidenceScore_1.calculateConfidenceScore)({
        trend_score,
        matchup_score,
        ev_percent
    });
    const line_value_score = (0, lineValueScore_1.calculateLineValueScore)(prop);
    const role_stability = (0, roleStabilityScore_1.calculateRoleStabilityScore)(prop);
    const professional_score = (trend_score ?? 0) +
        (matchup_score ?? 0) +
        (confidence_score ?? 0) +
        (line_value_score ?? 0) +
        (role_stability ?? 0);
    const tier = (0, determineTier_1.determineTier)(professional_score);
    return {
        ...prop,
        trend_score,
        matchup_score,
        ev_percent,
        confidence_score,
        line_value_score,
        role_stability,
        professional_score,
        tier,
    };
}
