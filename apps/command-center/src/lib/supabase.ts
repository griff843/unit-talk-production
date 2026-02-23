import {
  createClient as createSupabaseClient,
  SupabaseClient,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { Database, Json } from '@/types';

// SPRINT-TRUTH-RESTORATION-001: DEMO_MODE gating for mock data
// INVARIANT #2: Fail-closed environment - no silent fallbacks
// INVARIANT #4: No demo mode without explicit DEMO_MODE=true flag
// SPRINT-ARCHITECTURE-HARDENING-002A: Lazy evaluation (no module-scope env access)

/**
 * Get DEMO_MODE setting lazily (runtime access, not build-time)
 */
function getDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

// Backward compat alias (evaluated lazily via getter)
const DEMO_MODE = false; // Never accessed directly - use getDemoMode()

/**
 * Fail-closed error for missing Supabase configuration.
 * This error is thrown when DEMO_MODE is not enabled and Supabase env vars are missing.
 */
class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'FAIL-CLOSED: Supabase configuration required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, ' +
        'or set DEMO_MODE=true for development without Supabase.'
    );
    this.name = 'SupabaseConfigurationError';
  }
}

// Type definitions for Supabase query results with relations
interface UnifiedPickWithRelations {
  id: string;
  user_id: string;
  sport: string | null;
  pick_type: string | null;
  prediction: string | null;
  confidence: number | null;
  status: string | null;
  result: string | null;
  created_at: string;
  approved_at: string | null;
  denied_at: string | null;
  selection: string | null;
  users?: {
    username: string;
    tier: string;
  } | null;
  raw_props?: {
    player_name: string;
    team: string | null;
    opponent: string | null;
    prop_type: string | null;
    line: number | null;
    over_odds: number | null;
    under_odds: number | null;
    game_date: string | null;
    games?: {
      league: string;
      home_team: string;
      away_team: string;
      start_time: string | null;
    } | null;
    players?: {
      name: string;
      sport: string;
    } | null;
  } | null;
}

interface AgentHealthRecord {
  id: string;
  agent: string;
  status: string;
  details: Json;
  created_at: string;
}

interface AgentMetricsRecord {
  id: string;
  agent: string;
  metrics: Json;
  created_at: string;
}

// Type guard for Json to object type conversion
function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Typed Supabase client - using 'any' to avoid type recursion with merged extension types
// This is a workaround for "Type instantiation is excessively deep and possibly infinite" errors
// caused by the database-extensions.ts merge with the generated types
type TypedSupabaseClient = SupabaseClient<Database>;

// Lazy initialization of Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
let clientInitialized = false;

/**
 * Get Supabase client with fail-closed behavior.
 *
 * INVARIANT #2: Fail-closed - throws if env vars missing and DEMO_MODE not set
 * INVARIANT #4: DEMO_MODE must be explicit for mock data
 *
 * @returns Supabase client (never null in production mode)
 * @throws SupabaseConfigurationError if env vars missing and DEMO_MODE !== 'true'
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseClient(): any {
  // Return cached client if already initialized
  if (clientInitialized && client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // DEMO_MODE: Explicit flag required for mock data
    if (getDemoMode()) {
      console.warn('[DEMO_MODE] Supabase not configured - mock data will be used');
      console.warn('[DEMO_MODE] This is expected in development without Supabase');
      clientInitialized = true;
      client = null; // Null client signals DEMO_MODE to consumer functions
      return null;
    }

    // FAIL-CLOSED: No silent fallback without explicit DEMO_MODE
    console.error('FAIL-CLOSED: Supabase configuration required');
    console.error('Missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('Set DEMO_MODE=true to run without Supabase');
    throw new SupabaseConfigurationError();
  }

  client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);
  clientInitialized = true;
  console.log('✅ Supabase client initialized successfully');
  return client;
}

/**
 * Check if running in DEMO_MODE (explicit mock data mode)
 */
export function isDemoMode(): boolean {
  return getDemoMode();
}

/**
 * Check if Supabase is available (not in DEMO_MODE with missing config)
 */
export function isSupabaseAvailable(): boolean {
  if (clientInitialized) return client !== null;
  try {
    return getSupabaseClient() !== null;
  } catch {
    return false;
  }
}

// Export the typed client getter function
// NOTE: Use getSupabaseClient() instead of supabase to get fail-closed behavior
// The supabase export is a getter that calls getSupabaseClient() lazily
export { getSupabaseClient };
export type { TypedSupabaseClient };

