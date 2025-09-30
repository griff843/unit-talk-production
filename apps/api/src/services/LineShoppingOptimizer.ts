import 'dotenv/config';
import { BaseAgent } from '../agents/BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../agents/BaseAgent/types';
import { withCircuitBreaker, circuitBreaker } from './enhanced-circuit-breaker';

export interface LineShoppingFactors {
  bestAvailableOdds: number;        // Factor 196: Best odds across all books
  lineShoppingEdge: number;         // Factor 197: Edge gained from line shopping
  bookmakerDivergence: number;      // Factor 198: Variance between books
  liquidityScore: number;           // Factor 199: Market liquidity assessment
  arbitrageOpportunity: number;     // Factor 200: Pure arbitrage potential
  crossBookCorrelation: number;     // Factor 201: Cross-book line correlation
  priceDiscoveryLag: number;        // Factor 202: Price discovery delays
  marketEfficiencyScore: number;    // Factor 203: Overall market efficiency
  timingAdvantageWindow: number;    // Factor 204: Optimal timing window
  exploitabilityIndex: number;      // Factor 205: Overall exploitability
}

export interface LineShoppingResult {
  factors: LineShoppingFactors;
  bestLines: BookmakerLine[];
  recommendations: LineShoppingRecommendation[];
  confidence: number;
  processingTime: number;
}

export interface BookmakerLine {
  bookmaker: string;
  odds: number;
  line: number;
  timestamp: Date;
  liquidity: 'high' | 'medium' | 'low';
  reliability: number; // 0-1 score
}

export interface LineShoppingRecommendation {
  action: 'bet_now' | 'wait' | 'skip' | 'arbitrage';
  reason: string;
  expectedValue: number;
  riskLevel: 'low' | 'medium' | 'high';
  timingWindow: number; // seconds
}

interface LineShoppingMetrics extends BaseMetrics {
  linesAnalyzed: number;
  arbitrageOpportunitiesFound: number;
  averageEdgeImprovement: number;
  apiCallsThisHour: number;
  cacheHitRate: number;
  avgProcessingTimeMs: number;
  bookmakerConnectivity: Record<string, boolean>;
}

export class LineShoppingOptimizer extends BaseAgent {
  private metrics: LineShoppingMetrics;
  private bookmakerClients: Map<string, any> = new Map();
  private cache = new Map<string, { data: any; expires: number }>();

  private readonly SUPPORTED_BOOKMAKERS = [
    'draftkings',
    'fanduel',
    'betmgm',
    'caesars',
    'pointsbet',
    'betrivers',
    'unibet'
  ];

