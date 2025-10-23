"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineTier = determineTier;
function determineTier(composite_score) {
    // Remove sub-tiers: Only S, A, B, C
    if (composite_score >= 20) {
        return 'S';
    }
    if (composite_score >= 15) {
        return 'A';
    }
    if (composite_score >= 10) {
        return 'B';
    }
    return 'C';
}
