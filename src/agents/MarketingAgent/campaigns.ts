import type { SupabaseClient } from '@supabase/supabase-js'
import type { Campaign } from '../../types/marketing'

export class CampaignManager {
  private supabase: SupabaseClient
  constructor(supabase: SupabaseClient, _config: any) {
    this.supabase = supabase
    // Config can be used for feature toggles, etc.
  }

  async checkHealth(): Promise<{ status: string }> {
    // Health: Check if campaigns table is queryable
    const { error } = await this.supabase.from('campaigns').select('id').limit(1)
    return { status: error ? 'failed' : 'healthy' }
  }

  async createCampaign(params: Partial<Campaign>): Promise<Campaign> {
    if (!params.name || !params.startDate) throw new Error('name and startDate are required')
    const { data, error } = await this.supabase
      .from('campaigns')
      .insert([params])
      .select()
      .single()
    if (error) throw error
    return data as Campaign
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Campaign
  }

  async listCampaigns(): Promise<Campaign[]> {
    const { data, error } = await this.supabase.from('campaigns').select('*')
    if (error) throw error
    return data as Campaign[]
  }
}
