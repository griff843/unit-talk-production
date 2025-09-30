import { SupabaseClient } from '@supabase/supabase-js';

/**
 * HotDataIntegration - Enhanced FeedAgent integration for HOT/WARM/COLD architecture
 * 
 * Features:
 * - Dual write to raw_props (legacy) and prop_ticks_hot (new HOT storage)
 * - Real-time tick capture with sub-second precision
 * - Market intelligence computation and steam detection
 * - Automatic data lifecycle management
 * - Performance optimized for 8K+ simultaneous props
 */

interface PropTickData {
  // Core prop identification
  prop_id: string;
  external_prop_id?: string;
  player_name: string;
  sport: string;
  stat_type: string;
  
  // Game context
  game_date: string;
  game_time: string;
  team?: string;
  opponent?: string;
  matchup?: string;
  
  // Market data (the actual "tick")
  line: number;
  over_odds?: number;
  under_odds?: number;
  book: string;
  
  // Advanced market intelligence
  implied_probability?: number;
  vig?: number;
  true_odds?: number;
  line_movement?: number;
  odds_movement?: number;
  steam_detected?: boolean;
  sharp_money_indicator?: boolean;
  public_percentage?: number;
  
  // Timing and lifecycle
  tick_timestamp: string;
  time_to_game?: number; // Minutes to game start
  market_open_time?: string;
  market_close_time?: string;
  
  // Data quality and source
  source: string;
  provider?: string;
  data_quality_score?: number;
  confidence_level?: number;
  
  // Feature computation cache
  rolling_avg_7d?: number;
  rolling_avg_30d?: number;
  volatility_score?: number;
  trend_direction?: number;
  market_efficiency_score?: number;
  
  // Metadata
  created_at: string;
  expires_at: string;
  archived_at?: string;
}

export class HotDataIntegration {
  private supabase: SupabaseClient;
  private logger: any;
  
  // Performance configuration
  private config = {
    batchSize: 500,
    maxParallelBatches: 5,
    steamThreshold: 0.5,
    dataRetentionDays: 14,
    enableSteamDetection: true,
    enableMarketIntelligence: true,
    hotTableEnabled: true
  };

