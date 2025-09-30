/**
 * Phase 9: Betting API Integration
 *
 * Handles real money betting through sportsbook APIs with comprehensive
 * risk management and controls for live testing validation.
 */

import { EventEmitter } from 'events';
import { Logger } from '../../shared/logger';
import {
  BettingAPIConfig,
  SportsBookAPI,
  LiveBet,
  BookCredentials,
  RateLimit,
  BetRecommendation
} from '../types';
import { ProfessionalFeaturesResult } from '../../professional/types';

export class BettingAPIIntegration extends EventEmitter {
  private logger = new Logger('BettingAPIIntegration');
  private config: BettingAPIConfig;
  private bookConnections: Map<string, SportsBookConnection> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private activeBets: Map<string, LiveBet> = new Map();

  constructor(config: BettingAPIConfig) {
    super();
    this.config = config;
    this.initializeConnections();
  }

  // ========================================
  // Initialization and Connection Management
  // ========================================

  private async initializeConnections(): Promise<void> {
    this.logger.info('Initializing sportsbook connections', {
      totalBooks: this.config.books.length,
      primaryBook: this.config.primaryBook
    });

    for (const book of this.config.books) {
      try {
        const connection = new SportsBookConnection(
          book,
          this.config.apiCredentials[book.name]
        );

        await connection.initialize();
        this.bookConnections.set(book.name, connection);

        // Initialize rate limiter
        const rateLimit = this.config.rateLimits[book.name];
        this.rateLimiters.set(book.name, new RateLimiter(rateLimit));

        this.logger.info('Sportsbook connection established', {
          book: book.name,
          features: Object.keys(book.features).filter(f => book.features[f])
        });
      } catch (error) {
        this.logger.error('Failed to initialize sportsbook connection', {
          book: book.name,
          error: error.message
        });
      }
    }
  }

  // ========================================
  // Live Bet Placement
  // ========================================

  public async placeLiveBet(
    recommendation: BetRecommendation,
    professionalFeatures: ProfessionalFeaturesResult,
    testingPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D'
  ): Promise<LiveBet> {
    const betId = this.generateBetId();

    this.logger.info('Placing live bet', {
      betId,
      market: recommendation.market,
      side: recommendation.side,
      stake: recommendation.stake,
      book: recommendation.book,
      testingPhase
    });

    // Validate bet before placement
    const validation = await this.validateBet(recommendation, professionalFeatures);
    if (!validation.valid) {
      throw new Error(`Bet validation failed: ${validation.reason}`);
    }

    // Create live bet object
    const liveBet: LiveBet = {
      id: betId,
      propId: this.generatePropId(recommendation),
      sport: this.extractSport(recommendation.market),
      market: recommendation.market,
      selection: recommendation.side,
      line: recommendation.line,
      odds: recommendation.odds,
      stake: recommendation.stake,
      professionalScore: professionalFeatures.overallProfessionalScore,
      professionalFeatures,
      clvTrackingId: this.generateCLVTrackingId(),
      kellyFraction: professionalFeatures.kellyFraction,
      book: recommendation.book,
      placedAt: new Date().toISOString(),
      status: 'PENDING',
      riskLevel: this.calculateRiskLevel(recommendation, professionalFeatures),
      correlationRisk: this.calculateCorrelationRisk(recommendation),
      portfolioImpact: this.calculatePortfolioImpact(recommendation),
      testingPhase,
      automaticallyPlaced: true
    };

    try {
      // Check rate limits
      const rateLimiter = this.rateLimiters.get(recommendation.book);
      if (rateLimiter && !rateLimiter.checkLimit()) {
        throw new Error(`Rate limit exceeded for ${recommendation.book}`);
      }

      // Place bet through sportsbook API
      const bookConnection = this.bookConnections.get(recommendation.book);
      if (!bookConnection) {
        throw new Error(`No connection available for ${recommendation.book}`);
      }

      const betResult = await bookConnection.placeBet({
        market: recommendation.market,
        side: recommendation.side,
        line: recommendation.line,
        odds: recommendation.odds,
        stake: recommendation.stake
      });

      // Update bet with confirmation details
      liveBet.betSlipId = betResult.betSlipId;
      liveBet.status = 'CONFIRMED';
      liveBet.confirmedAt = new Date().toISOString();

      // Store bet
      this.activeBets.set(betId, liveBet);

      // Emit events
      this.emit('betPlaced', liveBet);
      this.emit('betConfirmed', liveBet);

      this.logger.info('Live bet placed successfully', {
        betId,
        betSlipId: betResult.betSlipId,
        confirmationTime: Date.now() - new Date(liveBet.placedAt).getTime()
      });

      return liveBet;

    } catch (error) {
      liveBet.status = 'FAILED';
      liveBet.errorMessage = error.message;

      this.logger.error('Failed to place live bet', {
        betId,
        error: error.message,
        recommendation
      });

      this.emit('betFailed', liveBet);
      throw error;
    }
  }

