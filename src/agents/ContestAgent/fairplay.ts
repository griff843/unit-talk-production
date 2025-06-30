import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { Participant, FairPlayViolation, ContestAgentConfig } from './types';
import { Counter, Gauge, Histogram } from 'prom-client';
import { z } from 'zod';

// Validation schemas
const fairPlayViolationSchema = z.object({
  ruleId: z.string().uuid(),
  participantId: z.string().uuid(),
  timestamp: z.date(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  evidence: z.record(z.any()),
  action: z.string(),
  status: z.enum(['pending', 'resolved', 'appealed'])
});

interface BettingEvidence {
  consistentTiming?: number;
  consistentSizes?: {
    variance: number;
    average: number;
  };
  rapidSequences?: number;
  complementaryBetting?: {
    frequency: number;
    correlation: number;
    count?: number;
    total?: number;
  };
  frequentCounterparties?: Array<{
    participantId: string;
    frequency: number;
  }>;
  profitSharing?: any;
  unusualHours?: {
    percentage: number;
    hours: number[];
    distribution?: number[];
  };
  inhumanReactions?: {
    averageMs: number;
    consistency: number;
    count?: number;
    times?: number[];
  };
  perfectTiming?: {
    frequency: number;
    accuracy: number;
    variance?: number;
  };
  // Additional properties for collusion detection
  alternatingActivity?: boolean;
  similarBehavior?: boolean;
  resourceSharing?: boolean;
}

interface DetectionResult {
  isViolation: boolean;
  confidence: number;
  evidence: BettingEvidence;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface BehaviorPattern {
  type: string;
  frequency: number;
  timestamps: Date[];
  values: number[];
}

export class FairPlayMonitor {
  private supabase: SupabaseClient;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private metrics: {
    violationsDetected: Counter;
    activeMonitors: Gauge;
    checkLatency: Histogram;
    falsePositiveRate: Gauge;
    appealRate: Gauge;
  };
  private patternCache: Map<string, BehaviorPattern[]>;

  constructor(supabase: SupabaseClient, _config: ContestAgentConfig) {
    this.supabase = supabase;
    this.logger = new Logger('FairPlayMonitor');
    this.errorHandler = new ErrorHandler('FairPlayMonitor', supabase);
    this.patternCache = new Map();

    // Initialize Prometheus metrics
    this.metrics = {
      violationsDetected: new Counter({
        name: 'fairplay_violations_total',
        help: 'Total number of fair play violations detected',
        labelNames: ['severity', 'type']
      }),
      activeMonitors: new Gauge({
        name: 'fairplay_active_monitors',
        help: 'Number of active fair play monitoring sessions'
      }),
      checkLatency: new Histogram({
        name: 'fairplay_check_duration_seconds',
        help: 'Duration of fair play checks',
        buckets: [0.1, 0.5, 1, 2, 5]
      }),
      falsePositiveRate: new Gauge({
        name: 'fairplay_false_positive_rate',
        help: 'Rate of false positive detections'
      }),
      appealRate: new Gauge({
        name: 'fairplay_appeal_rate',
        help: 'Rate of violation appeals'
      })
    };
  }

  async initialize(): Promise<void> {
    try {
      // Subscribe to participant activity updates
      this.supabase
        .channel('participant_activity')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'participant_activity'
        }, this.handleActivityUpdate.bind(this))
        .subscribe();

      // Load active contests for monitoring
      const { data: contests, error } = await this.supabase
        .from('contests')
        .select('id, fairPlayConfig')
        .eq('status', 'active');

      if (error) throw error;

      this.metrics.activeMonitors.set(contests?.length || 0);

      this.logger.info('FairPlayMonitor initialized successfully', {
        activeContests: contests?.length
      });
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to initialize fair play monitor' });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.patternCache.clear();
    this.logger.info('FairPlayMonitor cleaned up');
  }

  private async handleActivityUpdate(payload: any): Promise<void> {
    try {
      const { new: activity } = payload;
      if (!activity) return;

      const startTime = process.hrtime();

      // Get participant and contest details
      const { data: participant, error: participantError } = await this.supabase
        .from('contest_participants')
        .select('*, contests!inner(*)')
        .eq('id', activity.participantId)
        .single();

      if (participantError) throw participantError;

      // Run all checks
      await Promise.all([
        this.checkMultipleAccounts(participant),
        this.checkBettingPatterns(participant),
        this.checkCollusion(participant),
        this.checkTimeAnomaly(participant)
      ]);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.checkLatency.observe(seconds + nanoseconds / 1e9);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to check fair play' });
    }
  }

  private async loadParticipantHistory(participantId: string): Promise<BehaviorPattern[]> {
    if (this.patternCache.has(participantId)) {
      return this.patternCache.get(participantId)!;
    }

    const { data: history, error } = await this.supabase
      .from('participant_history')
      .select('*')
      .eq('participant_id', participantId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const patterns = this.analyzePatterns(history || []);
    this.patternCache.set(participantId, patterns);
    return patterns;
  }

  private analyzePatterns(history: any[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Group events by type
    const eventGroups = new Map<string, any[]>();
    history.forEach(event => {
      const group = eventGroups.get(event.type) || [];
      group.push(event);
      eventGroups.set(event.type, group);
    });

    // Analyze each event type
    for (const [type, events] of Array.from(eventGroups.entries())) {
      patterns.push({
        type,
        frequency: events.length / (history.length || 1),
        timestamps: events.map(e => new Date(e.timestamp)),
        values: events.map(e => e.value)
      });
    }

    return patterns;
  }

  private async reportViolation(
    participant: Participant,
    violation: Omit<FairPlayViolation, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const fullViolation: FairPlayViolation = {
        ...violation,
        timestamp: new Date().toISOString()
      };

      // Validate violation data
      await fairPlayViolationSchema.parseAsync(fullViolation);

      // Insert violation record
      const { error } = await this.supabase
        .from('fairplay_violations')
        .insert(fullViolation);

      if (error) throw error;

      // Update participant's fair play score
      const scoreReduction = this.calculateScoreReduction(violation.severity);
      await this.updateFairPlayScore(participant.id, scoreReduction);

      // Update metrics
      this.metrics.violationsDetected.inc({
        severity: violation.severity,
        type: violation.type
      });

      this.logger.warn('Fair play violation detected', {
        participantId: participant.id,
        severity: violation.severity,
        type: violation.type
      });
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to report violation' });
    }
  }

  private calculateScoreReduction(severity: string): number {
    const reductions = {
      low: 5,
      medium: 10,
      high: 20,
      critical: 40
    };
    return reductions[severity as keyof typeof reductions] || 5;
  }

  private async updateFairPlayScore(participantId: string, reduction: number): Promise<void> {
    const { data: participant, error } = await this.supabase
      .from('contest_participants')
      .select('fairPlayScore')
      .eq('id', participantId)
      .single();

    if (error) throw error;

    const newScore = Math.max(0, (participant?.fairPlayScore || 100) - reduction);

    await this.supabase
      .from('contest_participants')
      .update({ fairPlayScore: newScore })
      .eq('id', participantId);
  }

  private async checkMultipleAccounts(participant: Participant): Promise<void> {
    try {
      const startTime = process.hrtime();

      // Get all participants from same IP addresses
      const { data: ipHistory } = await this.supabase
        .from('participant_activity')
        .select('ip_address')
        .eq('participant_id', participant.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!ipHistory?.length) return;

      const ipAddresses = Array.from(new Set(ipHistory.map(h => h.ip_address)));

      const { data: relatedParticipants } = await this.supabase
        .from('participant_activity')
        .select('participant_id, ip_address')
        .in('ip_address', ipAddresses)
        .neq('participant_id', participant.id);

      if (!relatedParticipants?.length) return;

      // Group by participant to calculate IP overlap
      const participantIPs = new Map<string, Set<string>>();
      relatedParticipants.forEach(activity => {
        const ips = participantIPs.get(activity.participant_id) || new Set();
        ips.add(activity.ip_address);
        participantIPs.set(activity.participant_id, ips);
      });

      // Calculate overlap percentages
      for (const [relatedId, ips] of Array.from(participantIPs.entries())) {
        const overlapCount = Array.from(ips).filter(ip => ipAddresses.includes(ip)).length;
        const overlapPercentage = overlapCount / Math.max(ips.size, ipAddresses.length);

        if (overlapPercentage > 0.8) { // High IP overlap threshold
          // Check for additional indicators
          const result = await this.analyzeAccountRelationship(participant.id, relatedId);

          if (result.isViolation) {
            await this.reportViolation(participant, {
              type: 'multiple_accounts',
              description: 'Multiple account relationship detected',
              severity: result.severity === 'critical' ? 'high' : result.severity,
              evidence: [
                ...Object.entries(result.evidence).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
                `ipOverlap: ${overlapPercentage}`
              ]
            });
          }
        }
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.checkLatency.observe(seconds + nanoseconds / 1e9);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to check multiple accounts' });
    }
  }

  private async analyzeAccountRelationship(
    participantId: string,
    relatedId: string
  ): Promise<DetectionResult> {
    // Get activity patterns for both accounts
    const [participantPatterns, relatedPatterns] = await Promise.all([
      this.loadParticipantHistory(participantId),
      this.loadParticipantHistory(relatedId)
    ]);

    // Check for suspicious patterns
    const indicators = {
      alternatingActivity: this.checkAlternatingActivity(participantPatterns, relatedPatterns),
      similarBehavior: this.checkBehaviorSimilarity(participantPatterns, relatedPatterns),
      resourceSharing: await this.checkResourceSharing(participantId, relatedId)
    };

    // Calculate confidence based on indicators
    const confidence = Object.values(indicators).filter(Boolean).length / Object.keys(indicators).length;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (confidence > 0.8) severity = 'critical';
    else if (confidence > 0.6) severity = 'high';
    else if (confidence > 0.4) severity = 'medium';
    else severity = 'low';

    return {
      isViolation: confidence > 0.4,
      confidence,
      evidence: indicators,
      severity
    };
  }

  private checkAlternatingActivity(
    patterns1: BehaviorPattern[],
    patterns2: BehaviorPattern[]
  ): boolean {
    // Combine all timestamps
    const allTimestamps = [
      ...patterns1.flatMap(p => p.timestamps),
      ...patterns2.flatMap(p => p.timestamps)
    ].sort((a, b) => a.getTime() - b.getTime());

    // Check for alternating pattern
    let alternatingCount = 0;
    let sameAccountCount = 0;
    let lastAccountId = '';

    for (let i = 1; i < allTimestamps.length; i++) {
      const currentTimestamp = allTimestamps[i];
      if (!currentTimestamp) continue;
      const isAccount1 = patterns1.some(p => 
        p.timestamps.some(t => t.getTime() === currentTimestamp.getTime())
      );
      const currentAccountId = isAccount1 ? '1' : '2';

      if (currentAccountId === lastAccountId) {
        sameAccountCount++;
      } else {
        alternatingCount++;
      }
      lastAccountId = currentAccountId;
    }

    return alternatingCount > sameAccountCount * 2;
  }

  private checkBehaviorSimilarity(
    patterns1: BehaviorPattern[],
    patterns2: BehaviorPattern[]
  ): boolean {
    // Compare patterns of same type
    const similarities = patterns1.map(p1 => {
      const p2 = patterns2.find(p2 => p2.type === p1.type);
      if (!p2) return 0;

      // Compare frequency
      const freqSimilarity = 1 - Math.abs(p1.frequency - p2.frequency);

      // Compare value distributions
      const valueSimilarity = this.compareValueDistributions(p1.values, p2.values);

      return (freqSimilarity + valueSimilarity) / 2;
    });

    return similarities.reduce((a, b) => a + b, 0) / similarities.length > 0.8;
  }

  private compareValueDistributions(values1: number[], values2: number[]): number {
    // Create histograms
    const histogram1 = this.createHistogram(values1);
    const histogram2 = this.createHistogram(values2);

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const bucket of Array.from(new Set([...Object.keys(histogram1), ...Object.keys(histogram2)]))) {
      const bucketNum = parseInt(bucket, 10);
      const v1 = histogram1[bucketNum] || 0;
      const v2 = histogram2[bucketNum] || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private createHistogram(values: number[]): Record<number, number> {
    const histogram: Record<number, number> = {};
    const bucketSize = 10;

    values.forEach(value => {
      const bucket = Math.floor(value / bucketSize) * bucketSize;
      histogram[bucket] = (histogram[bucket] || 0) + 1;
    });

    return histogram;
  }

  private async checkResourceSharing(
    participantId1: string,
    participantId2: string
  ): Promise<boolean> {
    // Check for shared browser fingerprints, devices, or payment methods
    const { data: resources } = await this.supabase
      .from('participant_resources')
      .select('resource_id, resource_type, participant_id')
      .or(`participant_id.eq.${participantId1},participant_id.eq.${participantId2}`);

    if (!resources?.length) return false;

    // Group by resource
    const resourceGroups = resources.reduce((groups, r) => {
      const group = groups.get(r.resource_id) || new Set();
      group.add(r.participant_id);
      groups.set(r.resource_id, group);
      return groups;
    }, new Map<string, Set<string>>());

    // Count shared resources
    const sharedCount = Array.from(resourceGroups.values())
      .filter(group => group.size > 1)
      .length;

    return sharedCount > 0;
  }

  private async checkBettingPatterns(participant: Participant): Promise<void> {
    try {
      const patterns = await this.loadParticipantHistory(participant.id);
      const bettingPatterns = patterns.filter(p => p.type === 'bet_placed');

      if (bettingPatterns.length < 10) return; // Not enough data

      // Analyze betting patterns
      const result = this.analyzeBettingBehavior(bettingPatterns);

      if (result.isViolation) {
        await this.reportViolation(participant, {
          type: 'betting_patterns',
          description: 'Suspicious betting patterns detected',
          severity: result.severity === 'critical' ? 'high' : result.severity,
          evidence: Object.entries(result.evidence).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        });
      }
    } catch (error) {
      this.errorHandler?.handleError(error as Error, { context: 'Failed to check betting patterns' });
    }
  }

  private analyzeBettingBehavior(patterns: BehaviorPattern[]): DetectionResult {
    const evidence: BettingEvidence = {};
    let suspiciousFactors = 0;

    // Check for consistent bet timing
    const timeDiffs = patterns.flatMap(p => {
      const times = p.timestamps.map(t => t.getTime());
      return times.slice(1).map((t, i) => t - (times[i] || 0));
    });

    const timeVariance = this.calculateVariance(timeDiffs);
    if (timeVariance < 1000) { // Suspiciously consistent timing
      evidence.consistentTiming = timeVariance;
      suspiciousFactors++;
    }

    // Check for unusual bet size patterns
    const betSizes = patterns.flatMap(p => p.values);
    const sizeVariance = this.calculateVariance(betSizes);
    const avgBetSize = betSizes.reduce((a, b) => a + b, 0) / betSizes.length;

    if (sizeVariance < avgBetSize * 0.1) { // Very consistent bet sizes
      evidence.consistentSizes = {
        variance: sizeVariance,
        average: avgBetSize
      };
      suspiciousFactors++;
    }

    // Check for rapid sequence betting
    const rapidSequences = patterns[0] ? this.findRapidSequences(patterns[0].timestamps, 1000) : [];
    if (rapidSequences.length > 0) {
      evidence.rapidSequences = rapidSequences.length;
      suspiciousFactors++;
    }

    // Calculate confidence and severity
    const confidence = suspiciousFactors / 3;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (confidence > 0.8) severity = 'critical';
    else if (confidence > 0.6) severity = 'high';
    else if (confidence > 0.4) severity = 'medium';
    else severity = 'low';

    return {
      isViolation: confidence > 0.4,
      confidence,
      evidence,
      severity
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private findRapidSequences(timestamps: Date[], threshold: number): number[][] {
    const sequences: number[][] = [];
    let currentSequence: number[] = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      const current = timestamps[i];
      const previous = timestamps[i-1];
      if (!current || !previous) continue;

      const timeDiff = current.getTime() - previous.getTime();
      if (timeDiff < threshold) {
        if (currentSequence.length === 0) {
          currentSequence.push(i-1);
        }
        currentSequence.push(i);
      } else if (currentSequence.length > 0) {
        sequences.push([...currentSequence]);
        currentSequence = [];
      }
    }

    if (currentSequence.length > 0) {
      sequences.push(currentSequence);
    }

    return sequences;
  }

  private async checkCollusion(participant: Participant): Promise<void> {
    try {
      // Get participant's recent betting history
      const { data: bets } = await this.supabase
        .from('participant_bets')
        .select('*')
        .eq('participant_id', participant.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!bets?.length) return;

      // Find related bets from other participants
      const { data: relatedBets } = await this.supabase
        .from('participant_bets')
        .select('*')
        .neq('participant_id', participant.id)
        .in('event_id', bets.map(b => b.event_id));

      if (!relatedBets?.length) return;

      // Analyze for collusion patterns
      const result = this.analyzeCollusionPatterns(bets, relatedBets);

      if (result.isViolation) {
        await this.reportViolation(participant, {
          type: 'collusion',
          description: 'Potential collusion detected',
          severity: result.severity === 'critical' ? 'high' : result.severity,
          evidence: Object.entries(result.evidence).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        });
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to check collusion' });
    }
  }

  private analyzeCollusionPatterns(
    participantBets: any[],
    relatedBets: any[]
  ): DetectionResult {
    const evidence: BettingEvidence = {};
    let suspiciousFactors = 0;

    // Group bets by event
    const eventBets = new Map<string, any[]>();
    relatedBets.forEach(bet => {
      const bets = eventBets.get(bet.event_id) || [];
      bets.push(bet);
      eventBets.set(bet.event_id, bets);
    });

    // Check for complementary betting
    let complementaryCount = 0;
    participantBets.forEach(bet => {
      const relatedEventBets = eventBets.get(bet.event_id) || [];
      const hasComplement = relatedEventBets.some(rb => 
        rb.bet_type === this.getComplementaryBet(bet.bet_type) &&
        Math.abs(rb.timestamp - bet.timestamp) < 60000 // Within 1 minute
      );
      if (hasComplement) complementaryCount++;
    });

    if (complementaryCount > participantBets.length * 0.3) {
      evidence.complementaryBetting = {
        frequency: complementaryCount / participantBets.length,
        correlation: complementaryCount > participantBets.length * 0.5 ? 0.8 : 0.5,
        count: complementaryCount,
        total: participantBets.length
      };
      suspiciousFactors++;
    }

    // Check for consistent counterparties
    const counterparties = new Map<string, number>();
    participantBets.forEach(bet => {
      const relatedEventBets = eventBets.get(bet.event_id) || [];
      relatedEventBets.forEach(rb => {
        counterparties.set(rb.participant_id, (counterparties.get(rb.participant_id) || 0) + 1);
      });
    });

    const frequentCounterparties = Array.from(counterparties.entries())
      .filter(([_, count]) => count > participantBets.length * 0.2);

    if (frequentCounterparties.length > 0) {
      evidence.frequentCounterparties = frequentCounterparties.map(([participantId, frequency]) => ({
        participantId,
        frequency
      }));
      suspiciousFactors++;
    }

    // Check for profit sharing patterns
    const profitPatterns = this.analyzeProfitPatterns(participantBets, relatedBets);
    if (profitPatterns.suspicious) {
      evidence.profitSharing = profitPatterns.evidence;
      suspiciousFactors++;
    }

    // Calculate confidence and severity
    const confidence = suspiciousFactors / 3;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (confidence > 0.8) severity = 'critical';
    else if (confidence > 0.6) severity = 'high';
    else if (confidence > 0.4) severity = 'medium';
    else severity = 'low';

    return {
      isViolation: confidence > 0.4,
      confidence,
      evidence,
      severity
    };
  }

  private getComplementaryBet(betType: string): string {
    const complements: Record<string, string> = {
      'win': 'lose',
      'over': 'under',
      'buy': 'sell',
      // Add more bet type complements as needed
    };
    return complements[betType] || '';
  }

  private analyzeProfitPatterns(
    participantBets: any[],
    relatedBets: any[]
  ): { suspicious: boolean; evidence: any } {
    // Group by counterparty
    const profitsByCounterparty = new Map<string, number[]>();

    participantBets.forEach(bet => {
      const relatedEventBets = relatedBets.filter(rb => rb.event_id === bet.event_id);
      relatedEventBets.forEach(rb => {
        const profits = profitsByCounterparty.get(rb.participant_id) || [];
        profits.push(bet.profit);
        profitsByCounterparty.set(rb.participant_id, profits);
      });
    });

    // Analyze profit correlations
    const suspiciousCorrelations = Array.from(profitsByCounterparty.entries())
      .filter(([_, profits]) => profits.length > 5) // Need minimum sample size
      .map(([counterpartyId, profits]) => {
        const correlation = this.calculateCorrelation(
          profits,
          relatedBets
            .filter(rb => rb.participant_id === counterpartyId)
            .map(rb => rb.profit)
        );
        return { counterpartyId, correlation };
      })
      .filter(({ correlation }) => Math.abs(correlation) > 0.7); // Strong correlation threshold

    return {
      suspicious: suspiciousCorrelations.length > 0,
      evidence: { suspiciousCorrelations }
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let i = 0; i < n; i++) {
      const xVal = x[i];
      const yVal = y[i];
      if (xVal === undefined || yVal === undefined) continue;

      const xDiff = xVal - xMean;
      const yDiff = yVal - yMean;
      numerator += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }

    return numerator / Math.sqrt(xVariance * yVariance);
  }

  private async checkTimeAnomaly(participant: Participant): Promise<void> {
    try {
      const patterns = await this.loadParticipantHistory(participant.id);

      // Analyze activity timing patterns
      const result = this.analyzeTimingPatterns(patterns);

      if (result.isViolation) {
        await this.reportViolation(participant, {
          type: 'time_anomalies',
          description: 'Time-based anomalies detected',
          severity: result.severity === 'critical' ? 'high' : result.severity,
          evidence: Object.entries(result.evidence).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        });
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, { context: 'Failed to check time anomalies' });
    }
  }

  private analyzeTimingPatterns(patterns: BehaviorPattern[]): DetectionResult {
    const evidence: BettingEvidence = {};
    let suspiciousFactors = 0;

    // Check for activity during unusual hours
    const hourDistribution = new Array(24).fill(0);
    patterns.forEach(pattern => {
      pattern.timestamps.forEach(timestamp => {
        hourDistribution[timestamp.getHours()]++;
      });
    });

    const totalActivity = hourDistribution.reduce((a, b) => a + b, 0);
    const unusualHourActivity = hourDistribution
      .slice(1, 5) // 1 AM to 5 AM
      .reduce((a, b) => a + b, 0);

    if (unusualHourActivity > totalActivity * 0.3) {
      evidence.unusualHours = {
        percentage: unusualHourActivity / totalActivity,
        hours: [1, 2, 3, 4, 5], // Unusual hours (1 AM to 5 AM)
        distribution: hourDistribution
      };
      suspiciousFactors++;
    }

    // Check for inhuman reaction times
    const reactionTimes = patterns
      .filter(p => p.type === 'bet_response')
      .flatMap(p => p.values)
      .filter(time => time < 100); // milliseconds

    if (reactionTimes.length > 0) {
      evidence.inhumanReactions = {
        averageMs: reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length,
        consistency: reactionTimes.length / patterns.length,
        count: reactionTimes.length,
        times: reactionTimes
      };
      suspiciousFactors++;
    }

    // Check for perfect timing patterns
    const timingVariance = patterns
      .filter(p => p.type === 'bet_placed')
      .map(p => this.calculateVariance(
        p.timestamps.map(t => t.getTime())
      ))
      .reduce((a, b) => Math.min(a, b), Infinity);

    if (timingVariance < 50) { // Suspiciously consistent
      evidence.perfectTiming = {
        frequency: patterns.filter(p => p.type === 'bet_placed').length,
        accuracy: timingVariance < 10 ? 0.9 : 0.7,
        variance: timingVariance
      };
      suspiciousFactors++;
    }

    // Calculate confidence and severity
    const confidence = suspiciousFactors / 3;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (confidence > 0.8) severity = 'critical';
    else if (confidence > 0.6) severity = 'high';
    else if (confidence > 0.4) severity = 'medium';
    else severity = 'low';

    return {
      isViolation: confidence > 0.4,
      confidence,
      evidence,
      severity
    };
  }

  async checkHealth(): Promise<{ status: string; details?: any }> {
    try {
      // Check database connectivity
      const { error: dbError } = await this.supabase
        .from('fairplay_violations')
        .select('id')
        .limit(1);

      if (dbError) throw dbError;

      // Get detection statistics
      const stats = {
        totalChecks: (await this.metrics.checkLatency.get()).values?.length || 0,
        violationsDetected: (await this.metrics.violationsDetected.get()).values?.[0]?.value || 0,
        falsePositiveRate: (await this.metrics.falsePositiveRate.get()).values?.[0]?.value || 0,
        averageLatency: 0 // Will calculate if histogram has values
      };

      // Calculate average latency from histogram if available
      const latencyMetric = await this.metrics.checkLatency.get();
      if (latencyMetric.values && latencyMetric.values.length > 0) {
        const sum = latencyMetric.values.reduce((acc, val) => acc + (val.value || 0), 0);
        const count = latencyMetric.values.length;
        stats.averageLatency = count > 0 ? sum / count : 0;
      }

      const status = stats.averageLatency < 2 && stats.falsePositiveRate < 0.1
        ? 'healthy'
        : 'degraded';

      return {
        status,
        details: {
          ...stats,
          patternCacheSize: this.patternCache.size
        }
      };
    } catch (error) {
      this.errorHandler.handleError(error instanceof Error ? error : new Error('Health check failed'));
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  async getMetrics(): Promise<{ errors: number; warnings: number; successes: number }> {
    const violationsMetric = await this.metrics.violationsDetected.get();
    const checkLatencyMetric = await this.metrics.checkLatency.get();

    // Extract values from Prometheus metrics
    const violationsCount = violationsMetric.values?.[0]?.value || 0;
    const successCount = checkLatencyMetric.values?.length || 0;

    return {
      errors: Math.floor(violationsCount * 0.1), // Assume 10% are critical
      warnings: Math.floor(violationsCount * 0.9), // Assume 90% are warnings
      successes: successCount
    };
  }
} 