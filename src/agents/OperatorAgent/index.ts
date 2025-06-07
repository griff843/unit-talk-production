import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies,
  HealthStatus,
  BaseMetrics
} from '../BaseAgent/types';
import { AgentTask, SystemEvent, OperatorAgentConfig } from './types';
import { supabase } from '../../services/supabaseClient';
import { openai } from '../../services/openaiClient';
import { sendDiscordAlert, sendNotionLog, createNotionSOP, createNotionKPI } from '../../services/operatorHelpers';
import { startOfDay, subDays } from 'date-fns';

let instance: OperatorAgent | null = null;

export class OperatorAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing OperatorAgent...');
    
    try {
      await this.validateDependencies();
      this.deps.logger.info('OperatorAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize OperatorAgent:', error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
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

  protected async process(): Promise<void> {
    try {
      // Monitor agent health and tasks
      await this.monitorAgents();
      
      // Generate daily summary
      const now = new Date();
      if (now.getHours() === 0) { // Once per day at midnight
        await this.generateSummary('daily');
      }
      
      // Run learning cycle weekly
      if (now.getDay() === 0 && now.getHours() === 2) { // Sunday at 2am
        await this.learnAndEvolve();
      }
    } catch (error) {
      this.deps.logger.error('Error in OperatorAgent process:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.deps.logger.info('OperatorAgent cleanup completed');
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
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
    } catch (error) {
      errors.push(`Health check failed: ${error}`);
    }

    const status: HealthStatus['status'] = 
      errors.length > 0 ? 'unhealthy' : 
      warnings.length > 0 ? 'degraded' : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      details: { errors, warnings }
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const { data: events } = await this.deps.supabase
      .from('system_events')
      .select('status')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const successCount = events?.filter(e => e.status === 'ok').length || 0;
    const errorCount = events?.filter(e => e.status === 'failed').length || 0;

    const { data: tasks } = await this.deps.supabase
      .from('operator_tasks')
      .select('status');

    const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;

    return {
      successCount,
      errorCount,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      'custom.pendingTasks': pendingTasks,
      'custom.completedTasks': completedTasks
    };
  }

  // Public methods (converted from static)
  public async monitorAgents() {
    const { data: agentLogs } = await this.deps.supabase.from('agent_logs').select('*').order('timestamp', { ascending: false }).limit(250);
    const { data: agentTasks } = await this.deps.supabase.from('operator_tasks').select('*').eq('status', 'pending');
    const prioritized = this.prioritizeTasks(agentTasks ?? [], agentLogs ?? []);
    
    for (const log of agentLogs ?? []) {
      if (log.status === 'failed') await this.handleIncident(log);
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

  private prioritizeTasks(tasks: AgentTask[], logs: any[]): AgentTask[] {
    return (tasks ?? []).map(task => ({
      ...task,
      urgency:
        (task.priority === 'urgent' ? 100 : 0) +
        (task.retries ? task.retries * 15 : 0) +
        ((logs ?? []).filter(l => l.agent === task.agent && l.status === 'failed').length * 20) +
        (task.due_date && new Date(task.due_date) < new Date() ? 50 : 0)
    })).sort((a, b) => (b.urgency || 0) - (a.urgency || 0));
  }

  private async logEvent(event: SystemEvent) {
    await this.deps.supabase.from('system_events').insert([{ ...event, timestamp: new Date().toISOString() }]);
    if (event.escalation || event.status === 'failed') {
      await sendDiscordAlert(event);
      await sendNotionLog(event);
    }
  }

  private async handleIncident(event: any) {
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

  public async createTask(task: AgentTask) {
    await this.deps.supabase.from('operator_tasks').insert([{
      ...task,
      created_at: new Date().toISOString(),
      status: 'pending'
    }]);
  }

  public async controlAgent(agent: string, command: 'pause' | 'rerun' | 'reset') {
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

  public async generateSummary(period: 'daily' | 'weekly' | 'monthly') {
    const since = period === 'daily'
      ? startOfDay(new Date())
      : period === 'weekly'
        ? subDays(new Date(), 7)
        : subDays(new Date(), 30);
    
    const { data: events } = await this.deps.supabase
      .from('system_events')
      .select('*')
      .gte('timestamp', since.toISOString());
    
    const messages = (events ?? []).map(e => `${e.agent}: ${e.event_type} - ${e.message}`).join('\n') || '';
    
    const aiSummary = await openai.chat.completions.create({
      model: period === 'monthly' ? 'gpt-4-turbo' : 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a world-class operations manager. Write a concise incident/event summary, highlight any repeating issues, and recommend next steps for the exec team.' },
        { role: 'user', content: messages }
      ]
    });
    
    const summaryContent = aiSummary.choices[0].message.content ?? '';
    
    await this.logEvent({
      event_type: 'summary',
      agent: 'Operator',
      message: summaryContent,
      status: 'ok',
      escalation: false,
      action_required: false,
      meta: {}
    });
    
    await sendNotionLog({ title: `Operator ${period} Summary`, content: summaryContent });
    await sendDiscordAlert({ event_type: 'summary', agent: 'Operator', message: summaryContent, status: 'ok', escalation: false, action_required: false, meta: {} });
    
    return summaryContent;
  }

  public async learnAndEvolve() {
    const { data: events } = await this.deps.supabase.from('system_events').select('*').gte('timestamp', subDays(new Date(), 14).toISOString());
    const { data: agentLogs } = await this.deps.supabase.from('agent_logs').select('*').gte('timestamp', subDays(new Date(), 14).toISOString());
    
    const prompt =
      `Review these system events and agent logs for the past 2 weeks.\n` +
      `1. Identify recurring patterns, weak points, or system friction.\n` +
      `2. Propose at least one new KPI, one SOP improvement, and any doc updates needed.\n` +
      `3. If you detect repeated agent/workflow failures, suggest a new troubleshooting SOP.\n` +
      `4. Output recommendations in structured format (KPIs, SOPs, Docs).\n\n` +
      'Events:\n' +
      (events ?? []).map(e => `${e.timestamp} | ${e.agent}: ${e.event_type} - ${e.message}`).join('\n') +
      '\nAgentLogs:\n' +
      (agentLogs ?? []).map(l => `${l.timestamp} | ${l.agent}: ${l.status} - ${l.message}`).join('\n');
    
    const ai = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a world-class ops automation architect.' },
        { role: 'user', content: prompt }
      ]
    });
    
    const learning = ai.choices[0].message.content ?? '';
    
    await sendNotionLog({ title: 'OperatorAgent Learning/Evolution', content: learning });
    
    if (learning.includes('SOP:')) {
      const sop = extractSection(learning, 'SOP:');
      await createNotionSOP({ title: sop.title, content: sop.content });
    }
    
    if (learning.includes('KPI:')) {
      const kpi = extractSection(learning, 'KPI:');
      await createNotionKPI({ title: kpi.title, content: kpi.content });
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
    
    await sendDiscordAlert({
      event_type: 'learning',
      agent: 'Operator',
      message: `Learning/Evolution: ${learning.substring(0, 200)}...`,
      status: 'ok',
      escalation: false,
      action_required: false,
      meta: {}
    });
    
    return learning;
  }

  public async handleCommand(command: string, user: string = 'system') {
    let response = '';
    let summary = '';
    command = command.toLowerCase();
    
    if (command.includes('status')) {
      const prioritized = await this.monitorAgents();
      response = `System status checked. Open prioritized tasks:\n` +
        prioritized.map(t =>
          `• ${t.agent}: ${t.type} (${t.priority}, urgency: ${t.urgency})`
        ).join('\n');
    } else if (command.startsWith('create sop')) {
      const sopTitle = command.replace('create sop', '').trim() || 'New SOP';
      await createNotionSOP({ title: sopTitle, content: 'Draft SOP. Please edit and expand as needed.' });
      response = `SOP "${sopTitle}" created in Notion.`;
    } else if (command.startsWith('create kpi')) {
      const kpiTitle = command.replace('create kpi', '').trim() || 'New KPI';
      await createNotionKPI({ title: kpiTitle, content: 'Draft KPI. Please edit and expand as needed.' });
      response = `KPI "${kpiTitle}" created in Notion.`;
    } else if (command.startsWith('summary')) {
      summary = await this.generateSummary('daily') ?? '';
      response = `Summary generated: ${summary.substring(0, 400)}`;
    } else if (command.startsWith('learn')) {
      const learn = await this.learnAndEvolve();
      response = `Learning/evolution run complete. Output: ${learn.substring(0, 400)}`;
    } else {
      const ai = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are the OperatorAgent for a Fortune 100 sports automation system. Answer as a helpful assistant, and call system methods if needed.' },
          { role: 'user', content: command }
        ]
      });
      response = ai.choices[0].message.content?.trim() || '';
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

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): OperatorAgent {
    if (!instance) {
      const config = dependencies.logger?.config || {} as BaseAgentConfig;
      instance = new OperatorAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializeOperatorAgent(dependencies: BaseAgentDependencies): OperatorAgent {
  const config = dependencies.logger?.config || {} as BaseAgentConfig;
  return new OperatorAgent(config, dependencies);
}

function extractSection(text: string, tag: string) {
  const idx = text.indexOf(tag);
  if (idx === -1) return { title: '', content: '' };
  const nextTag = ['SOP:', 'KPI:', 'DOC:'].filter(t => t !== tag).map(t => text.indexOf(t)).filter(i => i > idx).sort((a, b) => a - b)[0];
  const section = text.substring(idx + tag.length, nextTag || undefined).trim();
  const lines = section.split('\n').filter(Boolean);
  const title = lines[0] || '';
  const content = lines.slice(1).join('\n');
  return { title, content };
}