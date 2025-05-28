import { Provider, PropCoverage } from './types';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';

interface CoverageInput {
  provider: Provider;
  data: any;
  timestamp: string;
}

const EXPECTED_PROP_TYPES = [
  'points',
  'rebounds',
  'assists',
  'threes',
  'blocks',
  'steals',
  'turnovers',
  'doubleDouble',
  'tripleDouble'
];

export async function logCoverage(
  input: CoverageInput,
  supabase: SupabaseClient
): Promise<PropCoverage> {
  const logger = new Logger('LogCoverage');
  const { provider, data, timestamp } = input;

  try {
    // Initialize coverage tracking
    const coverage: PropCoverage = {
      provider,
      timestamp,
      total: EXPECTED_PROP_TYPES.length,
      covered: 0,
      missing: []
    };

    // Extract available prop types from response
    const availableProps = new Set<string>();
    
    // Handle different provider response formats
    if (provider === 'SportsGameOdds') {
      data.markets?.forEach(market => {
        availableProps.add(market.type.toLowerCase());
      });
    } else if (provider === 'DraftEdge') {
      Object.keys(data.props || {}).forEach(prop => {
        availableProps.add(prop.toLowerCase());
      });
    }

    // Calculate coverage
    EXPECTED_PROP_TYPES.forEach(propType => {
      if (availableProps.has(propType)) {
        coverage.covered++;
      } else {
        coverage.missing.push(propType);
      }
    });

    // Store coverage report in Supabase
    await supabase.from('feed_coverage').insert({
      provider,
      timestamp,
      total_props: coverage.total,
      covered_props: coverage.covered,
      missing_props: coverage.missing,
      coverage_percentage: (coverage.covered / coverage.total) * 100
    });

    // Log warning if coverage is below threshold
    const coveragePercent = (coverage.covered / coverage.total) * 100;
    if (coveragePercent < 80) {
      logger.warn('Low prop coverage detected', {
        provider,
        coverage: coveragePercent,
        missing: coverage.missing
      });
    }

    return coverage;

  } catch (error) {
    logger.error('Failed to log coverage', {
      provider,
      error: error.message,
      timestamp
    });

    // Return minimal coverage on error
    return {
      provider,
      timestamp,
      total: EXPECTED_PROP_TYPES.length,
      covered: 0,
      missing: EXPECTED_PROP_TYPES
    };
  }
}

// Activity wrapper
export const logCoverageActivity = async (
  input: CoverageInput
): Promise<PropCoverage> => {
  const supabase = new SupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  return await logCoverage(input, supabase);
}; 