  constructor(supabase: SupabaseClient, logger: any, config?: Partial<typeof this.config>) {
    this.supabase = supabase;
    this.logger = logger;
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Enhanced prop processing with dual write to raw_props and prop_ticks_hot
   */
  async processPropsWithHotStorage(rawProps: any[]): Promise<{
    rawPropsInserted: number;
    hotTicksInserted: number;
    steamMovesDetected: number;
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const result = {
      rawPropsInserted: 0,
      hotTicksInserted: 0,
      steamMovesDetected: 0,
      processingTime: 0,
      errors: [] as string[]
    };

    try {
      this.logger.info('🚀 Processing props with HOT data architecture', {
        propCount: rawProps.length,
        hotTableEnabled: this.config.hotTableEnabled,
        steamDetectionEnabled: this.config.enableSteamDetection
      });

      // Process props in parallel batches
      const batches = this.createBatches(rawProps, this.config.batchSize);
      const batchPromises = batches.map(async (batch, index) => {
        return await this.processBatch(batch, index);
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate results
      batchResults.forEach(batchResult => {
        result.rawPropsInserted += batchResult.rawPropsInserted;
        result.hotTicksInserted += batchResult.hotTicksInserted;
        result.steamMovesDetected += batchResult.steamMovesDetected;
        result.errors.push(...batchResult.errors);
      });

      result.processingTime = Date.now() - startTime;

      this.logger.info('✅ Props processing completed with HOT architecture', {
        rawPropsInserted: result.rawPropsInserted,
        hotTicksInserted: result.hotTicksInserted,
        steamMovesDetected: result.steamMovesDetected,
        processingTimeMs: result.processingTime,
        errorCount: result.errors.length
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      result.processingTime = Date.now() - startTime;
      
      this.logger.error('❌ Props processing failed', {
        error: errorMessage,
        processingTime: result.processingTime,
        propCount: rawProps.length
      });

      return result;
    }
  }

  /**
   * Process a batch of props with dual write strategy
   */
  private async processBatch(props: any[], batchIndex: number): Promise<{
    rawPropsInserted: number;
    hotTicksInserted: number;
    steamMovesDetected: number;
    errors: string[];
  }> {
    const result = {
      rawPropsInserted: 0,
      hotTicksInserted: 0,
      steamMovesDetected: 0,
      errors: [] as string[]
    };

    try {
      this.logger.debug('🔄 Processing batch with HOT storage', {
        batchIndex,
        batchSize: props.length
      });

      // Transform props for both tables
      const rawPropsData = this.transformForRawProps(props);
      const hotTicksData = await this.transformForHotStorage(props);

      // Write to raw_props (legacy table)
      if (rawPropsData.length > 0) {
        const rawResult = await this.insertRawProps(rawPropsData);
        result.rawPropsInserted = rawResult.inserted;
        if (rawResult.errors.length > 0) {
          result.errors.push(...rawResult.errors);
        }
      }

      // Write to prop_ticks_hot (new HOT storage)
      if (this.config.hotTableEnabled && hotTicksData.length > 0) {
        const hotResult = await this.insertHotTicks(hotTicksData);
        result.hotTicksInserted = hotResult.inserted;
        result.steamMovesDetected = hotResult.steamMovesDetected;
        if (hotResult.errors.length > 0) {
          result.errors.push(...hotResult.errors);
        }
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Batch ${batchIndex} failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Transform props for raw_props table (existing format)
   */
  private transformForRawProps(props: any[]): any[] {
    return props.map(prop => ({
      id: crypto.randomUUID(),
      prop_id: prop.prop_id || crypto.randomUUID(),
      player_name: prop.player_name || '',
      sport: prop.sport || '',
      stat_type: prop.stat_type || prop.market || '',
      line: parseFloat(prop.line) || 0,
      over_odds: prop.over_odds ? parseInt(prop.over_odds) : null,
      under_odds: prop.under_odds ? parseInt(prop.under_odds) : null,
      game_date: prop.game_date || new Date().toISOString().split('T')[0],
      game_time: prop.game_time || new Date().toISOString(),
      team: prop.team || '',
      opponent: prop.opponent || '',
      matchup: prop.matchup || `${prop.team} vs ${prop.opponent}`,
      source: prop.source || 'unified-router',
      provider: prop.provider || 'feed-agent',
      created_at: new Date().toISOString(),
      // ... other raw_props fields
    }));
  }

  /**
   * Transform props for prop_ticks_hot table with market intelligence
   */
  private async transformForHotStorage(props: any[]): Promise<PropTickData[]> {
    const hotTicksData: PropTickData[] = [];

    for (const prop of props) {
      try {
        // Calculate market intelligence
        const marketIntelligence = await this.computeMarketIntelligence(prop);
        
        // Calculate timing
        const gameTime = new Date(prop.game_time || new Date());
        const timeToGame = Math.max(0, Math.floor((gameTime.getTime() - Date.now()) / (1000 * 60)));
        
        // Set expiration (14 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.config.dataRetentionDays);

        const hotTickData: PropTickData = {
          // Core identification
          prop_id: prop.prop_id || crypto.randomUUID(),
          external_prop_id: prop.external_id,
          player_name: prop.player_name || '',
          sport: prop.sport || '',
          stat_type: prop.stat_type || prop.market || '',
          
          // Game context
          game_date: prop.game_date || new Date().toISOString().split('T')[0],
          game_time: prop.game_time || new Date().toISOString(),
          team: prop.team,
          opponent: prop.opponent,
          matchup: prop.matchup || `${prop.team} vs ${prop.opponent}`,
          
          // Market data
          line: parseFloat(prop.line) || 0,
          over_odds: prop.over_odds ? parseInt(prop.over_odds) : undefined,
          under_odds: prop.under_odds ? parseInt(prop.under_odds) : undefined,
          book: prop.book || 'aggregated',
          
          // Market intelligence
          implied_probability: marketIntelligence.implied_probability,
          vig: marketIntelligence.vig,
          true_odds: marketIntelligence.true_odds,
          line_movement: marketIntelligence.line_movement,
          odds_movement: marketIntelligence.odds_movement,
          steam_detected: marketIntelligence.steam_detected,
          sharp_money_indicator: marketIntelligence.sharp_money_indicator,
          public_percentage: marketIntelligence.public_percentage,
          
          // Timing
          tick_timestamp: new Date().toISOString(),
          time_to_game: timeToGame,
          market_open_time: prop.market_open_time,
          market_close_time: prop.market_close_time,
          
          // Data quality
          source: prop.source || 'feed-agent',
          provider: prop.provider,
          data_quality_score: this.calculateDataQuality(prop),
          confidence_level: this.calculateConfidence(prop),
          
          // Feature cache (computed asynchronously)
          rolling_avg_7d: marketIntelligence.rolling_avg_7d,
          rolling_avg_30d: marketIntelligence.rolling_avg_30d,
          volatility_score: marketIntelligence.volatility_score,
          trend_direction: marketIntelligence.trend_direction,
          market_efficiency_score: marketIntelligence.market_efficiency_score,
          
          // Metadata
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        };

        hotTicksData.push(hotTickData);

      } catch (error) {
        this.logger.warn('⚠️ Failed to transform prop for HOT storage', {
          propId: prop.prop_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return hotTicksData;
  }

  /**
   * Insert data into raw_props table
   */
  private async insertRawProps(data: any[]): Promise<{
    inserted: number;
    errors: string[];
  }> {
    try {
      const { data: insertedData, error } = await this.supabase
        .from('sports_game_odds')
        .upsert(data, {
          onConflict: 'prop_id',
          ignoreDuplicates: true
        })
        .select('id');

      if (error) {
        return {
          inserted: 0,
          errors: [`Raw props insert failed: ${error.message}`]
        };
      }

      return {
        inserted: insertedData?.length || 0,
        errors: []
      };

    } catch (error) {
      return {
        inserted: 0,
        errors: [`Raw props insert exception: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Insert data into prop_ticks_hot table
   */
  private async insertHotTicks(data: PropTickData[]): Promise<{
    inserted: number;
    steamMovesDetected: number;
    errors: string[];
  }> {
    try {
      const { data: insertedData, error } = await this.supabase
        .from('prop_ticks_hot')
        .insert(data)
        .select('id, steam_detected');

      if (error) {
        return {
          inserted: 0,
          steamMovesDetected: 0,
          errors: [`HOT ticks insert failed: ${error.message}`]
        };
      }

      const steamMovesDetected = insertedData?.filter(tick => tick.steam_detected).length || 0;

      // Log steam moves for alerting
      if (steamMovesDetected > 0) {
        this.logger.info('🌊 Steam moves detected in HOT data', {
          steamMoves: steamMovesDetected,
          totalTicks: insertedData?.length || 0
        });
      }

      return {
        inserted: insertedData?.length || 0,
        steamMovesDetected,
        errors: []
      };

    } catch (error) {
      return {
        inserted: 0,
        steamMovesDetected: 0,
        errors: [`HOT ticks insert exception: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Compute market intelligence for a prop
   */
  private async computeMarketIntelligence(prop: any): Promise<{
    implied_probability: number;
    vig: number;
    true_odds: number;
    line_movement: number;
    odds_movement: number;
    steam_detected: boolean;
    sharp_money_indicator: boolean;
    public_percentage?: number;
    rolling_avg_7d?: number;
    rolling_avg_30d?: number;
    volatility_score?: number;
    trend_direction?: number;
    market_efficiency_score?: number;
  }> {
    try {
      // Calculate implied probability and vig
      const overOdds = prop.over_odds || 0;
      const underOdds = prop.under_odds || 0;
      
      const overProb = this.oddsToImpliedProbability(overOdds);
      const underProb = this.oddsToImpliedProbability(underOdds);
      const totalProb = overProb + underProb;
      const vig = Math.max(0, totalProb - 1);
      const impliedProbability = overProb / totalProb; // Devigged probability
      
      // Calculate true odds (fair odds without vig)
      const trueOdds = this.probabilityToOdds(impliedProbability);
      
      // Fetch historical data for movement analysis
      const historicalMovement = await this.getHistoricalMovement(prop.prop_id, prop.player_name, prop.stat_type);
      
      // Steam detection
      const steamDetected = this.detectSteamMove(historicalMovement, prop.line, overOdds);
      
      // Sharp money indicator
      const sharpMoneyIndicator = this.detectSharpMoney(historicalMovement);
      
      // Market efficiency
      const marketEfficiency = this.calculateMarketEfficiency(historicalMovement);
      
      return {
        implied_probability: impliedProbability,
        vig: vig,
        true_odds: trueOdds,
        line_movement: historicalMovement.lineMovement || 0,
        odds_movement: historicalMovement.oddsMovement || 0,
        steam_detected: steamDetected,
        sharp_money_indicator: sharpMoneyIndicator,
        public_percentage: historicalMovement.publicPercentage,
        rolling_avg_7d: historicalMovement.rollingAvg7d,
        rolling_avg_30d: historicalMovement.rollingAvg30d,
        volatility_score: historicalMovement.volatility,
        trend_direction: historicalMovement.trendDirection,
        market_efficiency_score: marketEfficiency
      };

    } catch (error) {
      this.logger.debug('⚠️ Market intelligence computation failed', {
        propId: prop.prop_id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return default values
      return {
        implied_probability: 0.5,
        vig: 0.05,
        true_odds: 0,
        line_movement: 0,
        odds_movement: 0,
        steam_detected: false,
        sharp_money_indicator: false,
        market_efficiency_score: 0.8
      };
    }
  }

  /**
   * Get historical movement data for steam detection
   */
  private async getHistoricalMovement(_propId?: string, playerName?: string, statType?: string): Promise<any> {
    try {
      // Look for recent data in both raw_props and prop_ticks_hot
      const lookbackHours = 24;
      const lookbackTime = new Date();
      lookbackTime.setHours(lookbackTime.getHours() - lookbackHours);

      const { data, error } = await this.supabase
        .from('prop_ticks_hot')
        .select('line, over_odds, under_odds, tick_timestamp')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('tick_timestamp', lookbackTime.toISOString())
        .order('tick_timestamp', { ascending: true })
        .limit(50);

      if (error || !data || data.length === 0) {
        return {
          lineMovement: 0,
          oddsMovement: 0,
          rollingAvg7d: null,
          rollingAvg30d: null,
          volatility: 0.5,
          trendDirection: 0
        };
      }

      // Calculate movement metrics
      const firstTick = data[0];
      const lastTick = data[data.length - 1];
      const lineMovement = lastTick.line - firstTick.line;
      const oddsMovement = (lastTick.over_odds || 0) - (firstTick.over_odds || 0);
      
      // Calculate rolling averages
      const lines = data.map(d => d.line);
      const rollingAvg = lines.reduce((a, b) => a + b, 0) / lines.length;
      
      // Calculate volatility
      const variance = lines.reduce((acc, line) => acc + Math.pow(line - rollingAvg, 2), 0) / lines.length;
      const volatility = Math.sqrt(variance) / rollingAvg;
      
      // Calculate trend
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      const firstHalfAvg = firstHalf.reduce((acc, d) => acc + d.line, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((acc, d) => acc + d.line, 0) / secondHalf.length;
      const trendDirection = secondHalfAvg > firstHalfAvg ? 1 : secondHalfAvg < firstHalfAvg ? -1 : 0;

      return {
        lineMovement,
        oddsMovement,
        rollingAvg7d: rollingAvg,
        rollingAvg30d: rollingAvg, // Simplified
        volatility: Math.min(1, volatility * 10), // Normalize
        trendDirection,
        dataPoints: data.length
      };

    } catch (error) {
      return {
        lineMovement: 0,
        oddsMovement: 0,
        rollingAvg7d: null,
        rollingAvg30d: null,
        volatility: 0.5,
        trendDirection: 0
      };
    }
  }

  // Utility methods for market intelligence
  private oddsToImpliedProbability(odds: number): number {
    if (!odds || odds === 0) return 0.5;
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }

  private probabilityToOdds(probability: number): number {
    if (probability <= 0) return 0;
    if (probability >= 1) return 0;
    return probability >= 0.5 ? -(probability / (1 - probability)) * 100 : ((1 - probability) / probability) * 100;
  }

  private detectSteamMove(historicalData: any, currentLine: number, currentOdds: number): boolean {
    if (!this.config.enableSteamDetection || !historicalData.lineMovement) {
      return false;
    }
    
    // Steam detection based on rapid line movement
    const lineMovementMagnitude = Math.abs(historicalData.lineMovement);
    const oddsMovementMagnitude = Math.abs(historicalData.oddsMovement || 0);
    
    return lineMovementMagnitude >= this.config.steamThreshold || oddsMovementMagnitude >= 20;
  }

  private detectSharpMoney(historicalData: any): boolean {
    // Simplified sharp money detection
    return historicalData.lineMovement && Math.abs(historicalData.lineMovement) > 0.3;
  }

  private calculateMarketEfficiency(historicalData: any): number {
    // Market efficiency based on price stability and data quality
    const volatility = historicalData.volatility || 0.5;
    const dataPoints = historicalData.dataPoints || 0;
    const minDataPoints = 5;
    
    if (dataPoints < minDataPoints) {
      return 0.6; // Default efficiency for insufficient data
    }
    
    // Lower volatility = higher efficiency
    return Math.max(0.1, Math.min(1, 1 - (volatility * 0.8)));
  }

  private calculateDataQuality(prop: any): number {
    let score = 0.5; // Base score
    
    // Required fields
    if (prop.player_name) score += 0.1;
    if (prop.sport) score += 0.1;
    if (prop.stat_type) score += 0.1;
    if (prop.line && !isNaN(prop.line)) score += 0.1;
    if (prop.over_odds && !isNaN(prop.over_odds)) score += 0.05;
    if (prop.under_odds && !isNaN(prop.under_odds)) score += 0.05;
    if (prop.game_time) score += 0.05;
    if (prop.book) score += 0.05;
    
    return Math.min(1, score);
  }

  private calculateConfidence(prop: any): number {
    const dataQuality = this.calculateDataQuality(prop);
    const hasOdds = !!(prop.over_odds && prop.under_odds);
    const hasGameTime = !!prop.game_time;
    const hasSource = !!prop.source;
    
    let confidence = dataQuality * 0.6;
    if (hasOdds) confidence += 0.2;
    if (hasGameTime) confidence += 0.1;
    if (hasSource) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}