"use strict";
/**
 * Phase 9: Live Testing System Types
 *
 * Small stakes live validation testing types for real-money validation
 * of the Unit Talk syndicate-level ML betting system.
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
__exportStar(require("./betting-api"), exports);
__exportStar(require("./performance-tracking"), exports);
__exportStar(require("./risk-monitoring"), exports);
__exportStar(require("./financial-reporting"), exports);
__exportStar(require("./emergency-system"), exports);
