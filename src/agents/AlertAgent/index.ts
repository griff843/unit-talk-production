import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { SupabaseClient } from '@supabase/supabase-js'
import { Logger } from '../../utils/logger'
import { AlertPayload, AlertType } from '../../types/alert'
import { getUnitTalkAdvice } from './adviceEngine'
import { logUnitTalkAdvice } from './log'
import { sendDiscordAlert } from './integrations/discord'
import { sendNotionAlert } from './integrations/notion'
import { sendRetoolAlert } from './integrations/retool'
import { detectInjuryImpact, isSignificantLineMove, isMiddlingOpportunity } from './utils/detection'

export class AlertsAgent {
  private supabase: SupabaseClient
  private logger: Logger

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.logger = new Logger('AlertsAgent')
  }

  async sendAlert(payload: AlertPayload, betId?: string, userId?: string): Promise<void> {
    this.logger.info('Processing alert', payload)
    const results: Record<string, any> = {}

    // Generate Advice
    const advice = await getUnitTalkAdvice(payload)

    // Output Channels
    if (payload.channels.includes('discord')) results.discord = await sendDiscordAlert(payload, advice)
    if (payload.channels.includes('notion')) results.notion = await sendNotionAlert(payload, advice)
    if (payload.channels.includes('retool')) results.retool = await sendRetoolAlert(payload, advice)

    // Log
    await logUnitTalkAdvice(this.supabase, payload, advice, betId ?? payload.meta?.bet_id, userId ?? payload.meta?.user_id)
    this.logger.info('Alert processed and routed', results)
  }

  async handleEvent(event: any): Promise<void> {
    const payload = this.mapEventToAlert(event)
    if (!payload.meta?.posted_to_discord) return
    await this.sendAlert(payload, payload.meta?.bet_id, payload.meta?.user_id)
  }

  private mapEventToAlert(event: any): AlertPayload {
    const type: AlertType = event.type ?? 'system'
    const severity = this.deriveSeverity(event)
    const title = this.getAlertTitle(type)

    return {
      id: event.id || `alert_${Date.now()}`,
      type,
      title,
      description: event.description || 'No description provided',
      severity,
      source: event.source || 'unknown',
      createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
      meta: event.meta || {},
      channels: event.channels || ['discord']
    }
  }

  private deriveSeverity(event: any): 'low' | 'medium' | 'high' | 'critical' {
    if (event.type === 'injury' && detectInjuryImpact(event)) return 'critical'
    if (event.type === 'line_move' && isSignificantLineMove(event)) return 'high'
    if (event.type === 'middling' && isMiddlingOpportunity(event)) return 'medium'
    return 'low'
  }

  private getAlertTitle(type: AlertType): string {
    switch (type) {
      case 'injury': return '🚨 Injury Alert'
      case 'steam': return '🔥 Steam Movement Detected'
      case 'line_move': return '📈 Line Shift Detected'
      case 'hedge': return '💸 Hedge Opportunity'
      case 'middling': return '🟰 Middling Edge'
      case 'system': return 'System Alert'
      default: return 'Alert'
    }
  }

  async updateAlertOutcome(alertId: string, response: string, outcome: string, evChange: number, wasPosEvAdvice: boolean, notes?: string, feedback?: string) {
    await this.supabase.from('unit_talk_alerts_log').update({
      response, outcome, ev_change: evChange,
      was_pos_ev_advice: wasPosEvAdvice,
      notes, feedback
    }).eq('id', alertId)
  }

  async healthCheck(): Promise<{ status: string, details?: any }> {
    try {
      const testPayload: AlertPayload = {
        id: 'healthcheck',
        type: 'system',
        title: 'AlertsAgent Health Check',
        description: 'Testing all alert channels and Unit Talk advice engine.',
        severity: 'info',
        source: 'AlertsAgent',
        createdAt: new Date(),
        channels: ['discord', 'notion'],
        meta: { posted_to_discord: true }
      }
      await this.sendAlert(testPayload)
      return { status: 'healthy' }
    } catch (err) {
      this.logger.error('Health check failed', err)
      return { status: 'failed', details: err }
    }
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}