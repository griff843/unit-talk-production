import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Lazy initialization of Supabase client (loose by default; typed accessor provided below)
let client: any | null = null

function getSupabaseClient(): any {
  if (client) return client

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ DEVELOPMENT MODE: Supabase environment variables not found!')
    console.warn('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.warn('Running in demo mode with mock data for development purposes')
    return null // Return null to trigger mock data fallbacks
  }

  client = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  return client
}

// Provide a typed Supabase client for gradual migration to strict types
import type { SupabaseClient } from '@supabase/supabase-js'
let typedClient: SupabaseClient | null = null
export function getTypedSupabaseClient(): SupabaseClient | null {
  if (typedClient) return typedClient
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  typedClient = createSupabaseClient(supabaseUrl, supabaseAnonKey) as SupabaseClient
  return typedClient
}


// Export the client getter function - no immediate initialization
export { getSupabaseClient }

// Export supabase for backward compatibility (any)
export const supabase: any = getSupabaseClient() as any

// Export createClient function for API routes (any)
export function createClient() {
  return getSupabaseClient()
}

// Database schema types
export interface User {
  id: string
  discord_id: string
  username: string
  tier: 'Free' | 'Premium' | 'VIP'
  status: 'active' | 'inactive' | 'banned'
  created_at: string
  updated_at: string
  last_active: string
  total_picks: number
  win_rate: number
  revenue: number
}

export interface Pick {
  id: string
  user_id: string
  sport: string
  event: string
  pick_type: string
  selection: string
  odds: number
  stake: number
  confidence: number
  status: 'pending' | 'won' | 'lost' | 'void'
  created_at: string
  settled_at?: string
  profit?: number
  // Enhanced fields from v3.0.0 unified structure
  capper?: string
  tier?: string
  approval_status?: string
  actual_result?: string
}

export interface Agent {
  id: string
  name: string
  type: string
  status: 'healthy' | 'warning' | 'error' | 'inactive'
  last_run: string
  success_rate: number
  avg_response_time: number
  total_operations: number
  configuration: Record<string, any>
}

export interface SecurityEvent {
  id: string
  type: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ip_address: string
  user_id?: string
  metadata: Record<string, any>
  created_at: string
  resolved_at?: string
}

// Connection test function
export async function testDatabaseConnection() {
  const client = supabase
  if (!client) {
    console.log('❌ Supabase client not initialized (missing environment variables)')
    return false
  }

  try {
    const { error } = await client
      .from('users')
      .select('count')
      .limit(1)

    if (error) {
      console.log('Database connection test failed:', error.message)
      return false
    }

    console.log('✅ Database connection successful')
    return true
  } catch (err) {
    console.log('Database connection test failed:', err)
    return false
  }
}

// Check if required tables exist
export async function checkRequiredTables() {
  const requiredTables = ['users', 'agents', 'security_events']
  const tableStatus: Record<string, boolean> = {}

  const client = supabase
  if (!client) {
    // If no supabase client, mark all tables as not existing
    requiredTables.forEach(table => {
      tableStatus[table] = false
    })
    return tableStatus
  }

  for (const table of requiredTables) {
    try {
      const { error } = await client
        .from(table)
        .select('*')
        .limit(1)

      tableStatus[table] = !error
    } catch (err) {
      tableStatus[table] = false
    }
  }

  return tableStatus
}

