import 'dotenv/config';
import { IngestionAgent } from './src/agents/IngestionAgent';
import { createClient } from '@supabase/supabase-js';
import { Logger } from './src/utils/logger';

/**
 * MANUAL INGESTION RUNNER
 * 
 * This script manually triggers the IngestionAgent to fetch and process
 * today's props from configured data providers.
 */

interface IngestionConfig {
  name: string;
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  providers: Array<{
    name: string;
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
    sports: string[];
    markets: string[];
  }>;
  batchSize: number;
  processingTimeout: number;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}

async function runIngestion() {
  const logger = new Logger('ManualIngestion');
  
  try {
    logger.info('🚀 Starting manual ingestion process...');
    
    // 1. Validate environment
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // 2. Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 3. Test database connectivity
    logger.info('🔍 Testing database connectivity...');
    const { error: dbError } = await supabase
      .from('raw_props')
      .select('count', { count: 'exact', head: true });
    
    if (dbError) {
      throw new Error(`Database connectivity failed: ${dbError.message}`);
    }
    logger.info('✅ Database connection verified');
    
    // 4. Configure ingestion agent
    const config: IngestionConfig = {
      name: 'ManualIngestionAgent',
      enabled: true,
      logLevel: 'info',
      providers: [
        {
          name: 'SportsGameOdds',
          enabled: true,
          apiKey: process.env.SPORTS_GAME_ODDS_API_KEY,
          baseUrl: 'https://api.sportsgameodds.com/v1',
          sports: ['NBA', 'NFL', 'MLB', 'NHL'],
          markets: ['player_points', 'player_rebounds', 'player_assists', 'player_threes']
        },
        {
          name: 'MockProvider',
          enabled: !process.env.SPORTS_GAME_ODDS_API_KEY, // Enable mock if no real API key
          sports: ['NBA', 'NFL', 'MLB'],
          markets: ['player_points', 'player_rebounds', 'player_assists']
        }
      ],
      batchSize: 50,
      processingTimeout: 60000, // 60 seconds
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000
      }
    };
    
    // 5. Create agent dependencies
    const dependencies = {
      supabase,
      logger,
      errorHandler: {
        handleError: async (error: Error, context?: any) => {
          logger.error('Error handled:', { error: error.message, context });
        }
      }
    };
    
    // 6. Create and run ingestion agent
    logger.info('🔧 Initializing IngestionAgent...');
    const ingestionAgent = new IngestionAgent(config as any, dependencies as any);
    
    // 7. Run the ingestion process
    logger.info('▶️  Starting ingestion process...');
    const startTime = Date.now();
    
    // Check if the agent has a direct ingestion method
    if ('runIngestion' in ingestionAgent && typeof ingestionAgent.runIngestion === 'function') {
      await (ingestionAgent as any).runIngestion();
    } else if ('process' in ingestionAgent && typeof (ingestionAgent as any).process === 'function') {
      await (ingestionAgent as any).process();
    } else {
      // Fallback to start method
      await ingestionAgent.start();
    }
    
    const duration = Date.now() - startTime;
    
    // 8. Check results
    logger.info('📊 Checking ingestion results...');
    const { data: recentProps, error: queryError } = await supabase
      .from('raw_props')
      .select('id, player_name, stat_type, line, sport, created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queryError) {
      logger.warn('Could not query recent props:', { error: queryError.message });
    } else {
      logger.info(`📈 Found ${recentProps?.length || 0} props ingested in the last hour`);
      
      if (recentProps && recentProps.length > 0) {
        logger.info('Recent props sample:');
        recentProps.slice(0, 5).forEach((prop, index) => {
          logger.info(`  ${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
        });
      }
    }
    
    // 9. Generate summary
    logger.info('✅ Ingestion process completed successfully!');
    logger.info(`⏱️  Total duration: ${Math.round(duration / 1000)}s`);
    
    // 10. Next steps guidance
    logger.info('\n🎯 Next Steps:');
    logger.info('1. Run the GradingAgent to score the new props');
    logger.info('2. Check for S/A tier props that trigger alerts');
    logger.info('3. Monitor the final_picks table for new recommendations');
    logger.info('4. Review the Discord channels for automated notifications');
    
    // 11. Cleanup
    logger.info('🧹 Cleaning up...');
    // The supabase client will be cleaned up automatically
    
  } catch (error) {
    logger.error('❌ Ingestion process failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the ingestion if this file is executed directly
if (require.main === module) {
  runIngestion().catch((error) => {
    console.error('Unhandled error in ingestion runner:', error);
    process.exit(1);
  });
}

export { runIngestion };