"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectStaleLines = exports.scoreTopTierPicks = exports.getNewUnifiedPicks = exports.backfillSGOActivities = exports.logError = exports.logWorkflowMetrics = exports.detectLiveGames = exports.checkSystemHealth = exports.monitorAPIQuota = exports.logGradingError = exports.logUSPError = exports.sendWeeklyReport = exports.sendWorkflowFailure = exports.sendFallbackTrigger = exports.sendQuotaWarning = exports.sendApprovedPicksAlert = exports.sendOperatorAlert = exports.sendDiscordAlert = exports.scoreAndGradeProps = exports.processUSPDetection = exports.validateIngestionData = exports.ingestOptimalGames = exports.ingestSGOProps = exports.ingestOptimalProps = void 0;
/**
 * TEMPORAL ACTIVITIES INDEX
 * Exports all activities for Temporal workflows
 */
// Ingestion Activities
var ingestion_1 = require("./ingestion");
Object.defineProperty(exports, "ingestOptimalProps", { enumerable: true, get: function () { return ingestion_1.ingestOptimalProps; } });
Object.defineProperty(exports, "ingestSGOProps", { enumerable: true, get: function () { return ingestion_1.ingestSGOProps; } });
Object.defineProperty(exports, "ingestOptimalGames", { enumerable: true, get: function () { return ingestion_1.ingestOptimalGames; } });
Object.defineProperty(exports, "validateIngestionData", { enumerable: true, get: function () { return ingestion_1.validateIngestionData; } });
// Processing Activities
var processing_1 = require("./processing");
Object.defineProperty(exports, "processUSPDetection", { enumerable: true, get: function () { return processing_1.processUSPDetection; } });
Object.defineProperty(exports, "scoreAndGradeProps", { enumerable: true, get: function () { return processing_1.scoreAndGradeProps; } });
// Alert Activities
var alerts_1 = require("./alerts");
Object.defineProperty(exports, "sendDiscordAlert", { enumerable: true, get: function () { return alerts_1.sendDiscordAlert; } });
Object.defineProperty(exports, "sendOperatorAlert", { enumerable: true, get: function () { return alerts_1.sendOperatorAlert; } });
Object.defineProperty(exports, "sendApprovedPicksAlert", { enumerable: true, get: function () { return alerts_1.sendApprovedPicksAlert; } });
Object.defineProperty(exports, "sendQuotaWarning", { enumerable: true, get: function () { return alerts_1.sendQuotaWarning; } });
Object.defineProperty(exports, "sendFallbackTrigger", { enumerable: true, get: function () { return alerts_1.sendFallbackTrigger; } });
Object.defineProperty(exports, "sendWorkflowFailure", { enumerable: true, get: function () { return alerts_1.sendWorkflowFailure; } });
Object.defineProperty(exports, "sendWeeklyReport", { enumerable: true, get: function () { return alerts_1.sendWeeklyReport; } });
// Operator Activities
var operator_1 = require("./operator");
Object.defineProperty(exports, "logUSPError", { enumerable: true, get: function () { return operator_1.logUSPError; } });
Object.defineProperty(exports, "logGradingError", { enumerable: true, get: function () { return operator_1.logGradingError; } });
Object.defineProperty(exports, "monitorAPIQuota", { enumerable: true, get: function () { return operator_1.monitorAPIQuota; } });
Object.defineProperty(exports, "checkSystemHealth", { enumerable: true, get: function () { return operator_1.checkSystemHealth; } });
Object.defineProperty(exports, "detectLiveGames", { enumerable: true, get: function () { return operator_1.detectLiveGames; } });
Object.defineProperty(exports, "logWorkflowMetrics", { enumerable: true, get: function () { return operator_1.logWorkflowMetrics; } });
Object.defineProperty(exports, "logError", { enumerable: true, get: function () { return operator_1.logError; } });
// SGO Backfill Activities
var backfillSGOActivities_1 = require("./backfillSGOActivities");
Object.defineProperty(exports, "backfillSGOActivities", { enumerable: true, get: function () { return backfillSGOActivities_1.backfillSGOActivities; } });
// Missing ScoringAgent Activities
var activities_1 = require("../agents/ScoringAgent/activities");
Object.defineProperty(exports, "getNewUnifiedPicks", { enumerable: true, get: function () { return activities_1.getNewUnifiedPicks; } });
Object.defineProperty(exports, "scoreTopTierPicks", { enumerable: true, get: function () { return activities_1.scoreTopTierPicks; } });
// Missing AlertAgent Activities
var activities_2 = require("../agents/AlertAgent/activities");
Object.defineProperty(exports, "detectStaleLines", { enumerable: true, get: function () { return activities_2.detectStaleLines; } });
