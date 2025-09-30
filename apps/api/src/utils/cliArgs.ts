export interface FeedAgentCliArgs {
  rate?: number;
  batch?: number;
  sports?: string[];
  books?: string[];
  help?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  cache?: boolean;
  skipValidation?: boolean;
}

export interface ParsedArgs {
  args: FeedAgentCliArgs;
  remainingArgs: string[];
}

/**
 * Parse CLI arguments for FeedAgent
 * Supports flags like: --rate=1000 --batch=50 --sports=NFL,NBA --books=draftkings,fanduel
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const args: FeedAgentCliArgs = {};
  const remainingArgs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Handle --help or -h
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    // Handle --dry-run
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    // Handle --verbose or -v
    if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
      continue;
    }

    // Handle --cache (enable cache-first mode)
    if (arg === '--cache') {
      args.cache = true;
      continue;
    }

    // Handle --skip-validation
    if (arg === '--skip-validation') {
      args.skipValidation = true;
      continue;
    }

    // Handle --rate=<number>
    if (arg.startsWith('--rate=')) {
      const rateValue = arg.split('=')[1];
      const rate = parseInt(rateValue, 10);
      if (isNaN(rate) || rate < 1) {
        throw new Error(`Invalid rate value: ${rateValue}. Must be a positive integer.`);
      }
      args.rate = rate;
      continue;
    }

    // Handle --batch=<number>
    if (arg.startsWith('--batch=')) {
      const batchValue = arg.split('=')[1];
      const batch = parseInt(batchValue, 10);
      if (isNaN(batch) || batch < 1) {
        throw new Error(`Invalid batch value: ${batchValue}. Must be a positive integer.`);
      }
      args.batch = batch;
      continue;
    }

    // Handle --sports=<comma-separated-list>
    if (arg.startsWith('--sports=')) {
      const sportsValue = arg.split('=')[1];
      if (!sportsValue) {
        throw new Error('Sports list cannot be empty. Example: --sports=NFL,NBA,MLB');
      }
      args.sports = sportsValue.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
      if (args.sports.length === 0) {
        throw new Error('No valid sports provided. Example: --sports=NFL,NBA,MLB');
      }
      continue;
    }

    // Handle --books=<comma-separated-list>
    if (arg.startsWith('--books=')) {
      const booksValue = arg.split('=')[1];
      if (!booksValue) {
        throw new Error('Books list cannot be empty. Example: --books=draftkings,fanduel');
      }
      args.books = booksValue.split(',').map(b => b.trim().toLowerCase()).filter(b => b);
      if (args.books.length === 0) {
        throw new Error('No valid books provided. Example: --books=draftkings,fanduel');
      }
      continue;
    }

    // Handle unknown flags
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}. Use --help for usage information.`);
    }

    // Non-flag arguments
    remainingArgs.push(arg);
  }

  return { args, remainingArgs };
}

/**
 * Validate CLI arguments
 */
export function validateCliArgs(args: FeedAgentCliArgs): void {
  // Validate rate limits
  if (args.rate && args.rate > 10000) {
    throw new Error('Rate limit too high. Maximum allowed: 10000 requests per hour.');
  }

  // Validate batch size
  if (args.batch && args.batch > 1000) {
    throw new Error('Batch size too large. Maximum allowed: 1000 items per batch.');
  }

  // Validate sports list
  if (args.sports) {
    const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA', 'EPL', 'ATP'];
    const invalidSports = args.sports.filter(sport => !validSports.includes(sport));
    if (invalidSports.length > 0) {
      throw new Error(`Invalid sports: ${invalidSports.join(', ')}. Valid options: ${validSports.join(', ')}`);
    }
  }

  // Validate books list
  if (args.books) {
    const validBooks = [
      'draftkings', 'fanduel', 'pointsbet', 'betmgm', 'caesars', 'barstool',
      'unibet', 'betrivers', 'superbook', 'betway', 'pinnacle', 'circa'
    ];
    const invalidBooks = args.books.filter(book => !validBooks.includes(book));
    if (invalidBooks.length > 0) {
      throw new Error(`Invalid books: ${invalidBooks.join(', ')}. Valid options: ${validBooks.join(', ')}`);
    }
  }
}

/**
 * Get default configuration with CLI overrides
 */
export function getConfigWithCliOverrides(args: FeedAgentCliArgs) {
  const config = {
    // Default values
    rate: 1000, // props per hour
    batch: 100, // props per batch
    sports: ['NFL', 'NBA', 'MLB', 'NHL'], // default sports
    books: [], // all books if empty
    cache: true, // cache enabled by default
    dryRun: false,
    verbose: false,
    skipValidation: false,

    // CLI overrides
    ...args
  };

  return config;
}

/**
 * Display help message
 */
export function displayHelp(): void {
  console.log(`
FeedAgent CLI Options:

BASIC OPTIONS:
  --help, -h                Show this help message
  --dry-run                Run without making database changes
  --verbose, -v            Enable verbose logging
  --cache                  Enable cache-first mode (default: true)
  --skip-validation        Skip data validation steps

CONFIGURATION:
  --rate=<number>          Maximum props to process per hour (default: 1000, max: 10000)
  --batch=<number>         Number of props per batch (default: 100, max: 1000)
  --sports=<list>          Comma-separated sports list (default: NFL,NBA,MLB,NHL)
  --books=<list>           Comma-separated books list (default: all books)

EXAMPLES:
  npm run feed-agent --rate=500 --sports=NFL,NBA
  npm run feed-agent --batch=50 --books=draftkings,fanduel --verbose
  npm run feed-agent --dry-run --sports=MLB --rate=200
  npm run feed-agent --cache --sports=NFL,NBA,MLB,NHL --batch=200

VALID SPORTS:
  NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA, EPL, ATP

VALID BOOKS:
  draftkings, fanduel, pointsbet, betmgm, caesars, barstool,
  unibet, betrivers, superbook, betway, pinnacle, circa
`);
}

/**
 * Create FeedAgent configuration from CLI args
 */
export function createFeedAgentConfigFromCli(args: FeedAgentCliArgs) {
  const config = getConfigWithCliOverrides(args);

  return {
    name: 'FeedAgent',
    enabled: true,
    version: '2.0.0',
    logLevel: config.verbose ? 'debug' : 'info',

    // Performance settings
    batchSize: config.batch,
    maxRatePerHour: config.rate,

    // Data source configuration
    sports: config.sports,
    books: config.books,

    // Feature flags
    cacheFirst: config.cache,
    dryRun: config.dryRun,
    skipValidation: config.skipValidation,

    // Processing configuration
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000
    },

    dedupeConfig: {
      checkInterval: 300,
      ttlHours: 24
    },

    // Metrics and monitoring
    metrics: { enabled: true },

    // Provider configuration (will be populated based on sports)
    providers: {}
  };
}