  private readonly CACHE_TTL = {
    lines: 60000,      // 1 minute for line data
    factors: 180000,   // 3 minutes for calculated factors
    arbitrage: 30000   // 30 seconds for arbitrage opportunities
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.metrics = {
      ...this.metrics,
      linesAnalyzed: 0,
      arbitrageOpportunitiesFound: 0,
      averageEdgeImprovement: 0,
      apiCallsThisHour: 0,
      cacheHitRate: 0,
      avgProcessingTimeMs: 0,
      bookmakerConnectivity: {},
      errorCount: 0,
      successCount: 0
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🛒 LineShoppingOptimizer initializing...');

    // Register circuit breakers for each bookmaker
    for (const bookmaker of this.SUPPORTED_BOOKMAKERS) {
      circuitBreaker.registerService(`bookmaker-${bookmaker}`, {
        failureThreshold: 3,
        resetTimeoutMs: 60000, // 1 minute
        timeoutMs: 2000,       // 2 seconds per bookmaker call
        retryAttempts: 2
      });
    }

    // Initialize bookmaker clients
    await this.initializeBookmakerClients();

    // Verify connectivity
    await this.verifyBookmakerConnectivity();

    this.logger.info('✅ LineShoppingOptimizer initialized');
  }

  private async initializeBookmakerClients(): Promise<void> {
    // Initialize API clients for each bookmaker
    // Note: In production, these would be actual API clients
    for (const bookmaker of this.SUPPORTED_BOOKMAKERS) {
      this.bookmakerClients.set(bookmaker, {
        name: bookmaker,
        apiKey: process.env[`${bookmaker.toUpperCase()}_API_KEY`],
        baseUrl: this.getBookmakerBaseUrl(bookmaker),
        rateLimit: this.getBookmakerRateLimit(bookmaker)
      });
    }
  }

  private async verifyBookmakerConnectivity(): Promise<void> {
    const connectivityChecks = this.SUPPORTED_BOOKMAKERS.map(async (bookmaker) => {
      try {
        await withCircuitBreaker.generic(
          `bookmaker-${bookmaker}`,
          async () => {
            // Simulate connectivity check
            await this.testBookmakerConnection(bookmaker);
            this.metrics.bookmakerConnectivity[bookmaker] = true;
          },
          async () => {
            this.metrics.bookmakerConnectivity[bookmaker] = false;
          }
        );
      } catch (error) {
        this.metrics.bookmakerConnectivity[bookmaker] = false;
        this.logger.warn(`Failed to connect to ${bookmaker}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.allSettled(connectivityChecks);

    const connectedCount = Object.values(this.metrics.bookmakerConnectivity)
      .filter(connected => connected).length;

    this.logger.info(`📊 Bookmaker connectivity: ${connectedCount}/${this.SUPPORTED_BOOKMAKERS.length}`);
  }

  /**
   * Main entry point: Calculate line shopping factors for Enhanced45FactorEngine
   */
  async calculateLineShoppingFactors(propData: any): Promise<LineShoppingFactors> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('factors', propData);

    try {
      // Check cache first
      const cached = this.getCached(cacheKey);
      if (cached) {
        this.metrics.cacheHitRate++;
        return cached as LineShoppingFactors;
      }

      // Gather line data from all bookmakers
      const lineData = await this.gatherLineData(propData);

      // Calculate factors
      const factors = this.computeLineShoppingFactors(lineData, propData);

      // Cache results
      this.setCached(cacheKey, factors, this.CACHE_TTL.factors);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.avgProcessingTimeMs =
        (this.metrics.avgProcessingTimeMs + processingTime) / 2;
      this.metrics.linesAnalyzed++;
      this.metrics.successCount++;

      this.logger.debug('Line shopping factors calculated', {
        propId: propData.id,
        processingTime,
        bookmakerCount: lineData.length
      });

      return factors;

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Failed to calculate line shopping factors', {
        error: error instanceof Error ? error.message : String(error),
        propId: propData.id
      });

      // Return default factors on error
      return this.getDefaultLineShoppingFactors();
    }
  }

  /**
   * Find best available lines across all bookmakers
   */
  async findBestLines(propData: any, options: { priority?: number } = {}): Promise<LineShoppingResult> {
    const startTime = Date.now();

    try {
      // Gather fresh line data
      const lineData = await this.gatherLineData(propData, {
        skipCache: options.priority <= 1 // Skip cache for high priority
      });

      // Calculate factors
      const factors = this.computeLineShoppingFactors(lineData, propData);

      // Find best lines for each side
      const bestLines = this.findOptimalLines(lineData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(lineData, factors, propData);

      // Check for arbitrage opportunities
      const arbitrageOpp = this.checkArbitrageOpportunity(lineData);
      if (arbitrageOpp) {
        this.metrics.arbitrageOpportunitiesFound++;
      }

      const result: LineShoppingResult = {
        factors,
        bestLines,
        recommendations,
        confidence: this.calculateConfidence(lineData, factors),
        processingTime: Date.now() - startTime
      };

      this.logger.info('Line shopping analysis complete', {
        propId: propData.id,
        bestOdds: bestLines[0]?.odds,
        arbitrageFound: !!arbitrageOpp,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Line shopping analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        propId: propData.id
      });
      throw error;
    }
  }

  private async gatherLineData(
    propData: any,
    options: { skipCache?: boolean } = {}
  ): Promise<BookmakerLine[]> {
    const cacheKey = this.generateCacheKey('lines', propData);

    // Check cache unless skipped
    if (!options.skipCache) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached as BookmakerLine[];
      }
    }

    // Fetch from all available bookmakers in parallel
    const linePromises = this.SUPPORTED_BOOKMAKERS
      .filter(bookmaker => this.metrics.bookmakerConnectivity[bookmaker])
      .map(bookmaker => this.fetchLineFromBookmaker(bookmaker, propData));

    const lineResults = await Promise.allSettled(linePromises);

    const validLines: BookmakerLine[] = [];
    lineResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        validLines.push(result.value);
      } else {
        const bookmaker = this.SUPPORTED_BOOKMAKERS[index];
        this.logger.warn(`Failed to fetch line from ${bookmaker}`, {
          error: result.status === 'rejected' ? result.reason : 'No data'
        });
      }
    });

    // Cache results
    this.setCached(cacheKey, validLines, this.CACHE_TTL.lines);

    return validLines;
  }

  private async fetchLineFromBookmaker(
    bookmaker: string,
    propData: any
  ): Promise<BookmakerLine | null> {
    return await withCircuitBreaker.generic(
      `bookmaker-${bookmaker}`,
      async () => {
        this.metrics.apiCallsThisHour++;

        // Simulate API call to bookmaker
        // In production, this would be actual API integration
        const mockLine = this.generateMockLine(bookmaker, propData);

        return {
          bookmaker,
          odds: mockLine.odds,
          line: mockLine.line,
          timestamp: new Date(),
          liquidity: mockLine.liquidity,
          reliability: this.getBookmakerReliability(bookmaker)
        };
      },
      async () => {
        // Circuit breaker fallback
        this.logger.warn(`Circuit breaker active for ${bookmaker}`);
        return null;
      }
    );
  }

  private computeLineShoppingFactors(
    lineData: BookmakerLine[],
    propData: any
  ): LineShoppingFactors {
    if (lineData.length === 0) {
      return this.getDefaultLineShoppingFactors();
    }

    // Sort by odds (best first)
    const sortedLines = [...lineData].sort((a, b) => b.odds - a.odds);
    const bestOdds = sortedLines[0].odds;
    const worstOdds = sortedLines[sortedLines.length - 1].odds;

    // Calculate each factor
    const factors: LineShoppingFactors = {
      // Factor 196: Best available odds (normalized)
      bestAvailableOdds: this.normalizeOdds(bestOdds),

      // Factor 197: Edge gained from line shopping
      lineShoppingEdge: this.calculateLineShoppingEdge(sortedLines),

      // Factor 198: Variance between bookmakers
      bookmakerDivergence: this.calculateBookmakerDivergence(lineData),

      // Factor 199: Market liquidity assessment
      liquidityScore: this.calculateLiquidityScore(lineData),

      // Factor 200: Pure arbitrage potential
      arbitrageOpportunity: this.calculateArbitrageOpportunity(lineData),

      // Factor 201: Cross-book line correlation
      crossBookCorrelation: this.calculateCrossBookCorrelation(lineData),

      // Factor 202: Price discovery delays
      priceDiscoveryLag: this.calculatePriceDiscoveryLag(lineData),

      // Factor 203: Overall market efficiency
      marketEfficiencyScore: this.calculateMarketEfficiency(lineData),

      // Factor 204: Optimal timing window
      timingAdvantageWindow: this.calculateTimingWindow(lineData, propData),

      // Factor 205: Overall exploitability index
      exploitabilityIndex: this.calculateExploitabilityIndex(lineData, propData)
    };

    return factors;
  }

  private calculateLineShoppingEdge(sortedLines: BookmakerLine[]): number {
    if (sortedLines.length < 2) return 0;

    const bestOdds = sortedLines[0].odds;
    const averageOdds = sortedLines.reduce((sum, line) => sum + line.odds, 0) / sortedLines.length;

    // Edge as percentage improvement over average
    return Math.max(0, (bestOdds - averageOdds) / averageOdds);
  }

  private calculateBookmakerDivergence(lineData: BookmakerLine[]): number {
    if (lineData.length < 2) return 0;

    const odds = lineData.map(line => line.odds);
    const mean = odds.reduce((sum, odd) => sum + odd, 0) / odds.length;
    const variance = odds.reduce((sum, odd) => sum + Math.pow(odd - mean, 2), 0) / odds.length;

    // Normalize variance (higher variance = more opportunity)
    return Math.min(1, variance / 100);
  }

  private calculateLiquidityScore(lineData: BookmakerLine[]): number {
    const highLiquidityCount = lineData.filter(line => line.liquidity === 'high').length;
    const mediumLiquidityCount = lineData.filter(line => line.liquidity === 'medium').length;

    // Weighted score favoring high liquidity
    const score = (highLiquidityCount * 1.0 + mediumLiquidityCount * 0.5) / lineData.length;
    return Math.min(1, score);
  }

  private calculateArbitrageOpportunity(lineData: BookmakerLine[]): number {
    // Simplified arbitrage calculation
    // In production, this would consider both sides of the market
    if (lineData.length < 2) return 0;

    const bestOdds = Math.max(...lineData.map(line => line.odds));
    const impliedProbs = lineData.map(line => 1 / line.odds);
    const totalImpliedProb = Math.min(...impliedProbs) + (1 / bestOdds);

    // If total implied probability < 1, arbitrage exists
    return Math.max(0, 1 - totalImpliedProb);
  }

  private calculateCrossBookCorrelation(lineData: BookmakerLine[]): number {
    // Measure how correlated the lines are across books
    // Higher correlation = less opportunity
    if (lineData.length < 3) return 1;

    const odds = lineData.map(line => line.odds);
    const correlationCoeff = this.calculateCorrelationCoefficient(odds);

    // Return inverse (lower correlation = more opportunity)
    return Math.max(0, 1 - Math.abs(correlationCoeff));
  }

  private calculatePriceDiscoveryLag(lineData: BookmakerLine[]): number {
    // Measure time differences in price updates
    // Simplified: use timestamp variance
    const timestamps = lineData.map(line => line.timestamp.getTime());
    const maxTime = Math.max(...timestamps);
    const minTime = Math.min(...timestamps);

    const lagSeconds = (maxTime - minTime) / 1000;
    // Normalize to 0-1 (more lag = more opportunity)
    return Math.min(1, lagSeconds / 300); // 5-minute window
  }

  private calculateMarketEfficiency(lineData: BookmakerLine[]): number {
    // Combine multiple efficiency metrics
    const divergence = this.calculateBookmakerDivergence(lineData);
    const arbitrage = this.calculateArbitrageOpportunity(lineData);
    const correlation = this.calculateCrossBookCorrelation(lineData);

    // Lower efficiency = more opportunity
    return (divergence + arbitrage + correlation) / 3;
  }

  private calculateTimingWindow(lineData: BookmakerLine[], propData: any): number {
    // Calculate optimal timing window based on game start time
    const gameStartTime = new Date(propData.game_start_time);
    const now = new Date();
    const hoursToGame = (gameStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Optimal window decreases as game approaches
    if (hoursToGame > 24) return 1;
    if (hoursToGame > 12) return 0.8;
    if (hoursToGame > 6) return 0.6;
    if (hoursToGame > 2) return 0.4;
    if (hoursToGame > 0.5) return 0.2;
    return 0.1;
  }

  private calculateExploitabilityIndex(lineData: BookmakerLine[], propData: any): number {
    // Overall exploitability combining all factors
    const edge = this.calculateLineShoppingEdge(
      [...lineData].sort((a, b) => b.odds - a.odds)
    );
    const divergence = this.calculateBookmakerDivergence(lineData);
    const liquidity = this.calculateLiquidityScore(lineData);
    const timing = this.calculateTimingWindow(lineData, propData);

    // Weighted combination
    return (
      edge * 0.4 +           // 40% weight on actual edge
      divergence * 0.3 +     // 30% weight on market divergence
      liquidity * 0.2 +      // 20% weight on liquidity
      timing * 0.1           // 10% weight on timing
    );
  }

  // Utility methods
  private normalizeOdds(odds: number): number {
    // Convert American odds to normalized 0-1 scale
    if (odds > 0) {
      return Math.min(1, odds / 1000);
    } else {
      return Math.min(1, Math.abs(odds) / 1000);
    }
  }

  private calculateCorrelationCoefficient(values: number[]): number {
    // Simplified correlation calculation
    if (values.length < 2) return 1;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return variance === 0 ? 1 : Math.min(1, 1 / (1 + variance));
  }

  private findOptimalLines(lineData: BookmakerLine[]): BookmakerLine[] {
    // Return sorted lines by best odds, considering reliability
    return [...lineData]
      .sort((a, b) => {
        const aScore = a.odds * a.reliability;
        const bScore = b.odds * b.reliability;
        return bScore - aScore;
      })
      .slice(0, 3); // Top 3 options
  }

  private generateRecommendations(
    lineData: BookmakerLine[],
    factors: LineShoppingFactors,
    propData: any
  ): LineShoppingRecommendation[] {
    const recommendations: LineShoppingRecommendation[] = [];

    // High edge opportunity
    if (factors.lineShoppingEdge > 0.05) {
      recommendations.push({
        action: 'bet_now',
        reason: `Significant edge detected: ${(factors.lineShoppingEdge * 100).toFixed(1)}%`,
        expectedValue: factors.lineShoppingEdge,
        riskLevel: 'medium',
        timingWindow: 300 // 5 minutes
      });
    }

    // Arbitrage opportunity
    if (factors.arbitrageOpportunity > 0.02) {
      recommendations.push({
        action: 'arbitrage',
        reason: `Arbitrage opportunity: ${(factors.arbitrageOpportunity * 100).toFixed(1)}%`,
        expectedValue: factors.arbitrageOpportunity,
        riskLevel: 'low',
        timingWindow: 120 // 2 minutes
      });
    }

    // Wait for better lines
    if (factors.timingAdvantageWindow > 0.7 && factors.marketEfficiencyScore < 0.5) {
      recommendations.push({
        action: 'wait',
        reason: 'Market inefficiency detected, lines may improve',
        expectedValue: factors.marketEfficiencyScore,
        riskLevel: 'medium',
        timingWindow: 1800 // 30 minutes
      });
    }

    // Skip if no edge
    if (factors.exploitabilityIndex < 0.1) {
      recommendations.push({
        action: 'skip',
        reason: 'No significant edge detected across books',
        expectedValue: 0,
        riskLevel: 'high',
        timingWindow: 0
      });
    }

    return recommendations;
  }

  private checkArbitrageOpportunity(lineData: BookmakerLine[]): boolean {
    return this.calculateArbitrageOpportunity(lineData) > 0.01; // 1% threshold
  }

  private calculateConfidence(lineData: BookmakerLine[], factors: LineShoppingFactors): number {
    const dataQuality = Math.min(1, lineData.length / this.SUPPORTED_BOOKMAKERS.length);
    const reliabilityScore = lineData.reduce((sum, line) => sum + line.reliability, 0) / lineData.length;
    const factorStrength = factors.exploitabilityIndex;

    return (dataQuality + reliabilityScore + factorStrength) / 3;
  }

  // Default and fallback methods
  private getDefaultLineShoppingFactors(): LineShoppingFactors {
    return {
      bestAvailableOdds: 0,
      lineShoppingEdge: 0,
      bookmakerDivergence: 0,
      liquidityScore: 0.5,
      arbitrageOpportunity: 0,
      crossBookCorrelation: 1,
      priceDiscoveryLag: 0,
      marketEfficiencyScore: 0.5,
      timingAdvantageWindow: 0.5,
      exploitabilityIndex: 0
    };
  }

  // Mock/simulation methods (for development)
  private generateMockLine(bookmaker: string, propData: any): any {
    const baseOdds = -110; // Standard -110 odds
    const variation = (Math.random() - 0.5) * 20; // ±10 variation

    return {
      odds: baseOdds + variation,
      line: propData.line + (Math.random() - 0.5), // Small line variation
      liquidity: Math.random() > 0.3 ? 'high' : Math.random() > 0.6 ? 'medium' : 'low'
    };
  }

  private getBookmakerReliability(bookmaker: string): number {
    // Mock reliability scores
    const reliabilityMap: Record<string, number> = {
      'draftkings': 0.95,
      'fanduel': 0.93,
      'betmgm': 0.90,
      'caesars': 0.88,
      'pointsbet': 0.85,
      'betrivers': 0.82,
      'unibet': 0.80
    };
    return reliabilityMap[bookmaker] || 0.75;
  }

  private getBookmakerBaseUrl(bookmaker: string): string {
    // Mock URLs
    return `https://api.${bookmaker}.com/v1/`;
  }

  private getBookmakerRateLimit(bookmaker: string): number {
    // Mock rate limits (requests per minute)
    const rateLimits: Record<string, number> = {
      'draftkings': 100,
      'fanduel': 120,
      'betmgm': 80,
      'caesars': 90,
      'pointsbet': 60,
      'betrivers': 70,
      'unibet': 50
    };
    return rateLimits[bookmaker] || 60;
  }

  private async testBookmakerConnection(bookmaker: string): Promise<void> {
    // Mock connection test
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error(`Connection failed to ${bookmaker}`);
    }
  }

  // Cache methods
  private generateCacheKey(type: string, propData: any): string {
    return `${type}:${propData.id}:${propData.line}:${propData.stat_type}`;
  }

  private getCached(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCached(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }

  // BaseAgent implementation
  protected async process(): Promise<void> {
    // Periodic cleanup and health checks
    this.cleanupExpiredCache();
    await this.verifyBookmakerConnectivity();
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.metrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const connectedBookmakers = Object.values(this.metrics.bookmakerConnectivity)
      .filter(connected => connected).length;

    const totalBookmakers = this.SUPPORTED_BOOKMAKERS.length;
    const connectivityRate = connectedBookmakers / totalBookmakers;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (connectivityRate >= 0.8) {
      status = 'healthy';
    } else if (connectivityRate >= 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      details: {
        bookmakerConnectivity: this.metrics.bookmakerConnectivity,
        connectedCount: connectedBookmakers,
        totalCount: totalBookmakers,
        metrics: this.metrics
      }
    };
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 LineShoppingOptimizer cleanup initiated...');
    this.cache.clear();
    this.bookmakerClients.clear();
    this.logger.info('🧹 LineShoppingOptimizer cleanup complete');
  }
}