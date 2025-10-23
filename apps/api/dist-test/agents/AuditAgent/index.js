"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAgent = void 0;
const crypto = __importStar(require("crypto"));
const index_1 = require("../BaseAgent/index");
const types_1 = require("./types");
/**
 * AuditAgent
 * Runs health/integrity checks across core data tables (picks, users, etc).
 * Logs incidents and escalates red flags to OperatorAgent or incident tables.
 */
class AuditAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        // Initialize agent-specific properties here
    }
    /**
     * Run all core audits and log/escalate results.
     */
    async runAudit() {
        try {
            this.logger.info('AuditAgent: Starting system audit...');
            const incidents = [];
            // 1. Picks with missing required fields
            incidents.push(...await this.checkForMissingFields());
            // 2. Picks stuck in invalid statuses or missing grades
            incidents.push(...await this.checkForStuckOrUngraded());
            // 3. Duplicate external_ids in picks
            incidents.push(...await this.checkForDuplicatePicks());
            // 4. Stale or orphaned records (e.g. old, ungraded, not updated)
            incidents.push(...await this.checkForStaleRecords());
            // 5. (Optional) Any failed/incomplete agent tasks
            incidents.push(...await this.checkForFailedTasks());
            // Log all incidents to Supabase
            for (const incident of incidents) {
                await this.requireSupabase().from('audit_incidents').insert([incident]);
            }
            // Send to OperatorAgent/escalation queue if critical
            const critical = incidents.filter(i => i.severity === 'critical');
            if (critical.length > 0) {
                await this.notifyOperatorAgent(critical);
            }
            this.logger.info(`AuditAgent: Audit complete. Total incidents: ${incidents.length}, Critical: ${critical.length}`);
        }
        catch (err) {
            this.logger.error('AuditAgent: Audit failed', {
                error: err instanceof Error ? err.message : 'Unknown error'
            });
            throw err;
        }
    }
    /** Create an audit incident with default values */
    createAuditIncident(data) {
        return types_1.AuditIncidentSchema.parse({
            id: data.id || crypto.randomUUID(),
            table: data.table || 'default_table',
            severity: data.severity || 'low',
            description: data.description || 'Unspecified audit incident',
            timestamp: data.timestamp || new Date(),
            ...data
        });
    }
    async checkForMissingFields() {
        const incidents = [];
        if (!this.supabase) {
            throw new Error('Supabase client is required for AuditAgent');
        }
        const { data, error } = await this.supabase
            .from('unified_picks')
            .select('id, capper, player_name, line, odds, outcome')
            .is('player_name', null)
            .or('line.is.null,odds.is.null');
        if (error) {
            this.logger.error('checkForMissingFields failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
        for (const row of data ?? []) {
            incidents.push(this.createAuditIncident({
                id: `missing_field_${row.id}`,
                type: 'integrity',
                tableName: 'unified_picks',
                row_id: row.id,
                description: `Pick is missing required field(s): ${!row.player_name ? 'player_name' : ''}${!row.line ? ', line' : ''}${!row.odds ? ', odds' : ''}`,
                severity: 'warning',
                detectedAt: new Date().toISOString()
            }));
        }
        return incidents;
    }
    /** Example: Picks stuck in pending or missing grading */
    async checkForStuckOrUngraded() {
        const incidents = [];
        if (!this.supabase) {
            throw new Error('Supabase client is required for AuditAgent');
        }
        const { data, error } = await this.supabase
            .from('unified_picks')
            .select('id, capper, status, outcome, settled_at, created_at')
            .in('status', ['pending', 'in_progress'])
            .lte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString()); // older than 48h
        if (error) {
            this.logger.error('checkForStuckOrUngraded failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
        for (const row of data ?? []) {
            incidents.push(this.createAuditIncident({
                id: `stuck_pending_${row.id}`,
                type: 'integrity',
                tableName: 'unified_picks',
                row_id: row.id,
                description: `Pick stuck in ${row.status} >48h`,
                severity: 'critical',
                detectedAt: new Date().toISOString()
            }));
        }
        return incidents;
    }
    /** Example: Detect duplicate external_ids in picks */
    async checkForDuplicatePicks() {
        const incidents = [];
        if (!this.supabase) {
            throw new Error('Supabase client is required for AuditAgent');
        }
        const { data, error } = await this.supabase.rpc('find_duplicate_external_ids');
        if (error) {
            this.logger.error('checkForDuplicatePicks failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
        for (const row of data ?? []) {
            incidents.push(this.createAuditIncident({
                id: `duplicate_external_id_${row.id}`,
                type: 'integrity',
                tableName: 'unified_picks',
                row_id: row.id,
                description: `Duplicate external_id found: ${row.external_id}`,
                severity: 'critical',
                detectedAt: new Date().toISOString()
            }));
        }
        return incidents;
    }
    /** Example: Stale or ungraded records older than 72h */
    async checkForStaleRecords() {
        const incidents = [];
        if (!this.supabase) {
            throw new Error('Supabase client is required for AuditAgent');
        }
        const { data, error } = await this.supabase
            .from('unified_picks')
            .select('id, capper, status, created_at')
            .in('status', ['pending', 'in_progress'])
            .lte('created_at', new Date(Date.now() - 72 * 3600 * 1000).toISOString());
        if (error) {
            this.logger.error('checkForStaleRecords failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
        for (const row of data ?? []) {
            incidents.push(this.createAuditIncident({
                id: `stale_pick_${row.id}`,
                type: 'integrity',
                tableName: 'unified_picks',
                row_id: row.id,
                description: `Stale pick: status=${row.status}, created_at=${row.created_at}`,
                severity: 'warning',
                detectedAt: new Date().toISOString()
            }));
        }
        return incidents;
    }
    /** Example: Failed/incomplete agent tasks */
    async checkForFailedTasks() {
        const incidents = [];
        if (!this.supabase) {
            throw new Error('Supabase client is required for AuditAgent');
        }
        const { data, error } = await this.supabase
            .from('agent_tasks')
            .select('id, agent, status, error_message, updated_at')
            .in('status', ['failed', 'error']);
        if (error) {
            this.logger.error('checkForFailedTasks failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
        for (const row of data ?? []) {
            incidents.push(this.createAuditIncident({
                id: `failed_agent_task_${row.id}`,
                type: 'integrity',
                tableName: 'agent_tasks',
                row_id: row.id,
                description: `Agent task failed: ${row.agent} - ${row.error_message ?? ''}`,
                severity: 'critical',
                detectedAt: new Date().toISOString()
            }));
        }
        return incidents;
    }
    /** Notify OperatorAgent/escalation channel with critical issues */
    async notifyOperatorAgent(criticalIncidents) {
        // (Stub) You can push to a queue, send webhook, or upsert to a monitored table.
        this.logger.info('Escalating critical audit incidents to OperatorAgent', {
            incident_count: criticalIncidents.length,
            ids: criticalIncidents.map(i => i.row_id)
        });
        // Example: await this.supabase.from('operator_incidents').insert(criticalIncidents)
        // Or: trigger webhook/alert/Discord
    }
    async initialize() {
        // TODO: Restore business logic here after base migration (initialize)
    }
    async process() {
        // TODO: Restore business logic here after base migration (process)
    }
    async cleanup() {
        // TODO: Restore business logic here after base migration (cleanup)
    }
    async checkHealth() {
        // TODO: Restore business logic here after base migration (checkHealth)
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            details: {}
        };
    }
    async collectMetrics() {
        // TODO: Restore business logic here after base migration (collectMetrics)
        return {
            agentName: this.config.name,
            successCount: 0,
            errorCount: 0,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
}
exports.AuditAgent = AuditAgent;
