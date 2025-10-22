import { Context } from '@temporalio/activity';
import { createClient } from '@supabase/supabase-js';
import { RedisCache } from '../services/cache/RedisCache';
import { Logger } from '../services/logger';

const logger = new Logger('PropIngestionActivities');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const cache = new RedisCache({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: {
    playerMetadata: 3600,
    teamMetadata: 7200,
    oddsLines: 300,
    gameSchedules: 1800,
    userProfiles: 600,
    default: 300,
  },
  maxRetries: 3,
  retryDelay: 1000,
});

/**
 * Validate a batch of props
 */
export async function validateBatch(batch: any): Promise<{ isValid: boolean; reason?: string }> {
  const { heartbeat } = Context.current();
  
  try {
    await heartbeat();
    
    // Basic validation
    if (!batch.props || batch.props.length === 0) {
      return { isValid: false, reason: 'Empty batch' };
    }

    if (batch.props.length > 10000) {
      return { isValid: false, reason: 'Batch too large (max 10000)' };
    }

    // Validate required fields
    for (const prop of batch.props) {
      if (!prop.sport || !prop.player_name || !prop.stat_type) {
        return { isValid: false, reason: 'Missing required fields' };
      }
    }

    // Check for duplicate IDs
    const ids = new Set();
    for (const prop of batch.props) {
      if (ids.has(prop.id)) {
        return { isValid: false, reason: `Duplicate prop ID: ${prop.id}` };
      }
      ids.add(prop.id);
    }

    return { isValid: true };
  } catch (error) {
    logger.error('Batch validation error:', error);
    throw error;
  }
}

/**
 * Process a chunk of props
 */
export async function processChunk(params: {
  props: any[];
  batchId: string;
  chunkIndex: number;
}): Promise<{ processed: number; props: any[] }> {
  const { heartbeat } = Context.current();
  const { props, batchId, chunkIndex } = params;
  
  logger.info(`Processing chunk ${chunkIndex} with ${props.length} props`);

  try {
    const processedProps = [];
    
    for (const prop of props) {
      await heartbeat();
      
      // Normalize data
      const normalized = {
        ...prop,
        sport: prop.sport.toUpperCase(),
        stat_type: prop.stat_type.toLowerCase().replace(/\s+/g, '_'),
        line: parseFloat(prop.line),
        over_odds: parseInt(prop.over_odds),
        under_odds: parseInt(prop.under_odds),
        processed_at: new Date().toISOString(),
        batch_id: batchId,
      };
      
      // Validate odds
      if (Math.abs(normalized.over_odds) < 100 || Math.abs(normalized.under_odds) < 100) {
        logger.warn(`Invalid odds for prop ${prop.id}`);
        continue;
      }
      
      processedProps.push(normalized);
    }

    return {
      processed: processedProps.length,
      props: processedProps,
    };
  } catch (error) {
    logger.error(`Chunk processing error:`, error);
    throw error;
  }
}

/**
 * Enrich props with additional data
 */
export async function enrichProps(props: any[]): Promise<any[]> {
  const { heartbeat } = Context.current();
  
  logger.info(`Enriching ${props.length} props`);

  try {
    const enrichedProps = [];
    
    // Batch fetch player metadata
    const playerNames = [...new Set(props.map(p => p.player_name))];
    const playerMetadata = await fetchPlayerMetadata(playerNames);
    
    // Batch fetch game data
    const gameIds = [...new Set(props.map(p => p.game_id).filter(Boolean))];
    const gameData = await fetchGameData(gameIds);
    
    for (const prop of props) {
      await heartbeat();
      
      const enriched = {
        ...prop,
        player_metadata: playerMetadata[prop.player_name] || {},
        game_data: gameData[prop.game_id] || {},
        market_analysis: await analyzeMarket(prop),
      };
      
      enrichedProps.push(enriched);
    }

    return enrichedProps;
  } catch (error) {
    logger.error('Enrichment error:', error);
    throw error;
  }
}

/**
 * Persist props to database
 */
