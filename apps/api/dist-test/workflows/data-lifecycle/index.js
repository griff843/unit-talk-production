"use strict";
// Data Lifecycle Workflow Exports
// Temporal workflows for comprehensive data lifecycle management
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowPriority = exports.DEFAULT_WORKFLOW_SCHEDULE = exports.EmergencyDataLifecycleWorkflow = exports.ScheduledDataLifecycleWorkflow = exports.DataLifecycleWorkflow = exports.ExpressPromotionWorkflow = exports.ScheduledPromotionWorkflow = exports.PromotionWorkflow = exports.ExpressScoringWorkflow = exports.ScheduledScoringWorkflow = exports.ScoringWorkflow = exports.ExpressFeatureBuilderWorkflow = exports.ScheduledFeatureBuilderWorkflow = exports.FeatureBuilderWorkflow = void 0;
var FeatureBuilderWorkflow_1 = require("./FeatureBuilderWorkflow");
Object.defineProperty(exports, "FeatureBuilderWorkflow", { enumerable: true, get: function () { return FeatureBuilderWorkflow_1.FeatureBuilderWorkflow; } });
Object.defineProperty(exports, "ScheduledFeatureBuilderWorkflow", { enumerable: true, get: function () { return FeatureBuilderWorkflow_1.ScheduledFeatureBuilderWorkflow; } });
Object.defineProperty(exports, "ExpressFeatureBuilderWorkflow", { enumerable: true, get: function () { return FeatureBuilderWorkflow_1.ExpressFeatureBuilderWorkflow; } });
var ScoringWorkflow_1 = require("./ScoringWorkflow");
Object.defineProperty(exports, "ScoringWorkflow", { enumerable: true, get: function () { return ScoringWorkflow_1.ScoringWorkflow; } });
Object.defineProperty(exports, "ScheduledScoringWorkflow", { enumerable: true, get: function () { return ScoringWorkflow_1.ScheduledScoringWorkflow; } });
Object.defineProperty(exports, "ExpressScoringWorkflow", { enumerable: true, get: function () { return ScoringWorkflow_1.ExpressScoringWorkflow; } });
var PromotionWorkflow_1 = require("./PromotionWorkflow");
Object.defineProperty(exports, "PromotionWorkflow", { enumerable: true, get: function () { return PromotionWorkflow_1.PromotionWorkflow; } });
Object.defineProperty(exports, "ScheduledPromotionWorkflow", { enumerable: true, get: function () { return PromotionWorkflow_1.ScheduledPromotionWorkflow; } });
Object.defineProperty(exports, "ExpressPromotionWorkflow", { enumerable: true, get: function () { return PromotionWorkflow_1.ExpressPromotionWorkflow; } });
var DataLifecycleWorkflow_1 = require("./DataLifecycleWorkflow");
Object.defineProperty(exports, "DataLifecycleWorkflow", { enumerable: true, get: function () { return DataLifecycleWorkflow_1.DataLifecycleWorkflow; } });
Object.defineProperty(exports, "ScheduledDataLifecycleWorkflow", { enumerable: true, get: function () { return DataLifecycleWorkflow_1.ScheduledDataLifecycleWorkflow; } });
Object.defineProperty(exports, "EmergencyDataLifecycleWorkflow", { enumerable: true, get: function () { return DataLifecycleWorkflow_1.EmergencyDataLifecycleWorkflow; } });
// Default workflow schedule configuration
exports.DEFAULT_WORKFLOW_SCHEDULE = {
    FeatureBuilder: {
        scheduled: '0 * * * *', // Hourly feature computation
        express: 'event-driven' // Triggered by material changes
    },
    Scoring: {
        scheduled: '*/30 * * * *', // Every 30 minutes scoring
        express: 'event-driven' // Triggered by feature completion
    },
    Promotion: {
        scheduled: '*/15 * * * *', // Every 15 minutes promotion
        express: 'event-driven' // Triggered by high-grade scoring
    },
    DataLifecycle: {
        scheduled: '0 2 * * *', // Daily 2 AM archival
        emergency: 'event-driven' // Triggered by capacity alerts
    }
};
// Workflow execution priorities
var WorkflowPriority;
(function (WorkflowPriority) {
    WorkflowPriority["LOW"] = "low";
    WorkflowPriority["NORMAL"] = "normal";
    WorkflowPriority["HIGH"] = "high";
    WorkflowPriority["CRITICAL"] = "critical";
})(WorkflowPriority || (exports.WorkflowPriority = WorkflowPriority = {}));
//# sourceMappingURL=index.js.map