import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngagementMetrics } from '../../types/marketing'

export class EngagementTracker {
  private supabase: SupabaseClient
  constructor(supabase: SupabaseClient, config: any) {
    this.supabase = supabase
  }

  async checkHealth(): Promise<{ status: string }> {
    // If metrics are just a view, still check queryability
    const { error } = await this.supabase.from('engagement_metrics').select('usersReached').limit(1)
    return { status: error ? 'failed' : 'healthy' }
  }

  async generateReport(params: { start?: Date; end?: Date } = {}): Promise<EngagementMetrics> {
    let query = this.supabase.from('engagement_metrics').select('*').order('timestamp', { ascending: false }).limit(1)
    if (params.start && params.end) {
      query = this.supabase.from('engagement_metrics').select('*')
        .gte('timestamp', params.start.toISOString())
        .lte('timestamp', params.end.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
    }
    const { data, error } = await query.single()
    if (error) throw error
    return data as EngagementMetrics
  }
}
