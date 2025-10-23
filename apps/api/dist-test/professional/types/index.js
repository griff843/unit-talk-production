"use strict";
/**
 * Professional Features Types
 * Phase 5: Syndicate-Level ML Betting System
 *
 * These types define the 8 professional features that separate
 * syndicate-level systems from amateur betting platforms.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// ========================================
// Export all types
// ========================================
__exportStar(require("./steam-detection"), exports);
__exportStar(require("./closing-line-prediction"), exports);
__exportStar(require("./optimal-timing"), exports);
__exportStar(require("./line-shopping"), exports);
__exportStar(require("./public-sharp-split"), exports);
__exportStar(require("./market-timing"), exports);
__exportStar(require("./injury-timing"), exports);
__exportStar(require("./cross-market-discrepancy"), exports);
