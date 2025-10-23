"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotionKPI = exports.createNotionSOP = void 0;
exports.createSOP = createSOP;
exports.createKPI = createKPI;
exports.sendDiscordAlert = sendDiscordAlert;
exports.sendNotionLog = sendNotionLog;
const logging_js_1 = require("../services/logging.js");
const supabaseClient_js_1 = require("../services/supabaseClient.js");
async function createSOP(title, content) {
    try {
        logging_js_1.logger.info(`Creating SOP: ${title}`);
        // For now, we'll create a structured SOP document
        // In the future, this could integrate with Notion API
        const sop = {
            id: `sop_${Date.now()}`,
            title,
            content,
            created_at: new Date().toISOString(),
            status: 'active',
            version: '1.0'
        };
        // Store in database
        const { data, error } = await supabaseClient_js_1.supabaseClient
            .from('sops')
            .insert(sop)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create SOP: ${error.message}`);
        }
        logging_js_1.logger.info(`Successfully created SOP: ${title} with ID: ${data.id}`);
        return data.id;
    }
    catch (error) {
        logging_js_1.logger.error(`Error creating SOP "${title}":`, error);
        throw error;
    }
}
async function createKPI(name, target, current, unit) {
    try {
        logging_js_1.logger.info(`Creating KPI: ${name}`);
        const kpi = {
            id: `kpi_${Date.now()}`,
            name,
            target,
            current,
            unit,
            created_at: new Date().toISOString(),
            status: 'active',
            progress: current > 0 ? (current / target) * 100 : 0
        };
        // Store in database
        const { data, error } = await supabaseClient_js_1.supabaseClient
            .from('kpis')
            .insert(kpi)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create KPI: ${error.message}`);
        }
        logging_js_1.logger.info(`Successfully created KPI: ${name} with ID: ${data.id}`);
        return data.id;
    }
    catch (error) {
        logging_js_1.logger.error(`Error creating KPI "${name}":`, error);
        throw error;
    }
}
// Alias exports for backward compatibility
exports.createNotionSOP = createSOP;
exports.createNotionKPI = createKPI;
// Discord alert function
async function sendDiscordAlert(message, channel) {
    try {
        logging_js_1.logger.info(`Sending Discord alert: ${message}`);
        // Store alert in database for now
        // In production, this would integrate with Discord webhook
        const alert = {
            id: `alert_${Date.now()}`,
            message,
            channel: channel || 'general',
            created_at: new Date().toISOString(),
            type: 'discord',
            status: 'sent'
        };
        const { error } = await supabaseClient_js_1.supabaseClient
            .from('alerts')
            .insert(alert);
        if (error) {
            throw new Error(`Failed to send Discord alert: ${error.message}`);
        }
        logging_js_1.logger.info(`Successfully sent Discord alert`);
    }
    catch (error) {
        logging_js_1.logger.error(`Error sending Discord alert:`, error);
        throw error;
    }
}
// Notion log function
async function sendNotionLog(title, content, type = 'info') {
    try {
        logging_js_1.logger.info(`Sending Notion log: ${title}`);
        // Store log in database for now
        // In production, this would integrate with Notion API
        const log = {
            id: `log_${Date.now()}`,
            title,
            content,
            type,
            created_at: new Date().toISOString(),
            source: 'operator_agent'
        };
        const { error } = await supabaseClient_js_1.supabaseClient
            .from('logs')
            .insert(log);
        if (error) {
            throw new Error(`Failed to send Notion log: ${error.message}`);
        }
        logging_js_1.logger.info(`Successfully sent Notion log: ${title}`);
    }
    catch (error) {
        logging_js_1.logger.error(`Error sending Notion log:`, error);
        throw error;
    }
}