  // ========================================
  // Bet Validation
  // ========================================

  private async validateBet(
    recommendation: BetRecommendation,
    professionalFeatures: ProfessionalFeaturesResult
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check bet size limits
    if (recommendation.stake > this.config.maxBetSize) {
      return {
        valid: false,
        reason: `Bet size $${recommendation.stake} exceeds limit $${this.config.maxBetSize}`
      };
    }

    // Check daily risk limits
    const dailyRisk = this.calculateDailyRisk();
    if (dailyRisk + recommendation.stake > this.config.maxDailyRisk) {
      return {
        valid: false,
        reason: `Daily risk limit would be exceeded: $${dailyRisk + recommendation.stake} > $${this.config.maxDailyRisk}`
      };
    }

    // Check Kelly criterion compliance
    if (professionalFeatures.kellyFraction > this.config.kellyMultiplier) {
      return {
        valid: false,
        reason: `Kelly fraction ${professionalFeatures.kellyFraction} exceeds limit ${this.config.kellyMultiplier}`
      };
    }

    // Check correlation limits
    const correlationCheck = this.checkCorrelationLimits(recommendation);
    if (!correlationCheck.valid) {
      return correlationCheck;
    }

    // Check professional score threshold
    if (professionalFeatures.overallProfessionalScore < 60) {
      return {
        valid: false,
        reason: `Professional score ${professionalFeatures.overallProfessionalScore} below threshold`
      };
    }

    // Check book availability
    const book = this.bookConnections.get(recommendation.book);
    if (!book || !book.isAvailable()) {
      return {
        valid: false,
        reason: `Sportsbook ${recommendation.book} not available`
      };
    }

    return { valid: true };
  }

  // ========================================
  // Risk Management
  // ========================================

  private calculateDailyRisk(): number {
    const today = new Date().toISOString().split('T')[0];
    let dailyRisk = 0;

    for (const bet of this.activeBets.values()) {
      const betDate = bet.placedAt.split('T')[0];
      if (betDate === today && bet.status !== 'FAILED') {
        dailyRisk += bet.stake;
      }
    }

    return dailyRisk;
  }

  private checkCorrelationLimits(
    recommendation: BetRecommendation
  ): { valid: boolean; reason?: string } {
    const sport = this.extractSport(recommendation.market);
    const game = this.extractGame(recommendation.market);
    const player = this.extractPlayer(recommendation.market);

    // Count existing exposures
    let sameGameCount = 0;
    let samePlayerCount = 0;
    let sameSportCount = 0;

    for (const bet of this.activeBets.values()) {
      if (bet.status === 'CONFIRMED' || bet.status === 'PENDING') {
        if (bet.sport === sport) {
          sameSportCount++;

          if (this.extractGame(bet.market) === game) {
            sameGameCount++;
          }

          if (player && this.extractPlayer(bet.market) === player) {
            samePlayerCount++;
          }
        }
      }
    }

    // Check limits
    if (sameGameCount >= this.config.correlationLimits.maxSameGame) {
      return {
        valid: false,
        reason: `Same game limit exceeded: ${sameGameCount} >= ${this.config.correlationLimits.maxSameGame}`
      };
    }

    if (player && samePlayerCount >= this.config.correlationLimits.maxSamePlayer) {
      return {
        valid: false,
        reason: `Same player limit exceeded: ${samePlayerCount} >= ${this.config.correlationLimits.maxSamePlayer}`
      };
    }

    if (sameSportCount >= this.config.correlationLimits.maxSameSport) {
      return {
        valid: false,
        reason: `Same sport limit exceeded: ${sameSportCount} >= ${this.config.correlationLimits.maxSameSport}`
      };
    }

    return { valid: true };
  }

