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
      version: '1.0'
    };

    // Store in database
    const { data, error } = await supabaseClient
      .from('sops')
      .insert(sop)
      .select()
      .single();

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

export async function createKPI(name: string, target: number, current: number, unit: string): Promise<string> {
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
      progress: current > 0 ? (current / target) * 100 : 0
    };

    // Store in database
    const { data, error } = await supabaseClient
      .from('kpis')
      .insert(kpi)
      .select()
      .single();

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