// Legacy export for backward compatibility - lazily evaluated via getter
// Uses a Proxy to defer initialization and enforce fail-closed behavior
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _lazySupabase: any = undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = new Proxy({} as TypedSupabaseClient, {
  get(_, prop) {
    if (_lazySupabase === undefined) {
      _lazySupabase = getSupabaseClient();
    }
    if (_lazySupabase === null) {
      // DEMO_MODE is true but no client - throw for direct supabase usage
      // Code should use dbOperations which handle DEMO_MODE properly
      throw new SupabaseConfigurationError();
    }
    return _lazySupabase[prop];
  },
});

// Export createClient function for API routes
export function createClient() {
  return getSupabaseClient();
}

// Database schema types
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical UsersRow
// Legacy alias User exported below for backward compatibility
export interface SupabaseUser {
  id: string;
  discord_id: string;
  username: string;
  tier: 'Free' | 'Premium' | 'VIP';
  status: 'active' | 'inactive' | 'banned';
  created_at: string;
  updated_at: string;
  last_active: string;
  total_picks: number;
  win_rate: number;
  revenue: number;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy alias for backward compatibility
export type User = SupabaseUser;

export interface Pick {
  id: string;
  user_id: string;
  sport: string;
  event: string;
  pick_type: string;
  selection: string;
  odds: number;
  stake: number;
  confidence: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  created_at: string;
  settled_at?: string;
  profit?: number;
  // Enhanced fields from v3.0.0 unified structure
  capper?: string;
  tier?: string;
  approval_status?: string;
  actual_result?: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  last_run: string;
  success_rate: number;
  avg_response_time: number;
  total_operations: number;
  configuration: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip_address: string;
  user_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
}

// Connection test function
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  demoMode: boolean;
  error?: string;
}> {
  try {
    const client = getSupabaseClient();

    if (!client) {
      // Only possible if DEMO_MODE is true
      console.log('[DEMO_MODE] Database connection test skipped');
      return { connected: false, demoMode: true };
    }

    const { error } = await client.from('users').select('count').limit(1);

    if (error) {
      console.log('Database connection test failed:', error.message);
      return { connected: false, demoMode: false, error: error.message };
    }

    console.log('✅ Database connection successful');
    return { connected: true, demoMode: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.log('Database connection test failed:', errorMsg);
    return { connected: false, demoMode: getDemoMode(), error: errorMsg };
  }
}

// Check if required tables exist
export async function checkRequiredTables(): Promise<Record<string, boolean>> {
  const requiredTables = ['users', 'agents', 'security_events'];
  const tableStatus: Record<string, boolean> = {};

  try {
    const client = getSupabaseClient();

    if (!client) {
      // DEMO_MODE: All tables marked as unavailable
      console.log('[DEMO_MODE] Table check skipped - using mock data');
      requiredTables.forEach(table => {
        tableStatus[table] = false;
      });
      return tableStatus;
    }

    for (const table of requiredTables) {
      try {
        const { error } = await client.from(table).select('*').limit(1);
        tableStatus[table] = !error;
      } catch {
        tableStatus[table] = false;
      }
    }
  } catch {
    // Client init failed - mark all as unavailable
    requiredTables.forEach(table => {
      tableStatus[table] = false;
    });
  }

  return tableStatus;
}

// Database operations
export const dbOperations = {
  // Users
  async getUsers() {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock users data');
      const { mockUsers } = await import('./mockData');
      return mockUsers;
    }

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // FAIL-CLOSED: Database errors are not silently ignored
        console.error('Database query failed:', error.message);
        if (getDemoMode()) {
          console.log('[DEMO_MODE] Falling back to mock users after error');
          const { mockUsers } = await import('./mockData');
          return mockUsers;
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} users from database`);
      return data as unknown as SupabaseUser[];
    } catch (err) {
      // FAIL-CLOSED: Connection errors are not silently ignored
      console.error('Database connection failed:', err);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock users after connection error');
        const { mockUsers } = await import('./mockData');
        return mockUsers;
      }
      throw err;
    }
  },

  async getUserById(id: string) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Requires Supabase (no DEMO_MODE fallback for specific user queries)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    const { data, error } = await client.from('users').select('*').eq('id', id).single();

    if (error) throw error;
    return data as unknown as SupabaseUser;
  },

  async updateUser(id: string, updates: Partial<SupabaseUser>) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    const { data, error } = await client
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as SupabaseUser;
  },

  // Picks - Connect to real Unit Talk unified_picks table (v3.0.0)
  async getPicks(limit = 100) {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock picks data');
      const { mockRecentPicks } = await import('./mockData');
      return mockRecentPicks.slice(0, limit);
    }

    try {
      // Query real unified_picks table with proper relationships
      const { data, error } = await client
        .from('unified_picks')
        .select(
          `
          *,
          users!inner (
            id,
            username,
            tier
          ),
          raw_props (
            id,
            player_name,
            team,
            opponent,
            prop_type,
            line,
            over_odds,
            under_odds,
            game_date,
            games (
              league,
              home_team,
              away_team,
              start_time
            ),
            players (
              name,
              position,
              sport
            )
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('unified_picks query failed:', error.message);
        if (getDemoMode()) {
          console.log('[DEMO_MODE] Falling back to mock picks after error');
          const { mockRecentPicks } = await import('./mockData');
          return mockRecentPicks.slice(0, limit);
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Transform unified_picks to Pick interface
      const picks = this.transformUnifiedPicksToPicks(data);
      console.log(`✅ Retrieved ${picks.length} picks from unified_picks table`);
      return picks;
    } catch (err) {
      console.error('Database connection failed:', err);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock picks after connection error');
        const { mockRecentPicks } = await import('./mockData');
        return mockRecentPicks.slice(0, limit);
      }
      throw err;
    }
  },

  // Transform unified_picks data to Pick interface (v3.0.0)
  transformUnifiedPicksToPicks(unifiedPicks: UnifiedPickWithRelations[]): Pick[] {
    return unifiedPicks.map(pick => {
      const rawProp = pick.raw_props;
      const game = rawProp?.games;
      const player = rawProp?.players;
      const user = pick.users;

      return {
        id: pick.id,
        user_id: pick.user_id,
        sport: rawProp?.players?.sport || game?.league || pick.sport || 'Unknown',
        event: game
          ? `${game.away_team} @ ${game.home_team}`
          : rawProp
            ? `${rawProp.team} vs ${rawProp.opponent}`
            : 'Unknown Game',
        pick_type: rawProp?.prop_type || pick.pick_type || 'prop',
        selection: this.formatPickSelection(pick, rawProp, player),
        odds: this.getPickOdds(pick, rawProp),
        stake: 100, // Default stake - could be enhanced with user preference
        confidence: pick.confidence || 0,
        status: this.mapUnifiedPickStatus(pick.status, pick.result),
        created_at: pick.created_at,
        settled_at: pick.approved_at || pick.denied_at || undefined,
        profit: this.calculateUnifiedProfit(pick, rawProp),
        // Additional context from v3.0.0 unified structure
        capper: user?.username || 'Unknown',
        tier: user?.tier || 'Free',
        approval_status: pick.status,
        actual_result: pick.result,
      };
    });
  },

  // Enhanced selection formatting for unified structure
  formatPickSelection(
    pick: UnifiedPickWithRelations,
    rawProp: UnifiedPickWithRelations['raw_props'],
    player: UnifiedPickWithRelations['raw_props'] extends { players?: infer P } ? P : never
  ): string {
    const playerName = rawProp?.player_name || player?.name || 'Unknown Player';
    const propType = rawProp?.prop_type || pick.pick_type || 'prop';
    const line = rawProp?.line;
    const prediction = pick.prediction;

    if (line && prediction) {
      return `${playerName} ${propType} ${prediction} ${line}`;
    }

    return `${playerName} ${propType} - ${prediction || pick.selection || 'N/A'}`;
  },

  // Get odds based on prediction and prop data
  getPickOdds(
    pick: UnifiedPickWithRelations,
    rawProp: UnifiedPickWithRelations['raw_props']
  ): number {
    if (!rawProp) return 0;

    if (pick.prediction === 'over' || pick.prediction === 'yes') {
      return rawProp.over_odds || 0;
    } else if (pick.prediction === 'under' || pick.prediction === 'no') {
      return rawProp.under_odds || 0;
    }

    // Fallback to average if prediction unclear
    return rawProp.over_odds || rawProp.under_odds || 0;
  },

  // Map unified pick status to Command Center format
  mapUnifiedPickStatus(status: string | null, result: string | null): Pick['status'] {
    // First check result if settled
    if (result) {
      switch (result.toLowerCase()) {
        case 'win':
          return 'won';
        case 'loss':
          return 'lost';
        case 'push':
          return 'void';
        default:
          break;
      }
    }

    // Then check approval status
    if (!status) return 'pending';
    switch (status.toLowerCase()) {
      case 'approved':
        return result ? this.mapPickStatus(result) : 'pending';
      case 'denied':
        return 'void';
      case 'settled':
        return result ? this.mapPickStatus(result) : 'pending';
      default:
        return 'pending';
    }
  },

  // Calculate profit from unified structure
  calculateUnifiedProfit(
    pick: UnifiedPickWithRelations,
    rawProp: UnifiedPickWithRelations['raw_props']
  ): number | undefined {
    if (!pick.result || pick.result === 'pending') return undefined;

    const stake = 100; // Default stake
    const odds = this.getPickOdds(pick, rawProp);

    if (pick.result === 'win') {
      return odds > 0 ? (stake * odds) / 100 : stake / (Math.abs(odds) / 100);
    } else if (pick.result === 'loss') {
      return -stake;
    }

    return 0; // Push
  },

  mapPickStatus(result: string | null): Pick['status'] {
    if (!result) return 'pending';
    switch (result.toLowerCase()) {
      case 'win':
        return 'won';
      case 'loss':
        return 'lost';
      case 'push':
        return 'void';
      case 'pending':
        return 'pending';
      default:
        return 'pending';
    }
  },

  calculateProfit(
    pick: UnifiedPickWithRelations,
    rawProp: UnifiedPickWithRelations['raw_props']
  ): number | undefined {
    if (!pick.result || pick.result === 'pending') return undefined;

    const stake = 100; // Default stake
    const odds = pick.prediction === 'over' ? rawProp?.over_odds || 0 : rawProp?.under_odds || 0;

    if (pick.result === 'win') {
      return odds > 0 ? (stake * odds) / 100 : stake / (Math.abs(odds) / 100);
    } else if (pick.result === 'loss') {
      return -stake;
    }

    return 0; // Push
  },

  async getPicksByUser(userId: string) {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] No picks available for user in demo mode');
      return [];
    }

    const { data, error } = await client
      .from('unified_picks')
      .select(
        `
        *,
        users!inner (
          username,
          tier
        ),
        raw_props (
          player_name,
          prop_type,
          line,
          over_odds,
          under_odds,
          players (
            name,
            sport
          )
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return this.transformUnifiedPicksToPicks(data || []);
  },

  // Get picks with enhanced filtering for v3.0.0
  async getPicksWithFilters(
    filters: {
      userId?: string;
      sport?: string;
      status?: string;
      result?: string;
      tier?: string;
      limit?: number;
    } = {}
  ) {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock picks with filters');
      const { mockRecentPicks } = await import('./mockData');
      return mockRecentPicks;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = client.from('unified_picks').select(`
        *,
        users!inner (
          username,
          tier
        ),
        raw_props (
          player_name,
          team,
          opponent,
          prop_type,
          line,
          over_odds,
          under_odds,
          game_date,
          players (
            name,
            sport
          )
        )
      `);

    // Apply filters
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.sport) query = query.eq('sport', filters.sport);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.result) query = query.eq('result', filters.result);
    if (filters.tier) query = query.eq('users.tier', filters.tier);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);

    if (error) {
      console.error('Filtered picks query failed:', error.message);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock picks after filter error');
        const { mockRecentPicks } = await import('./mockData');
        return mockRecentPicks;
      }
      throw new Error(`Database query failed: ${error.message}`);
    }

    return this.transformUnifiedPicksToPicks(data || []);
  },

  async createPick(pick: Omit<Pick, 'id' | 'created_at'>) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    const { data, error } = await client
      .from('unified_picks')
      .insert({
        user_id: pick.user_id,
        sport: pick.sport,
        pick_type: pick.pick_type,
        prediction: pick.selection.includes('over') ? 'over' : 'under',
        confidence: pick.confidence,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return this.transformUnifiedPicksToPicks([data])[0];
  },

  // Pick approval/denial functionality for unified structure
  async approvePick(pickId: string, approvedBy: string) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId)
        .select(
          `
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `
        )
        .single();

      if (error) throw error;

      console.log(`✅ Pick ${pickId} approved by ${approvedBy}`);
      return this.transformUnifiedPicksToPicks([data])[0];
    } catch (err) {
      console.error('Failed to approve pick:', err);
      throw new Error(
        `Failed to approve pick: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  },

  async denyPick(pickId: string, deniedBy: string, reason?: string) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          status: 'denied',
          denied_by: deniedBy,
          denial_reason: reason,
          denied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId)
        .select(
          `
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `
        )
        .single();

      if (error) throw error;

      console.log(`✅ Pick ${pickId} denied by ${deniedBy}${reason ? `: ${reason}` : ''}`);
      return this.transformUnifiedPicksToPicks([data])[0];
    } catch (err) {
      console.error('Failed to deny pick:', err);
      throw new Error(
        `Failed to deny pick: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  },

  async updatePickResult(pickId: string, result: 'win' | 'loss' | 'push', actualValue?: number) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          result,
          status: 'settled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickId)
        .select(
          `
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `
        )
        .single();

      if (error) throw error;

      console.log(`✅ Pick ${pickId} result updated to ${result}`);
      return this.transformUnifiedPicksToPicks([data])[0];
    } catch (err) {
      console.error('Failed to update pick result:', err);
      throw new Error(
        `Failed to update pick result: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  },

  // Agents - Connect to real Unit Talk agent system
  async getAgents() {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock agents data');
      const { mockAgents } = await import('./mockData');
      return mockAgents;
    }

    try {
      // Query real agent_health table from Unit Talk production
      const { data: healthData, error: healthError } = await client
        .from('agent_health')
        .select('*')
        .order('created_at', { ascending: false });

      if (healthError) {
        console.warn('agent_health query failed, trying agent_metrics:', healthError.message);

        // Fallback to agent_metrics table
        const { data: metricsData, error: metricsError } = await client
          .from('agent_metrics')
          .select('*')
          .order('created_at', { ascending: false });

        if (metricsError) {
          console.error('agent_metrics query also failed:', metricsError.message);
          if (getDemoMode()) {
            console.log('[DEMO_MODE] Falling back to mock agents after error');
            const { mockAgents } = await import('./mockData');
            return mockAgents;
          }
          throw new Error(`Database query failed: ${metricsError.message}`);
        }

        // Transform agent_metrics to Agent format
        const agents = this.transformMetricsToAgents(metricsData);
        console.log(`✅ Retrieved ${agents.length} agents from agent_metrics table`);
        return agents;
      }

      // Transform agent_health to Agent format
      const agents = this.transformHealthToAgents(healthData);
      console.log(`✅ Retrieved ${agents.length} agents from agent_health table`);
      return agents;
    } catch (err) {
      console.error('Database connection failed:', err);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock agents after connection error');
        const { mockAgents } = await import('./mockData');
        return mockAgents;
      }
      throw err;
    }
  },

  // Transform agent_health data to Agent interface
  transformHealthToAgents(healthData: AgentHealthRecord[]): Agent[] {
    const agentMap = new Map<string, Agent>();

    healthData.forEach(health => {
      const agentName = health.agent;
      const status = this.mapHealthStatus(health.status);
      const details = isRecord(health.details) ? health.details : {};

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          id: `agent-${agentName.toLowerCase().replace(/\s+/g, '-')}`,
          name: agentName,
          type: this.inferAgentType(agentName),
          status,
          last_run: health.created_at,
          success_rate: this.calculateSuccessRate(details),
          avg_response_time: this.extractResponseTime(details),
          total_operations: this.extractOperationCount(details),
          configuration: details,
        });
      } else {
        // Update with latest health status
        const agent = agentMap.get(agentName)!;
        if (new Date(health.created_at) > new Date(agent.last_run)) {
          agent.status = status;
          agent.last_run = health.created_at;
          agent.configuration = { ...agent.configuration, ...details };
        }
      }
    });

    return Array.from(agentMap.values());
  },

  // Transform agent_metrics data to Agent interface
  transformMetricsToAgents(metricsData: AgentMetricsRecord[]): Agent[] {
    const agentMap = new Map<string, Agent>();

    metricsData.forEach(metric => {
      const agentName = metric.agent;
      const metrics = isRecord(metric.metrics) ? metric.metrics : {};

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          id: `agent-${agentName.toLowerCase().replace(/\s+/g, '-')}`,
          name: agentName,
          type: this.inferAgentType(agentName),
          status: this.inferStatusFromMetrics(metrics),
          last_run: metric.created_at,
          success_rate: typeof metrics.success_rate === 'number' ? metrics.success_rate : 0,
          avg_response_time:
            typeof metrics.avg_response_time === 'number' ? metrics.avg_response_time : 0,
          total_operations:
            typeof metrics.total_operations === 'number' ? metrics.total_operations : 0,
          configuration: metrics,
        });
      } else {
        // Update with latest metrics
        const agent = agentMap.get(agentName)!;
        if (new Date(metric.created_at) > new Date(agent.last_run)) {
          agent.last_run = metric.created_at;
          agent.success_rate =
            typeof metrics.success_rate === 'number' ? metrics.success_rate : agent.success_rate;
          agent.avg_response_time =
            typeof metrics.avg_response_time === 'number'
              ? metrics.avg_response_time
              : agent.avg_response_time;
          agent.total_operations =
            typeof metrics.total_operations === 'number'
              ? metrics.total_operations
              : agent.total_operations;
          agent.configuration = { ...agent.configuration, ...metrics };
        }
      }
    });

    return Array.from(agentMap.values());
  },

  // Helper methods for data transformation
  mapHealthStatus(healthStatus: string): Agent['status'] {
    switch (healthStatus?.toLowerCase()) {
      case 'healthy':
        return 'healthy';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'inactive';
    }
  },

  inferAgentType(agentName: string): string {
    const name = agentName.toLowerCase();
    if (name.includes('grading')) return 'Grading';
    if (name.includes('feed')) return 'Feed';
    if (name.includes('alert')) return 'Alert';
    if (name.includes('analytics')) return 'Analytics';
    if (name.includes('recap')) return 'Recap';
    if (name.includes('notification')) return 'Notification';
    if (name.includes('contest')) return 'Contest';
    if (name.includes('enrichment')) return 'Enrichment';
    if (name.includes('operator')) return 'Operator';
    if (name.includes('audit')) return 'Audit';
    return 'Agent';
  },

  calculateSuccessRate(details: Record<string, unknown>): number {
    if (!details) return 0;
    if (typeof details.success_rate === 'number') return details.success_rate;
    const successOps = details.successful_operations;
    const totalOps = details.total_operations;
    if (typeof successOps === 'number' && typeof totalOps === 'number' && totalOps > 0) {
      return (successOps / totalOps) * 100;
    }
    return 85; // Default success rate for healthy agents
  },

  extractResponseTime(details: Record<string, unknown>): number {
    if (!details) return 0;
    if (typeof details.avg_response_time === 'number') return details.avg_response_time;
    if (typeof details.response_time === 'number') return details.response_time;
    return 150; // Default response time in ms
  },

  extractOperationCount(details: Record<string, unknown>): number {
    if (!details) return 0;
    if (typeof details.total_operations === 'number') return details.total_operations;
    if (typeof details.operation_count === 'number') return details.operation_count;
    return 0;
  },

  inferStatusFromMetrics(metrics: Record<string, unknown>): Agent['status'] {
    if (!metrics) return 'inactive';

    const successRate = typeof metrics.success_rate === 'number' ? metrics.success_rate : 0;
    const errorRate = typeof metrics.error_rate === 'number' ? metrics.error_rate : 0;

    if (successRate >= 95 && errorRate < 1) return 'healthy';
    if (successRate >= 85 && errorRate < 5) return 'warning';
    if (successRate < 85 || errorRate >= 5) return 'error';
    return 'inactive';
  },

  async updateAgentStatus(id: string, status: Agent['status'], metadata?: Record<string, Json>) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    const { data, error } = await client
      .from('agents')
      .update({
        status,
        last_run: new Date().toISOString(),
        ...(metadata && { configuration: metadata }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Agent;
  },

  // Security Events
  async getSecurityEvents(limit = 50) {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock security events');
      const { mockSecurityEvents } = await import('./mockData');
      return mockSecurityEvents.slice(0, limit);
    }

    try {
      const { data, error } = await client
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Database query failed:', error.message);
        if (getDemoMode()) {
          console.log('[DEMO_MODE] Falling back to mock security events after error');
          const { mockSecurityEvents } = await import('./mockData');
          return mockSecurityEvents.slice(0, limit);
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} security events from database`);
      return data as unknown as SecurityEvent[];
    } catch (err) {
      console.error('Database connection failed:', err);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock security events after connection error');
        const { mockSecurityEvents } = await import('./mockData');
        return mockSecurityEvents.slice(0, limit);
      }
      throw err;
    }
  },

  async createSecurityEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>) {
    const client = getSupabaseClient();
    // FAIL-CLOSED: Write operations require Supabase (no DEMO_MODE fallback)
    if (!client) {
      throw new SupabaseConfigurationError();
    }

    const { data, error } = await client.from('security_events').insert(event).select().single();

    if (error) throw error;
    return data as unknown as SecurityEvent;
  },

  // Analytics - Connect to real Unit Talk production data
  async getAnalytics() {
    const client = getSupabaseClient();

    // DEMO_MODE: Explicit mock data usage
    if (!client) {
      if (!getDemoMode()) {
        throw new SupabaseConfigurationError();
      }
      console.log('[DEMO_MODE] Using mock analytics data');
      const { getMockAnalytics } = await import('./mockData');
      return getMockAnalytics();
    }

    try {
      // Get real agent health/metrics stats
      const { data: agentData } = await client
        .from('agent_health')
        .select('agent, status, created_at')
        .order('created_at', { ascending: false });

      // Get real unified picks stats with user context
      const { data: picksData } = await client
        .from('unified_picks')
        .select(
          `
          id,
          prediction,
          confidence,
          status,
          result,
          created_at,
          users!inner (
            username,
            tier
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(1000); // Get recent picks for analytics

      // Get raw props for market data
      const { data: propsData } = await client
        .from('raw_props')
        .select('id, stat_type, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      console.log('✅ Retrieved real analytics from production tables');

      return {
        users: [], // User analytics not available yet
        picks: picksData || [],
        agents: agentData || [],
        props: propsData || [],
        source: 'database',
      };
    } catch (err) {
      console.error('Database analytics query failed:', err);
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Falling back to mock analytics after error');
        const { getMockAnalytics } = await import('./mockData');
        return getMockAnalytics();
      }
      throw err;
    }
  },

  // Database status check
  async getDatabaseStatus() {
    try {
      const client = getSupabaseClient();

      if (!client) {
        // Only possible if DEMO_MODE is true
        return {
          connected: false,
          demoMode: true,
          error: null,
          usingMockData: true,
        };
      }

      const { error } = await client.from('users').select('count').limit(1);

      if (error) {
        return {
          connected: false,
          demoMode: false,
          error: error.message,
          usingMockData: getDemoMode(),
        };
      }

      return {
        connected: true,
        demoMode: false,
        error: null,
        usingMockData: false,
      };
    } catch (err) {
      // If DEMO_MODE is false, getSupabaseClient() throws - this is correct behavior
      if (err instanceof SupabaseConfigurationError) {
        throw err; // Re-throw fail-closed error
      }
      return {
        connected: false,
        demoMode: getDemoMode(),
        error: err instanceof Error ? err.message : 'Unknown error',
        usingMockData: getDemoMode(),
      };
    }
  },
};

// Realtime payload type for subscription callbacks
type RealtimePayload<T extends Record<string, unknown> = Record<string, unknown>> =
  RealtimePostgresChangesPayload<T>;

// Real-time subscriptions for Unit Talk production tables
export const subscriptions = {
  subscribeToAgentStatus(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('agent_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, callback)
      .subscribe();
  },

  subscribeToAgentHealth(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('agent_health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, callback)
      .subscribe();
  },

  subscribeToAgentMetrics(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('agent_metrics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_metrics' },
        callback
      )
      .subscribe();
  },

  subscribeToSecurityEvents(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('security_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        callback
      )
      .subscribe();
  },

  subscribeToNewPicks(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('unified_picks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unified_picks' },
        callback
      )
      .subscribe();
  },

  subscribeToPickUpdates(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('unified_picks_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'unified_picks' },
        callback
      )
      .subscribe();
  },

  subscribeToAgentLogs(callback: (payload: RealtimePayload) => void) {
    const client = getSupabaseClient();
    if (!client) {
      if (getDemoMode()) {
        console.log('[DEMO_MODE] Subscriptions disabled - no real-time updates');
        return null;
      }
      throw new SupabaseConfigurationError();
    }

    return client
      .channel('agent_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, callback)
      .subscribe();
  },
};
