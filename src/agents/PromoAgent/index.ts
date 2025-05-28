import { SupabaseClient } from '@supabase/supabase-js'
import { Logger } from '../../utils/logger'
import { PromotionConfig } from '../../types/promo'

export class PromoAgent {
  private supabase: SupabaseClient
  private logger: Logger

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.logger = new Logger('PromoAgent')
  }

  async runPromotion(config: PromotionConfig): Promise<void> {
    this.logger.info('Running promotion', config.name)

    const result = await this.supabase.from('promotions').insert({
      name: config.name,
      start_date: config.startDate,
      end_date: config.endDate,
      type: config.type,
      value: config.value,
      conditions: config.conditions
    })

    if (result.error) {
      this.logger.error('Failed to insert promotion', result.error)
      throw result.error
    }

    this.logger.info('Promotion recorded successfully')
  }
}
