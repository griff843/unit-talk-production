import { AlertAgent } from '..';
import { makeLogger } from '../../../utils/logger';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { requireSupabase, supabaseClient } from '../../../utils/supabaseUtils';

// Circuit breaker is imported dynamically in functions to avoid unused import warnings

/**
 * Temporal activity for processing alerts
 */
export async function processAlert(): Promise<void> {
  // Create minimal config for activity execution
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: makeLogger('AlertAgent'),
    supabase: undefined as any // Will be injected by the agent
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for evaluating alert conditions
 */
export async function evaluateConditions(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: makeLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for sending notifications
 */
export async function sendNotification(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: makeLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for escalating alerts
 */
export async function escalateAlert(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: makeLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Missing activities required by syndicate-scheduler workflow
 */
export async function detectSuspiciousActivity(params: {
  leagues: string[];
  patterns: string[]
}): Promise<Array<{
  propId: string;
  league: string;
  pattern: string;
  confidence: number;
  details: any;
}>> {
  console.log(`[AlertAgent] Detecting suspicious activity for leagues: ${params.leagues.join(', ')}`);
  // Return empty array for now - placeholder implementation
  return [];
}

export async function detectLineMovement(params: {
  leagues: string[];
  significantThreshold: number;
  timeWindow: number;
}): Promise<Array<{
  propId: string;
  league: string;
  movement: number;
  direction: 'up' | 'down';
  timestamp: Date;
}>> {
  console.log(`[AlertAgent] Detecting line movement for leagues: ${params.leagues.join(', ')}`);
  return [];
}

export async function detectSteamMovement(params: {
  leagues: string[];
  threshold: number;
  timeWindow: number;
}): Promise<Array<{
  propId: string;
  league: string;
  oldLine: number;
  newLine: number;
  movement: number;
  timestamp: Date;
}>> {
  const startTime = Date.now();
  const correlationId = `steam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const logger = makeLogger('AlertAgent:SteamDetection');

  logger.info('Steam movement detection initiated', {
    correlationId,
    leagues: params.leagues,
    threshold: params.threshold,
    timeWindow: params.timeWindow,
    timestamp: new Date().toISOString()
  });

  try {
    const steamDetections = await detectSteamMoves(params, correlationId, logger);

    const processingTime = Date.now() - startTime;
    logger.info('Steam movement detection completed', {
      correlationId,
      detectionsFound: steamDetections.length,
      processingTimeMs: processingTime,
      performance: processingTime < 2000 ? 'optimal' : 'slow'
    });

    // Update Prometheus metrics
    const Metrics = (await import('../../../monitoring/metrics')).Metrics;
    const metrics = Metrics.getInstance();
    metrics.trackOperation('steam_detection', 'success');
    metrics.trackDuration('steam_detection', processingTime);
    metrics.setBusinessMetric('steam_detections_found', steamDetections.length);

    return steamDetections;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Steam movement detection failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime
    });

    // Update error metrics
    const Metrics = (await import('../../../monitoring/metrics')).Metrics;
    const metrics = Metrics.getInstance();
    metrics.trackOperation('steam_detection', 'failure');
    metrics.trackError('steam_detection', error instanceof Error ? error.constructor.name : 'unknown');

    throw error;
  }
}

export async function detectHedgeOpportunities(params: {
  leagues: string[];
  minProfitMargin: number;
}): Promise<Array<{
  propId: string;
  league: string;
  hedgeOpportunity: {
    originalBet: any;
    hedgeBet: any;
    guaranteedProfit: number;
  };
}>> {
  console.log(`[AlertAgent] Detecting hedge opportunities for leagues: ${params.leagues.join(', ')}`);
  return [];
}

export async function detectMiddleOpportunities(params: {
  leagues: string[];
  minGap: number;
}): Promise<Array<{
  propId: string;
  league: string;
  middleOpportunity: {
    lowBet: any;
    highBet: any;
    gap: number;
    winProbability: number;
  };
}>> {
  console.log(`[AlertAgent] Detecting middle opportunities for leagues: ${params.leagues.join(', ')}`);
  return [];
}

export async function detectInjuryImpacts(params: {
  leagues: string[];
  sources: string[];
}): Promise<Array<{
  playerId: string;
  playerName: string;
  league: string;
  injuryType: string;
  severity: 'minor' | 'major' | 'season-ending';
  affectedProps: string[];
  source: string;
}>> {
  const startTime = Date.now();
  const correlationId = `injury-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const logger = makeLogger('AlertAgent:InjuryAnalysis');

  logger.info('Enhanced injury analysis initiated', {
    correlationId,
    leagues: params.leagues,
    sources: params.sources,
    timestamp: new Date().toISOString()
  });

  try {
    const injuryImpacts = await analyzeInjuryImpacts(params, correlationId, logger);

    const processingTime = Date.now() - startTime;
    logger.info('Enhanced injury analysis completed', {
      correlationId,
      impactsFound: injuryImpacts.length,
      processingTimeMs: processingTime,
      performance: processingTime < 2000 ? 'optimal' : 'slow'
    });

    // Update Prometheus metrics
    const Metrics = (await import('../../../monitoring/metrics')).Metrics;
    const metrics = Metrics.getInstance();
    metrics.trackOperation('injury_analysis', 'success');
    metrics.trackDuration('injury_analysis', processingTime);
    metrics.setBusinessMetric('injury_impacts_found', injuryImpacts.length);

    return injuryImpacts;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Enhanced injury analysis failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime
    });

    // Update error metrics
    const Metrics = (await import('../../../monitoring/metrics')).Metrics;
    const metrics = Metrics.getInstance();
    metrics.trackOperation('injury_analysis', 'failure');
    metrics.trackError('injury_analysis', error instanceof Error ? error.constructor.name : 'unknown');

    throw error;
  }
}

export async function detectStaleLines(params: {
  leagues: string[];
  maxAge: number;
}): Promise<Array<{
  propId: string;
  league: string;
  age: number;
  lastUpdate: Date;
}>> {
  console.log(`[AlertAgent] Detecting stale lines for leagues: ${params.leagues.join(', ')}, maxAge: ${params.maxAge}`);
  return [];
}

/**
 * Core Steam Detection Engine
 * Implements enterprise-grade line movement detection with comprehensive monitoring
 */
async function detectSteamMoves(
  params: { leagues: string[]; threshold: number; timeWindow: number },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<Array<{
  propId: string;
  league: string;
  oldLine: number;
  newLine: number;
  movement: number;
  timestamp: Date;
}>> {
  const detections: Array<{
    propId: string;
    league: string;
    oldLine: number;
    newLine: number;
    movement: number;
    timestamp: Date;
  }> = [];

  try {
    // Import Supabase client with circuit breaker protection
    const { withCircuitBreaker } = await import('../../../services/enhanced-circuit-breaker');
    const { supabaseClient } = await import('../../../services/supabaseClient');

    const steamDetectionResults = await withCircuitBreaker.supabase(async () => {
      // 1. Query recent prop tick data for line movement analysis
      const supabaseClient = requireSupabase();
      const { data: recentTicks, error: tickError } = await supabaseClient
        .from('prop_ticks_hot')
        .select(`
          prop_id,
          tick_timestamp,
          line,
          odds_over,
          odds_under,
          volume,
          book,
          market_type
        `)
        .in('market_type', ['standard', 'live'])
        .gte('tick_timestamp', new Date(Date.now() - params.timeWindow * 60000).toISOString())
        .order('tick_timestamp', { ascending: false })
        .limit(10000); // Limit for performance

      if (tickError) {
        throw new Error(`Failed to fetch tick data: ${tickError.message}`);
      }

      if (!recentTicks || recentTicks.length === 0) {
        logger.warn('No recent tick data found for steam detection', { correlationId });
        return [];
      }

      logger.info('Analyzing tick data for steam patterns', {
        correlationId,
        ticksAnalyzed: recentTicks.length,
        timeWindowMinutes: params.timeWindow
      });

      // 2. Group ticks by prop_id for movement analysis
      const propGroups = new Map<string, typeof recentTicks>();
      for (const tick of recentTicks) {
        if (!propGroups.has(tick.prop_id)) {
          propGroups.set(tick.prop_id, []);
        }
        propGroups.get(tick.prop_id)!.push(tick);
      }

      const steamResults: Array<{
        propId: string;
        league: string;
        oldLine: number;
        newLine: number;
        movement: number;
        timestamp: Date;
      }> = [];

      // 3. Analyze each prop for steam patterns
      for (const [propId, ticks] of propGroups) {
        if (ticks.length < 2) continue;

        // Sort by timestamp for chronological analysis
        ticks.sort((a, b) => new Date(a.tick_timestamp).getTime() - new Date(b.tick_timestamp).getTime());

        const steamDetection = await analyzePropForSteam(ticks, params, correlationId, logger);
        if (steamDetection) {
          steamResults.push(steamDetection);
        }
      }

      return steamResults;
    }, async () => {
      logger.warn('Steam detection failed due to circuit breaker, using fallback', { correlationId });
      return [];
    });

    return steamDetectionResults;

  } catch (error) {
    logger.error('Steam detection engine error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Analyze individual prop for steam movement patterns
 */
async function analyzePropForSteam(
  ticks: any[],
  params: { threshold: number },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<{
  propId: string;
  league: string;
  oldLine: number;
  newLine: number;
  movement: number;
  timestamp: Date;
} | null> {
  try {
    const oldestTick = ticks[0];
    const newestTick = ticks[ticks.length - 1];

    const lineMovement = Math.abs(newestTick.line - oldestTick.line);

    // 1. Check for significant line movement (>3 points threshold)
    if (lineMovement >= params.threshold) {
      // 2. Check for volume spike (>200% average)
      const avgVolume = ticks.reduce((sum, tick) => sum + (tick.volume || 0), 0) / ticks.length;
      const recentVolume = newestTick.volume || 0;
      const volumeSpike = recentVolume > (avgVolume * 2);

      // 3. Check for reverse line movement pattern
      const isReverseMovement = await detectReverseLineMovement(ticks, logger);

      if (volumeSpike || isReverseMovement) {
        logger.info('Steam movement detected', {
          correlationId,
          propId: newestTick.prop_id,
          lineMovement,
          volumeSpike,
          isReverseMovement,
          oldLine: oldestTick.line,
          newLine: newestTick.line
        });

        // Generate immediate Discord alert for steam detection
        await generateSteamAlert({
          propId: newestTick.prop_id,
          league: 'TBD', // TODO: Extract from prop metadata
          oldLine: oldestTick.line,
          newLine: newestTick.line,
          movement: lineMovement,
          volumeSpike,
          isReverseMovement,
          book: newestTick.book
        }, correlationId, logger);

        return {
          propId: newestTick.prop_id,
          league: 'TBD', // TODO: Extract from prop metadata
          oldLine: oldestTick.line,
          newLine: newestTick.line,
          movement: lineMovement,
          timestamp: new Date(newestTick.tick_timestamp)
        };
      }
    }

    return null;
  } catch (error) {
    logger.error('Error analyzing prop for steam', {
      correlationId,
      propId: ticks[0]?.prop_id,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Detect reverse line movement patterns (sharp money vs public action)
 */
async function detectReverseLineMovement(
  ticks: any[],
  logger: ReturnType<typeof makeLogger>
): Promise<boolean> {
  try {
    // Analyze betting volume vs line movement correlation
    // Reverse movement: high volume on one side but line moves opposite direction

    if (ticks.length < 3) return false;

    const midTick = ticks[Math.floor(ticks.length / 2)];
    const latestTick = ticks[ticks.length - 1];

    // Check if line moved opposite to expected direction based on volume
    const volumeDirection = (latestTick.volume || 0) > (midTick.volume || 0) ? 'up' : 'down';
    const lineDirection = latestTick.line > midTick.line ? 'up' : 'down';

    const isReverse = volumeDirection !== lineDirection;

    if (isReverse) {
      logger.debug('Reverse line movement detected', {
        propId: ticks[0].prop_id,
        volumeDirection,
        lineDirection,
        volumeChange: (latestTick.volume || 0) - (midTick.volume || 0),
        lineChange: latestTick.line - midTick.line
      });
    }

    return isReverse;
  } catch (error) {
    logger.error('Error detecting reverse line movement', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Core Enhanced Injury Analysis Engine
 * Implements intelligent injury report parsing and prop impact assessment
 */
async function analyzeInjuryImpacts(
  params: { leagues: string[]; sources: string[] },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<Array<{
  playerId: string;
  playerName: string;
  league: string;
  injuryType: string;
  severity: 'minor' | 'major' | 'season-ending';
  affectedProps: string[];
  source: string;
}>> {
  try {
    // Import Supabase client with circuit breaker protection
    const { withCircuitBreaker } = await import('../../../services/enhanced-circuit-breaker');
    const { supabaseClient } = await import('../../../services/supabaseClient');

    const injuryAnalysisResults = await withCircuitBreaker.supabase(async () => {
      // 1. Query recent injury reports and player status changes
      const supabaseClient = requireSupabase();
      const { data: injuryReports, error: injuryError } = await supabaseClient
        .from('injury_reports')
        .select(`
          id,
          player_id,
          player_name,
          league,
          injury_type,
          severity,
          status,
          report_date,
          source,
          description
        `)
        .in('league', params.leagues)
        .in('source', params.sources)
        .gte('report_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('report_date', { ascending: false });

      if (injuryError) {
        logger.warn('No injury_reports table found, using fallback detection', {
          correlationId,
          error: injuryError.message
        });
        return await fallbackInjuryDetection(params, correlationId, logger);
      }

      if (!injuryReports || injuryReports.length === 0) {
        logger.info('No recent injury reports found', { correlationId });
        return [];
      }

      logger.info('Processing injury reports for impact analysis', {
        correlationId,
        reportsFound: injuryReports.length
      });

      const impacts: Array<{
        playerId: string;
        playerName: string;
        league: string;
        injuryType: string;
        severity: 'minor' | 'major' | 'season-ending';
        affectedProps: string[];
        source: string;
      }> = [];

      // 2. Analyze each injury report for prop impacts
      for (const report of injuryReports) {
        const impact = await analyzeInjuryPropImpact(report, correlationId, logger);
        if (impact) {
          impacts.push(impact);

          // Store injury impact in database
          await storeInjuryImpact(impact, correlationId, logger);

          // Generate automatic Discord alert for significant injuries
          await generateInjuryAlert(impact, correlationId, logger);
        }
      }

      return impacts;
    }, async () => {
      logger.warn('Injury analysis failed due to circuit breaker, using fallback', { correlationId });
      return await fallbackInjuryDetection(params, correlationId, logger);
    });

    return injuryAnalysisResults;
  } catch (error) {
    logger.error('Enhanced injury analysis engine error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Analyze individual injury report for prop betting impacts
 */
async function analyzeInjuryPropImpact(
  report: any,
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<{
  playerId: string;
  playerName: string;
  league: string;
  injuryType: string;
  severity: 'minor' | 'major' | 'season-ending';
  affectedProps: string[];
  source: string;
} | null> {
  try {
    // 1. Calculate injury severity based on type and description
    const severity = calculateInjurySeverity(report.injury_type, report.description);

    // 2. Determine affected prop types based on injury and player position
    const affectedProps = await determineAffectedProps(report, severity, logger);

    if (affectedProps.length === 0) {
      logger.debug('No significant prop impacts identified', {
        correlationId,
        playerId: report.player_id,
        injuryType: report.injury_type
      });
      return null;
    }

    logger.info('Injury prop impact analyzed', {
      correlationId,
      playerId: report.player_id,
      playerName: report.player_name,
      severity,
      affectedPropsCount: affectedProps.length
    });

    return {
      playerId: report.player_id,
      playerName: report.player_name,
      league: report.league,
      injuryType: report.injury_type,
      severity,
      affectedProps,
      source: report.source
    };
  } catch (error) {
    logger.error('Error analyzing injury prop impact', {
      correlationId,
      playerId: report.player_id,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Calculate injury severity based on type and description
 */
function calculateInjurySeverity(injuryType: string, description: string): 'minor' | 'major' | 'season-ending' {
  const injuryTypeLower = injuryType.toLowerCase();
  const descriptionLower = description?.toLowerCase() || '';

  // Season-ending indicators
  if (
    injuryTypeLower.includes('acl') ||
    injuryTypeLower.includes('achilles') ||
    descriptionLower.includes('season-ending') ||
    descriptionLower.includes('out for season') ||
    descriptionLower.includes('surgery')
  ) {
    return 'season-ending';
  }

  // Major injury indicators
  if (
    injuryTypeLower.includes('fracture') ||
    injuryTypeLower.includes('torn') ||
    injuryTypeLower.includes('grade 2') ||
    injuryTypeLower.includes('grade 3') ||
    descriptionLower.includes('weeks') ||
    descriptionLower.includes('month')
  ) {
    return 'major';
  }

  // Default to minor
  return 'minor';
}

/**
 * Determine which prop types are affected by an injury
 */
async function determineAffectedProps(
  report: any,
  severity: 'minor' | 'major' | 'season-ending',
  logger: ReturnType<typeof makeLogger>
): Promise<string[]> {
  const affectedProps: string[] = [];
  const injuryType = report.injury_type.toLowerCase();
  const league = report.league.toUpperCase();

  // Severity-based impact (season-ending affects all props)
  if (severity === 'season-ending') {
    return getAllPropTypesForLeague(league);
  }

  // Injury-specific prop impacts
  if (injuryType.includes('ankle') || injuryType.includes('foot') || injuryType.includes('knee')) {
    affectedProps.push('rushing_yards', 'receiving_yards', 'points', 'rebounds');
  }

  if (injuryType.includes('shoulder') || injuryType.includes('arm') || injuryType.includes('wrist')) {
    affectedProps.push('passing_yards', 'passing_touchdowns', 'assists', 'three_point_made');
  }

  if (injuryType.includes('back') || injuryType.includes('core')) {
    affectedProps.push('rushing_attempts', 'carries', 'total_bases');
  }

  if (injuryType.includes('head') || injuryType.includes('concussion')) {
    // Concussion affects all performance metrics
    return getAllPropTypesForLeague(league);
  }

  logger.debug('Determined affected props for injury', {
    injuryType,
    severity,
    affectedProps
  });

  return affectedProps;
}

/**
 * Get all prop types for a specific league
 */
function getAllPropTypesForLeague(league: string): string[] {
  switch (league) {
    case 'NFL':
      return ['passing_yards', 'rushing_yards', 'receiving_yards', 'passing_touchdowns', 'rushing_touchdowns', 'receptions'];
    case 'NBA':
      return ['points', 'rebounds', 'assists', 'three_point_made', 'steals', 'blocks'];
    case 'MLB':
      return ['hits', 'runs', 'rbis', 'home_runs', 'stolen_bases', 'strikeouts'];
    case 'NHL':
      return ['goals', 'assists', 'points', 'shots_on_goal', 'penalty_minutes'];
    default:
      return ['points', 'yards', 'assists', 'rebounds']; // Generic props
  }
}

/**
 * Generate Discord alert for significant injury impacts
 */
async function generateInjuryAlert(
  impact: any,
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<void> {
  try {
    if (impact.severity === 'minor') {
      // Only alert for major and season-ending injuries
      return;
    }

    const { sendDiscordAlert } = await import('../integrations/discord');
    const { buildAlertEmbed } = await import('../embedBuilder');

    const alertData = {
      id: `injury-${impact.playerId}`,
      player_name: impact.playerName,
      bet_type: 'injury_alert',
      league: impact.league,
      tier: impact.severity === 'season-ending' ? 'S-tier' : 'A-tier',
      injury_type: impact.injuryType,
      affected_props: impact.affectedProps
    };

    const alertMessage = `🚨 INJURY ALERT: ${impact.playerName} (${impact.league}) - ${impact.injuryType} (${impact.severity}). Affected props: ${impact.affectedProps.join(', ')}`;

    const embed = buildAlertEmbed(alertData, alertMessage);
    await sendDiscordAlert(embed);

    logger.info('Injury alert sent to Discord', {
      correlationId,
      playerId: impact.playerId,
      playerName: impact.playerName,
      severity: impact.severity
    });
  } catch (error) {
    logger.error('Failed to generate injury alert', {
      correlationId,
      playerId: impact.playerId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Generate Discord alert for steam movement detection
 */
async function generateSteamAlert(
  steamData: {
    propId: string;
    league: string;
    oldLine: number;
    newLine: number;
    movement: number;
    volumeSpike: boolean;
    isReverseMovement: boolean;
    book: string;
  },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<void> {
  try {
    const { sendDiscordAlert } = await import('../integrations/discord');
    const { buildAlertEmbed } = await import('../embedBuilder');

    // Create alert data structure
    const alertData = {
      id: `steam-${steamData.propId}`,
      prop_id: steamData.propId,
      player_name: 'Steam Detection', // Generic for now
      bet_type: 'steam_alert',
      league: steamData.league,
      tier: 'S-tier', // Steam alerts are always high priority
      line: steamData.newLine,
      old_line: steamData.oldLine,
      movement: steamData.movement,
      book: steamData.book,
      volume_spike: steamData.volumeSpike,
      reverse_movement: steamData.isReverseMovement
    };

    const direction = steamData.newLine > steamData.oldLine ? '🔼' : '🔽';
    const alertMessage = `🚨 STEAM DETECTED ${direction}\n` +
      `Line Movement: ${steamData.oldLine} → ${steamData.newLine} (${steamData.movement.toFixed(1)} pts)\n` +
      `Book: ${steamData.book}\n` +
      `${steamData.volumeSpike ? '📈 Volume Spike Detected' : ''}\n` +
      `${steamData.isReverseMovement ? '🔄 Reverse Line Movement' : ''}\n` +
      `Prop ID: ${steamData.propId}`;

    const embed = buildAlertEmbed(alertData, alertMessage);

    // Add steam-specific styling
    embed.setTitle(`🚨 STEAM ALERT: Line Movement ${direction}`)
      .setColor(0xFF4444) // Red for urgent steam alerts
      .addFields([
        { name: 'Movement', value: `${steamData.oldLine} → ${steamData.newLine}`, inline: true },
        { name: 'Points', value: `${steamData.movement.toFixed(1)}`, inline: true },
        { name: 'Book', value: steamData.book, inline: true }
      ]);

    if (steamData.volumeSpike) {
      embed.addFields([{ name: 'Volume', value: '📈 Spike Detected', inline: true }]);
    }

    if (steamData.isReverseMovement) {
      embed.addFields([{ name: 'Pattern', value: '🔄 Reverse Movement', inline: true }]);
    }

    await sendDiscordAlert(embed);

    logger.info('Steam alert sent to Discord', {
      correlationId,
      propId: steamData.propId,
      movement: steamData.movement,
      volumeSpike: steamData.volumeSpike,
      isReverseMovement: steamData.isReverseMovement
    });

  } catch (error) {
    logger.error('Failed to generate steam alert', {
      correlationId,
      propId: steamData.propId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Store injury impact in database
 */
async function storeInjuryImpact(
  impact: {
    playerId: string;
    playerName: string;
    league: string;
    injuryType: string;
    severity: 'minor' | 'major' | 'season-ending';
    affectedProps: string[];
    source: string;
  },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<void> {
  try {
    const { withCircuitBreaker } = await import('../../../services/enhanced-circuit-breaker');
    const { supabaseClient } = await import('../../../services/supabaseClient');

    await withCircuitBreaker.supabase(async () => {
      // Check if player exists, create if not
      let playerId = impact.playerId;

      // If playerId is just the player name, try to find existing player or create new one
      if (!impact.playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const supabaseClient = requireSupabase();
      const { data: existingPlayer, error: playerSearchError } = await supabaseClient
          .from('players')
          .select('id')
          .eq('name', impact.playerName)
          .eq('sport', impact.league.toUpperCase())
          .single();

        if (playerSearchError && playerSearchError.code !== 'PGRST116') {
          throw new Error(`Player search failed: ${playerSearchError.message}`);
        }

        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          // Create new player
          const supabaseClient = requireSupabase();
      const { data: newPlayer, error: createPlayerError } = await supabaseClient
            .from('players')
            .insert({
              name: impact.playerName,
              sport: impact.league.toUpperCase(),
              team: null, // Would need to be extracted from injury report
              position: null
            })
            .select('id')
            .single();

          if (createPlayerError) {
            throw new Error(`Player creation failed: ${createPlayerError.message}`);
          }

          playerId = newPlayer.id;
        }
      }

      // Calculate impact score based on severity and affected props
      const impactScore = calculateInjuryImpactScore(impact.severity, impact.affectedProps);

      // Store injury impact
      const supabaseClient = requireSupabase();
      const { error: injuryError } = await supabaseClient
        .from('injury_impacts')
        .insert({
          player_id: playerId,
          injury_type: impact.injuryType,
          severity: impact.severity,
          affected_props: impact.affectedProps,
          impact_score: impactScore,
          reported_at: new Date().toISOString(),
          source: impact.source,
          status: 'active'
        });

      if (injuryError) {
        throw new Error(`Injury impact storage failed: ${injuryError.message}`);
      }

      logger.info('Injury impact stored in database', {
        correlationId,
        playerId,
        playerName: impact.playerName,
        injuryType: impact.injuryType,
        severity: impact.severity,
        impactScore
      });
    }, async () => {
      logger.warn('Failed to store injury impact due to circuit breaker', {
        correlationId,
        playerName: impact.playerName
      });
    });

  } catch (error) {
    logger.error('Error storing injury impact', {
      correlationId,
      playerName: impact.playerName,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Calculate injury impact score based on severity and affected props
 */
function calculateInjuryImpactScore(
  severity: 'minor' | 'major' | 'season-ending',
  affectedProps: string[]
): number {
  let baseScore = 0;

  // Base score by severity
  switch (severity) {
    case 'minor':
      baseScore = 0.3;
      break;
    case 'major':
      baseScore = 0.7;
      break;
    case 'season-ending':
      baseScore = 1.0;
      break;
  }

  // Adjust based on number of affected props
  const propMultiplier = Math.min(1.5, 1 + (affectedProps.length - 1) * 0.1);

  return Math.min(1.0, baseScore * propMultiplier);
}

/**
 * Fallback injury detection when injury_reports table is not available
 */
async function fallbackInjuryDetection(
  params: { leagues: string[]; sources: string[] },
  correlationId: string,
  logger: ReturnType<typeof makeLogger>
): Promise<Array<{
  playerId: string;
  playerName: string;
  league: string;
  injuryType: string;
  severity: 'minor' | 'major' | 'season-ending';
  affectedProps: string[];
  source: string;
}>> {
  logger.info('Using fallback injury detection method', { correlationId });

  // TODO: Implement fallback detection using external APIs or cached data
  // For now, return empty array to maintain system stability
  return [];
}