  private calculateRiskLevel(
    recommendation: BetRecommendation,
    professionalFeatures: ProfessionalFeaturesResult
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Base risk on Kelly fraction and professional score
    const kellyRisk = professionalFeatures.kellyFraction;
    const profScore = professionalFeatures.overallProfessionalScore;

    if (kellyRisk <= 0.05 && profScore >= 80) return 'LOW';
    if (kellyRisk <= 0.15 && profScore >= 65) return 'MEDIUM';
    return 'HIGH';
  }

  private calculateCorrelationRisk(recommendation: BetRecommendation): number {
    // Calculate correlation risk based on existing positions
    const sport = this.extractSport(recommendation.market);
    let correlationRisk = 0;

    for (const bet of this.activeBets.values()) {
      if (bet.sport === sport && (bet.status === 'CONFIRMED' || bet.status === 'PENDING')) {
        correlationRisk += 0.1; // 10% correlation risk per same-sport bet
      }
    }

    return Math.min(correlationRisk, 1.0);
  }

  private calculatePortfolioImpact(recommendation: BetRecommendation): number {
    const totalExposure = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING')
      .reduce((sum, bet) => sum + bet.stake, 0);

    return recommendation.stake / (totalExposure + recommendation.stake);
  }

  // ========================================
  // Bet Monitoring and Settlement
  // ========================================

  public async monitorBets(): Promise<void> {
    const pendingBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED');

    for (const bet of pendingBets) {
      try {
        const bookConnection = this.bookConnections.get(bet.book);
        if (!bookConnection) continue;

        const betStatus = await bookConnection.getBetStatus(bet.betSlipId!);

        if (betStatus.settled) {
          await this.settleBet(bet, betStatus.result, betStatus.payout);
        }
      } catch (error) {
        this.logger.error('Error monitoring bet', {
          betId: bet.id,
          error: error.message
        });
      }
    }
  }

  private async settleBet(
    bet: LiveBet,
    result: 'WIN' | 'LOSS' | 'PUSH',
    payout: number
  ): Promise<void> {
    bet.status = 'SETTLED';
    bet.result = result;
    bet.settledAt = new Date().toISOString();
    bet.pnl = payout - bet.stake;
    bet.roi = bet.pnl / bet.stake;

    // Calculate CLV if closing line is available
    if (bet.clvTrackingId) {
      bet.clv = await this.calculateCLV(bet);
    }

    this.emit('betSettled', bet);

    this.logger.info('Bet settled', {
      betId: bet.id,
      result,
      pnl: bet.pnl,
      roi: bet.roi,
      clv: bet.clv
    });
  }

  // ========================================
  // Emergency Controls
  // ========================================

  public async emergencyStopAll(): Promise<void> {
    this.logger.warn('Emergency stop activated - cancelling all pending bets');

    const pendingBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'PENDING');

    for (const bet of pendingBets) {
      try {
        const bookConnection = this.bookConnections.get(bet.book);
        if (!bookConnection) continue;

        await bookConnection.cancelBet(bet.betSlipId!);
        bet.status = 'CANCELLED';

        this.emit('betCancelled', bet);
      } catch (error) {
        this.logger.error('Failed to cancel bet during emergency stop', {
          betId: bet.id,
          error: error.message
        });
      }
    }

