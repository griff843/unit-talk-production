import { logger } from '../services/logging.js';
import { supabaseClient } from '../services/supabaseClient.js';

export async function createSOP(title: string, content: string): Promise<string> {
  try {
    logger.info(`Creating SOP: ${title}`);

    // For now, we'll create a structured SOP document
    // In the future, this could integrate with Notion API
    const sop = {
      id: `sop_${Date.now()}`,
      title,
      content,
      created_at: new Date().toISOString(),
      status: 'active',
      version: '1.0',
    };

    // Store in database
    const { data, error } = await supabaseClient.from('sops').insert(sop).select().single();

    if (error) {
      throw new Error(`Failed to create SOP: ${error.message}`);
    }

    logger.info(`Successfully created SOP: ${title} with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    logger.error(`Error creating SOP "${title}":`, error);
    throw error;
  }
}

export async function createKPI(
  name: string,
  target: number,
  current: number,
  unit: string
): Promise<string> {
  try {
    logger.info(`Creating KPI: ${name}`);

    const kpi = {
      id: `kpi_${Date.now()}`,
      name,
      target,
      current,
      unit,
      created_at: new Date().toISOString(),
      status: 'active',
      progress: current > 0 ? (current / target) * 100 : 0,
    };

    // Store in database
    const { data, error } = await supabaseClient.from('kpis').insert(kpi).select().single();

    if (error) {
      throw new Error(`Failed to create KPI: ${error.message}`);
    }

    logger.info(`Successfully created KPI: ${name} with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    logger.error(`Error creating KPI "${name}":`, error);
    throw error;
  }
}

// Alias exports for backward compatibility
export const createNotionSOP = createSOP;
export const createNotionKPI = createKPI;

// Discord alert function
export async function sendDiscordAlert(message: string, channel?: string): Promise<void> {
  try {
    logger.info(`Sending Discord alert: ${message}`);

    // Store alert in database for now
    // In production, this would integrate with Discord webhook
    const alert = {
      id: `alert_${Date.now()}`,
      message,
      channel: channel || 'general',
      created_at: new Date().toISOString(),
      type: 'discord',
      status: 'sent',
    };

    const { error } = await supabaseClient.from('alerts').insert(alert);

    if (error) {
      throw new Error(`Failed to send Discord alert: ${error.message}`);
    }

    logger.info(`Successfully sent Discord alert`);
  } catch (error) {
    logger.error(`Error sending Discord alert:`, error);
    throw error;
  }
}

// Notion log function
export async function sendNotionLog(
  title: string,
  content: string,
  type: string = 'info'
): Promise<void> {
  try {
    logger.info(`Sending Notion log: ${title}`);

    // Store log in database for now
    // In production, this would integrate with Notion API
    const log = {
      id: `log_${Date.now()}`,
      title,
      content,
      type,
      created_at: new Date().toISOString(),
      source: 'operator_agent',
    };

    const { error } = await supabaseClient.from('logs').insert(log);

    if (error) {
      throw new Error(`Failed to send Notion log: ${error.message}`);
    }

    logger.info(`Successfully sent Notion log: ${title}`);
  } catch (error) {
    logger.error(`Error sending Notion log:`, error);
    throw error;
  }
}
