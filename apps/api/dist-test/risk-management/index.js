"use strict";
/**
 * Phase 7 Risk Management System
 *
 * Fortune 100-grade risk management for Unit Talk syndicate-level ML betting system.
 * Implements comprehensive risk controls including Kelly sizing, correlation management,
 * portfolio optimization, and automated risk controls.
 *
 * @version 1.0.0
 * @author Unit Talk Platform Engineering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomatedRiskControls = exports.PortfolioOptimizer = exports.CorrelationManager = exports.KellySizingEngine = exports.RiskManagementEngine = void 0;
var RiskManagementEngine_1 = require("./core/RiskManagementEngine");
Object.defineProperty(exports, "RiskManagementEngine", { enumerable: true, get: function () { return RiskManagementEngine_1.RiskManagementEngine; } });
var KellySizingEngine_1 = require("./kelly/KellySizingEngine");
Object.defineProperty(exports, "KellySizingEngine", { enumerable: true, get: function () { return KellySizingEngine_1.KellySizingEngine; } });
var CorrelationManager_1 = require("./correlation/CorrelationManager");
Object.defineProperty(exports, "CorrelationManager", { enumerable: true, get: function () { return CorrelationManager_1.CorrelationManager; } });
var PortfolioOptimizer_1 = require("./portfolio/PortfolioOptimizer");
Object.defineProperty(exports, "PortfolioOptimizer", { enumerable: true, get: function () { return PortfolioOptimizer_1.PortfolioOptimizer; } });
var AutomatedRiskControls_1 = require("./controls/AutomatedRiskControls");
Object.defineProperty(exports, "AutomatedRiskControls", { enumerable: true, get: function () { return AutomatedRiskControls_1.AutomatedRiskControls; } });