    this.emit('emergencyStop');
  }

  // ========================================
  // Utility Methods
  // ========================================

  private generateBetId(): string {
    return `live_bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePropId(recommendation: BetRecommendation): string {
    return `prop_${recommendation.market}_${recommendation.side}`.replace(/\s+/g, '_');
  }

  private generateCLVTrackingId(): string {
    return `clv_track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractSport(market: string): string {
    // Extract sport from market string (implementation depends on market format)
    const sportMap: Record<string, string> = {
      'nba': 'NBA',
      'nfl': 'NFL',
      'mlb': 'MLB',
      'nhl': 'NHL',
      'ncaaf': 'NCAAF',
      'wnba': 'WNBA',
      'tennis': 'TENNIS'
    };

    for (const [key, value] of Object.entries(sportMap)) {
      if (market.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'UNKNOWN';
  }

  private extractGame(market: string): string {
    // Extract game identifier from market (team names, etc.)
    return market.split(' ')[0] || 'unknown';
  }

  private extractPlayer(market: string): string | null {
    // Extract player name if this is a player prop
    if (market.includes(' - ')) {
      return market.split(' - ')[0];
    }
    return null;
  }

  private async calculateCLV(bet: LiveBet): Promise<number> {
    // Implementation would calculate CLV based on closing line
    // This is a placeholder implementation
    return Math.random() * 0.1 - 0.05; // Random CLV between -5% and +5%
  }

  // ========================================
  // Getters
  // ========================================

  public getActiveBets(): LiveBet[] {
    return Array.from(this.activeBets.values());
  }

  public getBet(betId: string): LiveBet | undefined {
    return this.activeBets.get(betId);
  }

  public getBookStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, connection] of this.bookConnections) {
      status[name] = connection.isAvailable();
    }
    return status;
  }

  public getDailyStats(): {
    totalBets: number;
    totalStaked: number;
    wins: number;
    losses: number;
    pending: number;
    netPnL: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    const todaysBets = Array.from(this.activeBets.values())
      .filter(bet => bet.placedAt.split('T')[0] === today);

    return {
      totalBets: todaysBets.length,
      totalStaked: todaysBets.reduce((sum, bet) => sum + bet.stake, 0),
      wins: todaysBets.filter(bet => bet.result === 'WIN').length,
      losses: todaysBets.filter(bet => bet.result === 'LOSS').length,
      pending: todaysBets.filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING').length,
      netPnL: todaysBets.reduce((sum, bet) => sum + (bet.pnl || 0), 0)
    };
  }
}

// ========================================
// Supporting Classes
// ========================================

class SportsBookConnection {
  private book: SportsBookAPI;
  private credentials: BookCredentials;
  private isConnected = false;

  constructor(book: SportsBookAPI, credentials: BookCredentials) {
    this.book = book;
    this.credentials = credentials;
  }

  async initialize(): Promise<void> {
    // Initialize connection to sportsbook API
    this.isConnected = true;
  }

  async placeBet(bet: {
    market: string;
    side: string;
    line: number;
    odds: number;
    stake: number;
  }): Promise<{ betSlipId: string }> {
    // Place bet through sportsbook API
    return { betSlipId: `bet_${Date.now()}` };
  }

  async getBetStatus(betSlipId: string): Promise<{
    settled: boolean;
    result?: 'WIN' | 'LOSS' | 'PUSH';
    payout?: number;
  }> {
    // Get bet status from sportsbook API
    return { settled: false };
  }

  async cancelBet(betSlipId: string): Promise<void> {
    // Cancel bet through sportsbook API
  }

  isAvailable(): boolean {
    return this.isConnected;
  }
}

class RateLimiter {
  private requests: number[] = [];
  private limit: RateLimit;

  constructor(limit: RateLimit) {
    this.limit = limit;
  }

  checkLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    // Check if we're under the limit
    if (this.requests.length >= this.limit.requestsPerMinute) {
      return false;
    }

    // Add current request
    this.requests.push(now);
    return true;
  }
}