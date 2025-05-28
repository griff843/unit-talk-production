import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReferralProgram } from '../../../types/marketing'

export class ReferralManager {
  private supabase: SupabaseClient
  constructor(supabase: SupabaseClient, config: any) {
    this.supabase = supabase
  }

  async checkHealth(): Promise<{ status: string }> {
    const { error } = await this.supabase.from('referral_programs').select('id').limit(1)
    return { status: error ? 'failed' : 'healthy' }
  }

  async createReferral(params: Partial<ReferralProgram>): Promise<ReferralProgram> {
    if (!params.name) throw new Error('name is required')
    const { data, error } = await this.supabase
      .from('referral_programs')
      .insert([params])
      .select()
      .single()
    if (error) throw error
    return data as ReferralProgram
  }

  async updateReferral(id: string, updates: Partial<ReferralProgram>): Promise<ReferralProgram> {
    const { data, error } = await this.supabase
      .from('referral_programs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ReferralProgram
  }

  async listReferrals(): Promise<ReferralProgram[]> {
    const { data, error } = await this.supabase.from('referral_programs').select('*')
    if (error) throw error
    return data as ReferralProgram[]
  }
}