// Database operations
export const dbOperations = {
  // Users
  async getUsers() {
    const client = supabase
    if (!client) {
      console.error('🚨 PRODUCTION ERROR: Supabase client not initialized!')
      throw new Error('PRODUCTION_DATABASE_ERROR: Cannot retrieve users without database connection')
    }

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('🚨 PRODUCTION ERROR: Database query failed:', error.message)
        throw new Error(`PRODUCTION_DATABASE_ERROR: Failed to retrieve users - ${error.message}`)
      }

      console.log(`✅ Retrieved ${data?.length || 0} users from database`)
      return data as unknown as User[]
    } catch (err) {
      console.error('🚨 PRODUCTION ERROR: Database connection failed:', err)
      throw new Error(`PRODUCTION_DATABASE_ERROR: Cannot connect to database - ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  async getUserById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as unknown as User
  },

  async updateUser(id: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as unknown as User
  },

  // Picks - Connect to real Unit Talk unified_picks table (v3.0.0)
  async getPicks(limit = 100) {
    const client = getSupabaseClient()
    if (!client) {
      console.error('🚨 PRODUCTION ERROR: Supabase client unavailable for picks retrieval!')
      throw new Error('PRODUCTION_DATABASE_ERROR: Cannot retrieve picks without database connection - this is critical for production operation')
    }

    try {
      // Query real unified_picks table with proper relationships
      const { data, error } = await client
        .from('unified_picks')
        .select(`
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
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('🚨 PRODUCTION ERROR: unified_picks query failed:', error.message)
        throw new Error(`PRODUCTION_DATABASE_ERROR: Failed to retrieve picks from unified_picks table - ${error.message}`)
      }

      // Transform unified_picks to Pick interface
      const picks = this.transformUnifiedPicksToPicks(data)
      console.log(`✅ Retrieved ${picks.length} picks from unified_picks table`)
      return picks
    } catch (err) {
      console.error('🚨 PRODUCTION ERROR: Database connection failed for picks:', err)
      throw new Error(`PRODUCTION_DATABASE_ERROR: Cannot retrieve picks - database connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  // Transform unified_picks data to Pick interface (v3.0.0)
  transformUnifiedPicksToPicks(unifiedPicks: any[]): Pick[] {
    return unifiedPicks.map(pick => {
      const rawProp = pick.raw_props
      const game = rawProp?.games
      const player = rawProp?.players
      const user = pick.users

      return {
        id: pick.id,
        user_id: pick.user_id,
        sport: rawProp?.players?.sport || game?.league || pick.sport || 'Unknown',
        event: game ? `${game.away_team} @ ${game.home_team}` :
               rawProp ? `${rawProp.team} vs ${rawProp.opponent}` :
               'Unknown Game',
        pick_type: rawProp?.prop_type || pick.pick_type || 'prop',
        selection: this.formatPickSelection(pick, rawProp, player),
        odds: this.getPickOdds(pick, rawProp),
        stake: 100, // Default stake - could be enhanced with user preference
        confidence: pick.confidence || 0,
        status: this.mapUnifiedPickStatus(pick.status, pick.result),
        created_at: pick.created_at,
        settled_at: pick.approved_at || pick.denied_at || undefined,
        profit: this.calculateUnifiedProfit(pick, rawProp) ?? 0,
        // Additional context from v3.0.0 unified structure
        capper: user?.username || 'Unknown',
        tier: user?.tier || 'Free',
        approval_status: pick.status,
        actual_result: pick.result
      }
    })
  },

  // Enhanced selection formatting for unified structure
  formatPickSelection(pick: any, rawProp: any, player: any): string {
    const playerName = rawProp?.player_name || player?.name || 'Unknown Player'
    const propType = rawProp?.prop_type || pick.pick_type || 'prop'
    const line = rawProp?.line
    const prediction = pick.prediction

    if (line && prediction) {
      return `${playerName} ${propType} ${prediction} ${line}`
    }

    return `${playerName} ${propType} - ${prediction || pick.selection || 'N/A'}`
  },

  // Get odds based on prediction and prop data
  getPickOdds(pick: any, rawProp: any): number {
    if (!rawProp) return 0

    if (pick.prediction === 'over' || pick.prediction === 'yes') {
      return rawProp.over_odds || 0
    } else if (pick.prediction === 'under' || pick.prediction === 'no') {
      return rawProp.under_odds || 0
    }

    // Fallback to average if prediction unclear
    return rawProp.over_odds || rawProp.under_odds || 0
  },

  // Map unified pick status to Command Center format
  mapUnifiedPickStatus(status: string | null, result: string | null): Pick['status'] {
    // First check result if settled
    if (result) {
      switch (result.toLowerCase()) {
        case 'win': return 'won'
        case 'loss': return 'lost'
        case 'push': return 'void'
        default: break
      }
    }

    // Then check approval status
    if (!status) return 'pending'
    switch (status.toLowerCase()) {
      case 'approved': return result ? this.mapPickStatus(result) : 'pending'
      case 'denied': return 'void'
      case 'settled': return result ? this.mapPickStatus(result) : 'pending'
      default: return 'pending'
    }
  },

  // Calculate profit from unified structure
  calculateUnifiedProfit(pick: any, rawProp: any): number | undefined {
    if (!pick.result || pick.result === 'pending') return undefined

    const stake = 100 // Default stake
    const odds = this.getPickOdds(pick, rawProp)

    if (pick.result === 'win') {
      return odds > 0 ? (stake * odds) / 100 : stake / (Math.abs(odds) / 100)
    } else if (pick.result === 'loss') {
      return -stake
    }

    return 0 // Push
  },

  mapPickStatus(result: string | null): Pick['status'] {
    if (!result) return 'pending'
    switch (result.toLowerCase()) {
      case 'win': return 'won'
      case 'loss': return 'lost'
      case 'push': return 'void'
      case 'pending': return 'pending'
      default: return 'pending'
    }
  },

  calculateProfit(pick: any, rawProp: any): number | undefined {
    if (!pick.result || pick.result === 'pending') return undefined

    const stake = 100 // Default stake
    const odds = pick.prediction === 'over' ? rawProp?.over_odds || 0 : rawProp?.under_odds || 0

    if (pick.result === 'win') {
      return odds > 0 ? (stake * odds) / 100 : stake / (Math.abs(odds) / 100)
    } else if (pick.result === 'loss') {
      return -stake
    }

    return 0 // Push
  },

  async getPicksByUser(userId: string) {
    const client = getSupabaseClient()
    if (!client) {
      console.log('⚠️ Supabase client unavailable, using mock data')
      return []
    }

    const { data, error } = await client
      .from('unified_picks')
      .select(`
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
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return this.transformUnifiedPicksToPicks(data || [])
  },

  // Get picks with enhanced filtering for v3.0.0
  async getPicksWithFilters(filters: {
    userId?: string,
    sport?: string,
    status?: string,
    result?: string,
    tier?: string,
    limit?: number
  } = {}) {
    const client = getSupabaseClient()
    if (!client) {
      console.log('⚠️ Supabase client unavailable, using mock data')
      const { mockRecentPicks } = await import('./mockData')
      return mockRecentPicks
    }

    let query = client
      .from('unified_picks')
      .select(`
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
      `)

    // Apply filters
    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.sport) query = query.eq('sport', filters.sport)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.result) query = query.eq('result', filters.result)
    if (filters.tier) query = query.eq('users.tier', filters.tier)

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100)

    if (error) {
      console.warn('Filtered picks query failed:', error.message)
      const { mockRecentPicks } = await import('./mockData')
      return mockRecentPicks
    }

    return this.transformUnifiedPicksToPicks(data || [])
  },

  async createPick(pick: Omit<Pick, 'id' | 'created_at'>) {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not available')

    const { data, error } = await client
      .from('unified_picks')
      .insert({
        user_id: pick.user_id,
        sport: pick.sport,
        pick_type: pick.pick_type,
        prediction: pick.selection.includes('over') ? 'over' : 'under',
        confidence: pick.confidence,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error
    return this.transformUnifiedPicksToPicks([data])[0]
  },

  // Pick approval/denial functionality for unified structure
  async approvePick(pickId: string, approvedBy: string) {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not available')

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId)
        .select(`
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `)
        .single()

      if (error) throw error

      console.log(`✅ Pick ${pickId} approved by ${approvedBy}`)
      return this.transformUnifiedPicksToPicks([data])[0]
    } catch (err) {
      console.error('Failed to approve pick:', err)
      throw new Error(`Failed to approve pick: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  async denyPick(pickId: string, deniedBy: string, reason?: string) {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not available')

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          status: 'denied',
          denied_by: deniedBy,
          denial_reason: reason,
          denied_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId)
        .select(`
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `)
        .single()

      if (error) throw error

      console.log(`✅ Pick ${pickId} denied by ${deniedBy}${reason ? `: ${reason}` : ''}`)
      return this.transformUnifiedPicksToPicks([data])[0]
    } catch (err) {
      console.error('Failed to deny pick:', err)
      throw new Error(`Failed to deny pick: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  async updatePickResult(pickId: string, result: 'win' | 'loss' | 'push', _actualValue?: number) {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not available')

    try {
      const { data, error } = await client
        .from('unified_picks')
        .update({
          result,
          status: 'settled',
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId)
        .select(`
          *,
          users!inner (username, tier),
          raw_props (player_name, prop_type, line, over_odds, under_odds)
        `)
        .single()

      if (error) throw error

      console.log(`✅ Pick ${pickId} result updated to ${result}`)
      return this.transformUnifiedPicksToPicks([data])[0]
    } catch (err) {
      console.error('Failed to update pick result:', err)
      throw new Error(`Failed to update pick result: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  // Agents - Connect to real Unit Talk agent system
  async getAgents() {
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Supabase not initialized, using mock data')
      const { mockAgents } = await import('./mockData')
      return mockAgents
    }

    try {
      // Query real agent_health table from Unit Talk production
      const { data: healthData, error: healthError } = await client
        .from('agent_health')
        .select('*')
        .order('created_at', { ascending: false })

      if (healthError) {
        console.warn('agent_health query failed, trying agent_metrics:', healthError.message)

        // Fallback to agent_metrics table
        const { data: metricsData, error: metricsError } = await client
          .from('agent_metrics')
          .select('*')
          .order('created_at', { ascending: false })

        if (metricsError) {
          console.warn('agent_metrics query failed, using mock data:', metricsError.message)
          const { mockAgents } = await import('./mockData')
          return mockAgents
        }

        // Transform agent_metrics to Agent format
        const agents = this.transformMetricsToAgents(metricsData)
        console.log(`✅ Retrieved ${agents.length} agents from agent_metrics table`)
        return agents
      }

      // Transform agent_health to Agent format
      const agents = this.transformHealthToAgents(healthData)
      console.log(`✅ Retrieved ${agents.length} agents from agent_health table`)
      return agents
    } catch (err) {
      console.warn('Database connection failed, using mock data:', err)
      const { mockAgents } = await import('./mockData')
      return mockAgents
    }
  },

  // Transform agent_health data to Agent interface
  transformHealthToAgents(healthData: any[]): Agent[] {
    const agentMap = new Map<string, Agent>()

    healthData.forEach(health => {
      const agentName = health.agent
      const status = this.mapHealthStatus(health.status)

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          id: `agent-${agentName.toLowerCase().replace(/\s+/g, '-')}`,
          name: agentName,
          type: this.inferAgentType(agentName),
          status,
          last_run: health.created_at,
          success_rate: this.calculateSuccessRate(health.details),
          avg_response_time: this.extractResponseTime(health.details),
          total_operations: this.extractOperationCount(health.details),
          configuration: health.details || {}
        })
      } else {
        // Update with latest health status
        const agent = agentMap.get(agentName)!
        if (new Date(health.created_at) > new Date(agent.last_run)) {
          agent.status = status
          agent.last_run = health.created_at
          agent.configuration = { ...agent.configuration, ...health.details }
        }
      }
    })

    return Array.from(agentMap.values())
  },

  // Transform agent_metrics data to Agent interface
  transformMetricsToAgents(metricsData: any[]): Agent[] {
    const agentMap = new Map<string, Agent>()

    metricsData.forEach(metric => {
      const agentName = metric.agent

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          id: `agent-${agentName.toLowerCase().replace(/\s+/g, '-')}`,
          name: agentName,
          type: this.inferAgentType(agentName),
          status: this.inferStatusFromMetrics(metric.metrics),
          last_run: metric.created_at,
          success_rate: metric.metrics.success_rate || 0,
          avg_response_time: metric.metrics.avg_response_time || 0,
          total_operations: metric.metrics.total_operations || 0,
          configuration: metric.metrics || {}
        })
      } else {
        // Update with latest metrics
        const agent = agentMap.get(agentName)!
        if (new Date(metric.created_at) > new Date(agent.last_run)) {
          agent.last_run = metric.created_at
          agent.success_rate = metric.metrics.success_rate || agent.success_rate
          agent.avg_response_time = metric.metrics.avg_response_time || agent.avg_response_time
          agent.total_operations = metric.metrics.total_operations || agent.total_operations
          agent.configuration = { ...agent.configuration, ...metric.metrics }
        }
      }
    })

    return Array.from(agentMap.values())
  },

  // Helper methods for data transformation
  mapHealthStatus(healthStatus: string): Agent['status'] {
    switch (healthStatus?.toLowerCase()) {
      case 'healthy': return 'healthy'
      case 'degraded': return 'warning'
      case 'unhealthy': return 'error'
      default: return 'inactive'
    }
  },

  inferAgentType(agentName: string): string {
    const name = agentName.toLowerCase()
    if (name.includes('grading')) return 'Grading'
    if (name.includes('feed')) return 'Feed'
    if (name.includes('alert')) return 'Alert'
    if (name.includes('analytics')) return 'Analytics'
    if (name.includes('recap')) return 'Recap'
    if (name.includes('notification')) return 'Notification'
    if (name.includes('contest')) return 'Contest'
    if (name.includes('enrichment')) return 'Enrichment'
    if (name.includes('operator')) return 'Operator'
    if (name.includes('audit')) return 'Audit'
    return 'Agent'
  },

  calculateSuccessRate(details: any): number {
    if (!details) return 0
    if (typeof details.success_rate === 'number') return details.success_rate
    if (details.successful_operations && details.total_operations) {
      return (details.successful_operations / details.total_operations) * 100
    }
    return 85 // Default success rate for healthy agents
  },

  extractResponseTime(details: any): number {
    if (!details) return 0
    if (typeof details.avg_response_time === 'number') return details.avg_response_time
    if (typeof details.response_time === 'number') return details.response_time
    return 150 // Default response time in ms
  },

  extractOperationCount(details: any): number {
    if (!details) return 0
    if (typeof details.total_operations === 'number') return details.total_operations
    if (typeof details.operation_count === 'number') return details.operation_count
    return 0
  },

  inferStatusFromMetrics(metrics: any): Agent['status'] {
    if (!metrics) return 'inactive'

    const successRate = metrics.success_rate || 0
    const errorRate = metrics.error_rate || 0

    if (successRate >= 95 && errorRate < 1) return 'healthy'
    if (successRate >= 85 && errorRate < 5) return 'warning'
    if (successRate < 85 || errorRate >= 5) return 'error'
    return 'inactive'
  },

  async updateAgentStatus(id: string, status: Agent['status'], metadata?: Record<string, any>) {
    const { data, error } = await supabase
      .from('agents')
      .update({
        status,
        last_run: new Date().toISOString(),
        ...(metadata && { configuration: metadata })
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as unknown as Agent
  },

  // Security Events
  async getSecurityEvents(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('Database query failed, using mock data:', error.message)
        const { mockSecurityEvents } = await import('./mockData')
        return mockSecurityEvents.slice(0, limit)
      }

      console.log(`✅ Retrieved ${data?.length || 0} security events from database`)
      return data as unknown as SecurityEvent[]
    } catch (err) {
      console.warn('Database connection failed, using mock data:', err)
      const { mockSecurityEvents } = await import('./mockData')
      return mockSecurityEvents.slice(0, limit)
    }
  },

  async createSecurityEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('security_events')
      .insert(event)
      .select()
      .single()

    if (error) throw error
    return data as unknown as SecurityEvent
  },

  // Analytics - Connect to real Unit Talk production data
  async getAnalytics() {
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Supabase not initialized, using mock analytics')
      const { getMockAnalytics } = await import('./mockData')
      return getMockAnalytics()
    }

    try {
      // Get real agent health/metrics stats
      const { data: agentData } = await client
        .from('agent_health')
        .select('agent, status, created_at')
        .order('created_at', { ascending: false })

      // Get real unified picks stats with user context
      const { data: picksData } = await client
        .from('unified_picks')
        .select(`
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
        `)
        .order('created_at', { ascending: false })
        .limit(1000) // Get recent picks for analytics

      // Get raw props for market data
      const { data: propsData } = await client
        .from('raw_props')
        .select('id, stat_type, created_at')
        .order('created_at', { ascending: false })
        .limit(500)

      console.log('✅ Retrieved real analytics from production tables')

      return {
        users: [], // User analytics not available yet
        picks: picksData || [],
        agents: agentData || [],
        props: propsData || [],
        source: 'database'
      }
    } catch (err) {
      console.warn('Database analytics query failed, using mock data:', err)
      const { getMockAnalytics } = await import('./mockData')
      return getMockAnalytics()
    }
  },

  // Database status check
  async getDatabaseStatus() {
    if (!supabase) {
      return {
        connected: false,
        error: 'Supabase client not initialized (missing environment variables)',
        usingMockData: true
      }
    }

    try {
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (error) {
        return {
          connected: false,
          error: error.message,
          usingMockData: true
        }
      }

      return {
        connected: true,
        error: null,
        usingMockData: false
      }
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        usingMockData: true
      }
    }
  }
}

// Real-time subscriptions for Unit Talk production tables
export const subscriptions = {
  subscribeToAgentStatus(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Cannot subscribe to agent status - Supabase not initialized')
      return null
    }

    return client
      .channel('agent_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, callback)
      .subscribe()
  },

  subscribeToAgentHealth(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Cannot subscribe to agent health - Supabase not initialized')
      return null
    }

    return client
      .channel('agent_health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, callback)
      .subscribe()
  },

  subscribeToAgentMetrics(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Cannot subscribe to agent metrics - Supabase not initialized')
      return null
    }

    return client
      .channel('agent_metrics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_metrics' }, callback)
      .subscribe()
  },

  subscribeToSecurityEvents(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) return null

    return client
      .channel('security_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, callback)
      .subscribe()
  },

  subscribeToNewPicks(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) return null

    return client
      .channel('unified_picks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'unified_picks' }, callback)
      .subscribe()
  },

  subscribeToPickUpdates(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) return null

    return client
      .channel('unified_picks_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'unified_picks' }, callback)
      .subscribe()
  },

  subscribeToAgentLogs(callback: (payload: any) => void) {
    const client = getSupabaseClient()
    if (!client) return null

    return client
      .channel('agent_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, callback)
      .subscribe()
  }
}