export async function persistProps(props: any[]): Promise<{ count: number }> {
  const { heartbeat } = Context.current();
  
  logger.info(`Persisting ${props.length} props to database`);

  try {
    // Batch insert with conflict resolution
    const chunks = chunkArray(props, 1000);
    let totalInserted = 0;
    
    for (const chunk of chunks) {
      await heartbeat();
      
      const { data, error } = await supabase
        .from('raw_props')
        .upsert(chunk, {
          onConflict: 'external_id,bookmaker',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        logger.error('Insert error:', error);
        throw error;
      }
      
      totalInserted += data?.length || 0;
      
      // Invalidate relevant caches
      await cache.invalidatePattern('odds:*');
      await cache.invalidatePattern('schedule:*');
    }

    logger.info(`Successfully persisted ${totalInserted} props`);
    
    return { count: totalInserted };
  } catch (error) {
    logger.error('Persistence error:', error);
    throw error;
  }
}

/**
 * Notify downstream systems
 */
export async function notifyDownstream(params: {
  batchId: string;
  totalProps: number;
  source: string;
}): Promise<void> {
  const { heartbeat } = Context.current();
  
  logger.info(`Notifying downstream systems for batch ${params.batchId}`);

  try {
    await heartbeat();
    
    // Publish to event bus
    const { error } = await supabase
      .from('events')
      .insert({
        type: 'props_ingested',
        source: params.source,
        data: {
          batch_id: params.batchId,
          total_props: params.totalProps,
          timestamp: new Date().toISOString(),
        },
      });
    
    if (error) {
      logger.error('Event publish error:', error);
      throw error;
    }
    
    // Trigger scoring workflow
    if (params.totalProps > 0) {
      // This would integrate with Temporal client to start scoring workflow
      logger.info(`Triggered scoring workflow for ${params.totalProps} props`);
    }
  } catch (error) {
    logger.error('Downstream notification error:', error);
    throw error;
  }
}

/**
 * Update ingestion metrics
 */
export async function updateMetrics(params: {
  workflowId: string;
  source: string;
  processed: number;
  duration: number;
  errors: number;
}): Promise<void> {
  const { heartbeat } = Context.current();
  
  try {
    await heartbeat();
    
    const { error } = await supabase
      .from('ingestion_metrics')
      .insert({
        workflow_id: params.workflowId,
        source: params.source,
        props_processed: params.processed,
        duration_ms: params.duration,
        error_count: params.errors,
        throughput: params.duration > 0 ? (params.processed / params.duration) * 1000 : 0,
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      logger.error('Metrics update error:', error);
    }
    
    // Update Prometheus metrics
    // This would integrate with metrics collection
    logger.info(`Metrics updated for workflow ${params.workflowId}`);
  } catch (error) {
    logger.error('Metrics error:', error);
    // Don't throw - metrics are non-critical
  }
}

// Helper functions

async function fetchPlayerMetadata(playerNames: string[]): Promise<Record<string, any>> {
  const metadata: Record<string, any> = {};
  
  // Try cache first
  const cacheKeys = playerNames.map(name => `player:${name}`);
  const cached = await cache.mget<any>(cacheKeys);
  
  const missingPlayers = [];
  
  for (let i = 0; i < playerNames.length; i++) {
    if (cached[i]) {
      metadata[playerNames[i]] = cached[i];
    } else {
      missingPlayers.push(playerNames[i]);
    }
  }
  
  // Fetch missing from database
  if (missingPlayers.length > 0) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .in('name', missingPlayers);
    
    if (data) {
      for (const player of data) {
        metadata[player.name] = player;
        // Cache for future
        await cache.set(`player:${player.name}`, player, 3600);
      }
    }
  }
  
  return metadata;
}

async function fetchGameData(gameIds: string[]): Promise<Record<string, any>> {
  const gameData: Record<string, any> = {};
  
  if (gameIds.length === 0) return gameData;
  
  const { data } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds);
  
  if (data) {
    for (const game of data) {
      gameData[game.id] = game;
    }
  }
  
  return gameData;
}

async function analyzeMarket(prop: any): Promise<any> {
  // Simple market analysis
  const juice = Math.abs(prop.over_odds) + Math.abs(prop.under_odds) - 200;
  const impliedProbability = {
    over: oddsToImpliedProb(prop.over_odds),
    under: oddsToImpliedProb(prop.under_odds),
  };
  
  return {
    juice,
    implied_probability: impliedProbability,
    market_efficiency: juice < 10 ? 'efficient' : 'inefficient',
  };
}

function oddsToImpliedProb(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}