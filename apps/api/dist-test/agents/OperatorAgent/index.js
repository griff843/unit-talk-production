"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorAgent = void 0;
exports.initializeOperatorAgent = initializeOperatorAgent;
const date_fns_1 = require("date-fns");
const openaiClient_1 = require("../../services/openaiClient");
const operatorHelpers_1 = require("../../services/operatorHelpers");
const BaseAgent_1 = require("../BaseAgent");
const healthActivities_1 = require("./activities/healthActivities");
let instance = null;
class OperatorAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
    }
    async initialize() {
        this.deps.logger.info('Initializing OperatorAgent...');
        try {
            await this.validateDependencies();
            this.deps.logger.info('OperatorAgent initialized successfully');
        }
        catch (error) {
            this.deps.logger.error('Failed to initialize OperatorAgent:', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async validateDependencies() {
        // Verify access to required tables
        const tables = ['agent_logs', 'operator_tasks', 'system_events'];
        for (const table of tables) {
            const { error } = await this.deps.supabase
                .from(table)
                .select('id')
                .limit(1);
            if (error) {
                throw new Error(`Failed to access ${table} table: ${error.message}`);
            }
        }
    }
    async process() {
        try {
            // Monitor agent health and tasks
            await this.monitorAgents();
            // Run HealthWorkflow every 15 minutes
            const now = new Date();
            const minutes = now.getMinutes();
            if (minutes % 15 === 0) { // Every 15 minutes
                await this.runHealthWorkflow();
            }
            // Generate daily summary
            if (now.getHours() === 0 && minutes === 0) { // Once per day at midnight
                await this.generateSummary('daily');
            }
            // Run learning cycle weekly
            if (now.getDay() === 0 && now.getHours() === 2 && minutes === 0) { // Sunday at 2am
                await this.learnAndEvolve();
            }
        }
        catch (error) {
            this.deps.logger.error('Error in OperatorAgent process:', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async cleanup() {
        this.deps.logger.info('OperatorAgent cleanup completed');
    }
    async checkHealth() {
        const errors = [];
        const warnings = [];
        try {
            // Check recent failures
            const { data: recentFailures } = await this.deps.supabase
                .from('agent_logs')
                .select('agent, status')
                .eq('status', 'failed')
                .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString());
            if (recentFailures && recentFailures.length > 10) {
                warnings.push(`High failure rate: ${recentFailures.length} failures in last hour`);
            }
            // Check pending tasks
            const { data: pendingTasks } = await this.deps.supabase
                .from('operator_tasks')
                .select('id')
                .eq('status', 'pending');
            if (pendingTasks && pendingTasks.length > 50) {
                warnings.push(`High pending tasks: ${pendingTasks.length} tasks pending`);
            }
        }
        catch (error) {
            errors.push(`Health check failed: ${error}`);
        }
        const status = errors.length > 0 ? 'unhealthy' :
            warnings.length > 0 ? 'degraded' : 'healthy';
        return {
            status,
            timestamp: new Date().toISOString(),
            details: { errors, warnings }
        };
    }
    async collectMetrics() {
        const { data: events } = await this.deps.supabase
            .from('system_events')
            .select('status')
            .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        const successCount = events?.filter((e) => e.status === 'ok').length || 0;
        const errorCount = events?.filter((e) => e.status === 'failed').length || 0;
        return {
            agentName: 'OperatorAgent',
            successCount,
            errorCount,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    // Public methods (converted from static)
    async monitorAgents() {
        const { data: agentLogs } = await this.deps.supabase.from('agent_logs').select('*').order('timestamp', { ascending: false }).limit(250);
        const { data: agentTasks } = await this.deps.supabase.from('operator_tasks').select('*').eq('status', 'pending');
        const prioritized = this.prioritizeTasks(agentTasks ?? [], agentLogs ?? []);
        for (const log of agentLogs ?? []) {
            if (log.status === 'failed') {
                await this.handleIncident(log);
            }
        }
        await this.logEvent({
            event_type: 'health_check',
            agent: 'Operator',
            message: 'Agent health and prioritization check complete',
            status: 'ok',
            escalation: false,
            action_required: false,
            meta: { prioritized }
        });
        return prioritized;
    }
    prioritizeTasks(tasks, logs) {
        return (tasks ?? []).map(task => ({
            ...task,
            urgency: (task.priority === 'urgent' ? 100 : 0) +
                (task.retries ? task.retries * 15 : 0) +
                ((logs ?? []).filter(l => l.agent === task.agent && l.status === 'failed').length * 20) +
                (task.due_date && new Date(task.due_date) < new Date() ? 50 : 0)
        })).sort((a, b) => (b.urgency || 0) - (a.urgency || 0));
    }
    async logEvent(event) {
        await this.deps.supabase.from('system_events').insert([{ ...event, timestamp: new Date().toISOString() }]);
        if (event.escalation || event.status === 'failed') {
            await (0, operatorHelpers_1.sendDiscordAlert)(`${event.event_type}: ${event.message}`, 'alerts');
            await (0, operatorHelpers_1.sendNotionLog)(event.event_type, event.message, event.status);
        }
    }
    async handleIncident(event) {
        const { data: recent } = await this.deps.supabase
            .from('agent_logs')
            .select('id')
            .eq('agent', event.agent)
            .eq('status', 'failed')
            .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString());
        const escalate = recent && recent.length >= 3;
        await this.logEvent({
            event_type: 'agent_error',
            agent: event.agent,
            message: event.message,
            status: 'failed',
            escalation: !!escalate,
            action_required: !!escalate,
            meta: event
        });
        if (escalate) {
            await this.createTask({
                type: 'escalation',
                agent: event.agent,
                details: event.message,
                priority: 'urgent'
            });
        }
    }
    async createTask(task) {
        await this.deps.supabase.from('operator_tasks').insert([{
                ...task,
                created_at: new Date().toISOString(),
                status: 'pending'
            }]);
    }
    async controlAgent(agent, command) {
        await this.createTask({
            type: command,
            agent,
            details: `${command} issued by Operator`,
            priority: 'urgent'
        });
        await this.logEvent({
            event_type: 'agent_control',
            agent,
            message: `${command} command sent to ${agent}`,
            status: 'ok',
            escalation: false,
            action_required: false,
            meta: {}
        });
    }
    async generateSummary(period) {
        const since = period === 'daily'
            ? (0, date_fns_1.startOfDay)(new Date())
            : period === 'weekly'
                ? (0, date_fns_1.subDays)(new Date(), 7)
                : (0, date_fns_1.subDays)(new Date(), 30);
        const { data: events } = await this.deps.supabase
            .from('system_events')
            .select('*')
            .gte('timestamp', since.toISOString());
        const messages = (events ?? []).map((e) => `${e.agent}: ${e.event_type} - ${e.message}`).join('\n') || '';
        const aiSummary = await openaiClient_1.openai.chat.completions.create({
            model: period === 'monthly' ? 'gpt-4-turbo' : 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a world-class operations manager. Write a concise incident/event summary, highlight any repeating issues, and recommend next steps for the exec team.' },
                { role: 'user', content: messages }
            ]
        });
        const summaryContent = aiSummary.choices?.[0]?.message?.content ?? '';
        await this.logEvent({
            event_type: 'summary',
            agent: 'Operator',
            message: summaryContent,
            status: 'ok',
            escalation: false,
            action_required: false,
            meta: {}
        });
        await (0, operatorHelpers_1.sendNotionLog)(`Operator ${period} Summary`, summaryContent);
        await (0, operatorHelpers_1.sendDiscordAlert)(`summary: ${summaryContent}`, 'alerts');
        return summaryContent;
    }
    async learnAndEvolve() {
        const { data: events } = await this.deps.supabase.from('system_events').select('*').gte('timestamp', (0, date_fns_1.subDays)(new Date(), 14).toISOString());
        const { data: agentLogs } = await this.deps.supabase.from('agent_logs').select('*').gte('timestamp', (0, date_fns_1.subDays)(new Date(), 14).toISOString());
        const prompt = `Review these system events and agent logs for the past 2 weeks.\n` +
            `1. Identify recurring patterns, weak points, or system friction.\n` +
            `2. Propose at least one new KPI, one SOP improvement, and any doc updates needed.\n` +
            `3. If you detect repeated agent/workflow failures, suggest a new troubleshooting SOP.\n` +
            `4. Output recommendations in structured format (KPIs, SOPs, Docs).\n\n` +
            'Events:\n' +
            (events ?? []).map((e) => `${e.timestamp} | ${e.agent}: ${e.event_type} - ${e.message}`).join('\n') +
            '\nAgentLogs:\n' +
            (agentLogs ?? []).map((l) => `${l.timestamp} | ${l.agent}: ${l.status} - ${l.message}`).join('\n');
        const ai = await openaiClient_1.openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [
                { role: 'system', content: 'You are a world-class ops automation architect.' },
                { role: 'user', content: prompt }
            ]
        });
        const learning = ai.choices?.[0]?.message?.content ?? '';
        await (0, operatorHelpers_1.sendNotionLog)('OperatorAgent Learning/Evolution', learning);
        if (learning.includes('SOP:')) {
            const sop = extractSection(learning, 'SOP:');
            await (0, operatorHelpers_1.createNotionSOP)(sop.title, sop.content);
        }
        if (learning.includes('KPI:')) {
            const kpi = extractSection(learning, 'KPI:');
            await (0, operatorHelpers_1.createNotionKPI)(kpi.title, 100, 0, 'units');
        }
        await this.logEvent({
            event_type: 'learning',
            agent: 'Operator',
            message: 'Learning cycle complete',
            status: 'ok',
            escalation: false,
            action_required: false,
            meta: { learning }
        });
        await (0, operatorHelpers_1.sendDiscordAlert)(`learning: Learning/Evolution: ${learning.substring(0, 200)}...`, 'alerts');
        return learning;
    }
    async handleCommand(command, user = 'system') {
        let response = '';
        let summary = '';
        command = command.toLowerCase();
        if (command.includes('status')) {
            const prioritized = await this.monitorAgents();
            response = `System status checked. Open prioritized tasks:\n` +
                prioritized.map(t => `• ${t.agent}: ${t.type} (${t.priority}, urgency: ${t.urgency})`).join('\n');
        }
        else if (command.startsWith('create sop')) {
            const sopTitle = command.replace('create sop', '').trim() || 'New SOP';
            await (0, operatorHelpers_1.createNotionSOP)(sopTitle, 'Draft SOP. Please edit and expand as needed.');
            response = `SOP "${sopTitle}" created in Notion.`;
        }
        else if (command.startsWith('create kpi')) {
            const kpiTitle = command.replace('create kpi', '').trim() || 'New KPI';
            await (0, operatorHelpers_1.createNotionKPI)(kpiTitle, 100, 0, 'units');
            response = `KPI "${kpiTitle}" created in Notion.`;
        }
        else if (command.startsWith('summary')) {
            summary = await this.generateSummary('daily') ?? '';
            response = `Summary generated: ${summary.substring(0, 400)}`;
        }
        else if (command.startsWith('learn')) {
            const learn = await this.learnAndEvolve();
            response = `Learning/evolution run complete. Output: ${learn.substring(0, 400)}`;
        }
        else {
            const ai = await openaiClient_1.openai.chat.completions.create({
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'You are the OperatorAgent for a Fortune 100 sports automation system. Answer as a helpful assistant, and call system methods if needed.' },
                    { role: 'user', content: command }
                ]
            });
            response = ai.choices?.[0]?.message?.content?.trim() || '';
        }
        await this.logEvent({
            event_type: 'user_command',
            agent: 'Operator',
            message: `Command from ${user}: ${command} => ${response}`,
            status: 'ok',
            escalation: false,
            action_required: false,
            meta: { command, response }
        });
        return response;
    }
    /**
     * Run HealthWorkflow - System health monitoring with incident detection
     *
     * Executes comprehensive health checks including:
     * - system_health_snapshot query across 8 sections
     * - Threshold-based incident creation
     * - Command Center integration
     * - Job run logging and tracking
     */
    async runHealthWorkflow() {
        const startTime = Date.now();
        const executionId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        let jobId = null;
        let healthData = [];
        let incidentsCreated = 0;
        try {
            this.deps.logger.info('🏥 Starting HealthWorkflow execution', { executionId });
            // 1. Start job logging
            const jobResult = await (0, healthActivities_1.logJobRun)({
                agent: 'OperatorAgent',
                workflow: 'HealthWorkflow',
                jobName: 'system_health_check',
                status: 'running',
                metadata: {
                    executionId,
                    startTime: new Date().toISOString()
                }
            });
            jobId = jobResult.jobId;
            // 2. Execute health snapshot query
            const snapshotResult = await (0, healthActivities_1.executeHealthSnapshot)();
            if (!snapshotResult.success) {
                throw new Error('Health snapshot query failed');
            }
            healthData = snapshotResult.healthData;
            // 3. Analyze health data and create incidents
            const healthSummary = {
                totalSections: healthData.length,
                healthySections: 0,
                degradedSections: 0,
                criticalSections: 0,
                sectionsWithAlerts: []
            };
            const incidentsToCreate = [];
            // Analyze each section
            for (const section of healthData) {
                // Count section status
                switch (section.status) {
                    case 'healthy':
                        healthSummary.healthySections++;
                        break;
                    case 'warning':
                    case 'degraded':
                        healthSummary.degradedSections++;
                        break;
                    case 'critical':
                        healthSummary.criticalSections++;
                        break;
                }
                // Process alerts for incident creation
                if (section.alerts && section.alerts.length > 0) {
                    healthSummary.sectionsWithAlerts.push(section.section);
                    for (const alertType of section.alerts) {
                        const severity = this.getSeverityForAlert(alertType);
                        incidentsToCreate.push({
                            kind: alertType,
                            severity,
                            details: {
                                section: section.section,
                                status: section.status,
                                count_recent: section.count_recent,
                                count_total: section.count_total,
                                details: section.details,
                                thresholds: section.thresholds,
                                timestamp: new Date().toISOString(),
                                executionId
                            },
                            section: section.section
                        });
                    }
                }
            }
            // 4. Create incidents if any
            if (incidentsToCreate.length > 0) {
                const incidentResult = await (0, healthActivities_1.createIncidents)({
                    incidents: incidentsToCreate
                });
                incidentsCreated = incidentResult.incidentsCreated.length;
                this.deps.logger.info('🚨 Health incidents processed', {
                    created: incidentResult.incidentsCreated.length,
                    skipped: incidentResult.duplicatesSkipped.length
                });
            }
            // 5. Push to Command Center
            try {
                const commandCenterResult = await (0, healthActivities_1.pushToCommandCenter)({
                    healthData,
                    timestamp: new Date().toISOString(),
                    executionMetrics: {
                        totalSections: healthSummary.totalSections,
                        healthySections: healthSummary.healthySections,
                        degradedSections: healthSummary.degradedSections,
                        criticalSections: healthSummary.criticalSections,
                        totalIncidents: incidentsCreated
                    }
                });
                this.deps.logger.info('📡 Command Center push result', {
                    pushed: commandCenterResult.pushed,
                    responseTime: commandCenterResult.responseTime
                });
            }
            catch (ccError) {
                this.deps.logger.warn('⚠️ Command Center push failed', {
                    error: ccError instanceof Error ? ccError.message : String(ccError)
                });
            }
            // 6. Complete job logging
            const executionTime = Date.now() - startTime;
            if (jobId) {
                await (0, healthActivities_1.completeJobRun)({
                    jobId,
                    status: 'success',
                    metadata: {
                        healthSummary,
                        incidentsCreated,
                        executionTime,
                        sectionsAnalyzed: healthData.map(s => s.section),
                        completedAt: new Date().toISOString()
                    }
                });
            }
            // 7. Send completion alert
            await (0, healthActivities_1.sendHealthAlert)({
                alertType: 'health_check_complete',
                message: `Health check completed: ${healthSummary.healthySections}/${healthSummary.totalSections} sections healthy`,
                details: {
                    healthSummary,
                    incidentsCreated,
                    executionTime
                },
                priority: incidentsCreated > 0 ? 'medium' : 'low'
            });
            this.deps.logger.info('✅ HealthWorkflow completed successfully', {
                executionId,
                healthSummary,
                incidentsCreated,
                executionTime
            });
            return {
                success: true,
                healthSummary,
                incidents: incidentsCreated,
                executionTime
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.deps.logger.error('❌ HealthWorkflow failed', {
                executionId,
                error: errorMessage,
                executionTime
            });
            // Complete job with failure status
            if (jobId) {
                try {
                    await (0, healthActivities_1.completeJobRun)({
                        jobId,
                        status: 'failed',
                        metadata: {
                            error: errorMessage,
                            executionTime,
                            failedAt: new Date().toISOString()
                        },
                        errorMessage
                    });
                }
                catch (completeError) {
                    this.deps.logger.error('Failed to complete job logging', { completeError });
                }
            }
            // Send failure alert
            await (0, healthActivities_1.sendHealthAlert)({
                alertType: 'health_check_failed',
                message: 'System health check failed',
                details: {
                    executionId,
                    error: errorMessage,
                    executionTime
                },
                priority: 'critical'
            });
            return {
                success: false,
                healthSummary: {
                    totalSections: 0,
                    healthySections: 0,
                    degradedSections: 0,
                    criticalSections: 0,
                    sectionsWithAlerts: []
                },
                incidents: 0,
                executionTime
            };
        }
    }
    /**
     * Get severity level for alert types based on business impact
     */
    getSeverityForAlert(alertType) {
        switch (alertType) {
            case 'IngestionHalted':
            case 'AgentFailure':
                return 'critical';
            case 'FeaturePipelineStalled':
            case 'AlertLatency':
                return 'high';
            case 'RecapError':
                return 'medium';
            default:
                return 'medium';
        }
    }
    // Public API
    static getInstance(dependencies) {
        if (!instance) {
            // Create a default config since logger doesn't have config property
            const config = {
                name: 'OperatorAgent',
                enabled: true,
                version: '1.0.0',
                logLevel: 'info',
                schedule: 'manual',
                metrics: {
                    enabled: true,
                    interval: 60,
                    port: 9090
                },
                retry: {
                    enabled: true,
                    maxRetries: 3,
                    backoffMs: 1000,
                    maxBackoffMs: 30000,
                    maxAttempts: 3,
                    backoff: 1000,
                    exponential: true,
                    jitter: false
                },
                health: {
                    enabled: true,
                    interval: 30,
                    timeout: 5000,
                    checkDb: true,
                    checkExternal: false
                }
            };
            instance = new OperatorAgent(config, dependencies);
        }
        return instance;
    }
}
exports.OperatorAgent = OperatorAgent;
function initializeOperatorAgent(dependencies) {
    // Create a default config since logger doesn't have config property
    const config = {
        name: 'OperatorAgent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info',
        schedule: 'manual',
        metrics: {
            enabled: true,
            interval: 60,
            port: 9090
        },
        retry: {
            enabled: true,
            maxRetries: 3,
            backoffMs: 1000,
            maxBackoffMs: 30000,
            maxAttempts: 3,
            backoff: 1000,
            exponential: true,
            jitter: false
        },
        health: {
            enabled: true,
            interval: 30,
            timeout: 5000,
            checkDb: true,
            checkExternal: false
        }
    };
    return new OperatorAgent(config, dependencies);
}
function extractSection(text, tag) {
    const idx = text.indexOf(tag);
    if (idx === -1) {
        return { title: '', content: '' };
    }
    const nextTag = ['SOP:', 'KPI:', 'DOC:'].filter(t => t !== tag).map(t => text.indexOf(t)).filter(i => i > idx).sort((a, b) => a - b)[0];
    const section = text.substring(idx + tag.length, nextTag || undefined).trim();
    const lines = section.split('\n').filter(Boolean);
    const title = lines[0] || '';
    const content = lines.slice(1).join('\n');
    return { title, content };
}
