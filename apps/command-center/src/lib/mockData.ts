/**
 * Comprehensive Mock Data System for Unit Talk Command Center
 * Provides realistic, live-updating data that simulates real database functionality
 */

import { User, Agent, SecurityEvent } from './supabase'

// Generate realistic timestamps
const now = new Date()
const _oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

// Mock Users Data
export const mockUsers: User[] = [
  {
    id: '1',
    discord_id: '123456789012345678',
    username: 'ProCapper23',
    tier: 'VIP',
    status: 'active',
    created_at: oneWeekAgo.toISOString(),
    updated_at: now.toISOString(),
    last_active: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    total_picks: 247,
    win_rate: 74.5,
    revenue: 2847.50
  },
  {
    id: '2',
    discord_id: '234567890123456789',
    username: 'BetMaster99',
    tier: 'Premium',
    status: 'active',
    created_at: oneWeekAgo.toISOString(),
    updated_at: now.toISOString(),
    last_active: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    total_picks: 189,
    win_rate: 58.9,
    revenue: 1234.75
  },
  {
    id: '3',
    discord_id: '345678901234567890',
    username: 'LuckyStreak',
    tier: 'Free',
    status: 'inactive',
    created_at: oneWeekAgo.toISOString(),
    updated_at: oneDayAgo.toISOString(),
    last_active: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    total_picks: 89,
    win_rate: 45.2,
    revenue: 0
  },
  {
    id: '4',
    discord_id: '456789012345678901',
    username: 'GoldenPicks',
    tier: 'VIP',
    status: 'banned',
    created_at: oneWeekAgo.toISOString(),
    updated_at: oneDayAgo.toISOString(),
    last_active: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    total_picks: 1205,
    win_rate: 72.1,
    revenue: 4521.30
  },
  {
    id: '5',
    discord_id: '567890123456789012',
    username: 'SharpBettor',
    tier: 'Premium',
    status: 'active',
    created_at: oneWeekAgo.toISOString(),
    updated_at: now.toISOString(),
    last_active: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    total_picks: 156,
    win_rate: 69.1,
    revenue: 1876.90
  }
]

// Mock Agents Data with dynamic status updates
export const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'AlertAgent',
    type: 'notification',
    status: 'healthy',
    last_run: new Date(now.getTime() - 30 * 1000).toISOString(), // 30 seconds ago
    success_rate: 98.5,
    avg_response_time: 45,
    total_operations: 15420,
    configuration: {
      enabled: true,
      interval: '30s',
      channels: ['discord', 'email'],
      priority_levels: ['high', 'critical']
    }
  },
  {
    id: '2',
    name: 'GradingAgent',
    type: 'picks',
    status: 'healthy',
    last_run: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    success_rate: 97.2,
    avg_response_time: 125,
    total_operations: 8934,
    configuration: {
      enabled: true,
      auto_grade: true,
      confidence_threshold: 0.85,
      sources: ['odds_api', 'sportsbook_feeds']
    }
  },
  {
    id: '3',
    name: 'RecapAgent',
    type: 'content',
    status: 'warning',
    last_run: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    success_rate: 89.1,
    avg_response_time: 340,
    total_operations: 2847,
    configuration: {
      enabled: true,
      schedule: 'daily',
      formats: ['summary', 'detailed'],
      performance_threshold: 200
    }
  },
  {
    id: '4',
    name: 'FeedAgent',
    type: 'content',
    status: 'healthy',
    last_run: new Date(now.getTime() - 1 * 60 * 1000).toISOString(), // 1 minute ago
    success_rate: 99.1,
    avg_response_time: 67,
    total_operations: 45782,
    configuration: {
      enabled: true,
      refresh_rate: '5m',
      sources: ['twitter', 'reddit', 'discord'],
      filters: ['high_engagement']
    }
  },
  {
    id: '5',
    name: 'NotificationAgent',
    type: 'notification',
    status: 'healthy',
    last_run: new Date(now.getTime() - 45 * 1000).toISOString(), // 45 seconds ago
    success_rate: 96.8,
    avg_response_time: 89,
    total_operations: 12045,
    configuration: {
      enabled: true,
      delivery_methods: ['discord', 'push', 'email'],
      retry_attempts: 3,
      rate_limit: 100
    }
  }
]

// Mock Security Events with recent timestamps
export const mockSecurityEvents: SecurityEvent[] = [
  {
    id: '1',
    type: 'login_attempt',
    severity: 'high',
    description: 'Multiple failed login attempts detected from IP 192.168.1.100 (5 attempts in 2 minutes)',
    ip_address: '192.168.1.100',
    created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    metadata: {
      attempt_count: 5,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      geolocation: 'Unknown',
      blocked: true
    }
  },
  {
    id: '2',
    type: 'rate_limit',
    severity: 'medium',
    description: 'API rate limit exceeded for user ProCapper23 (150 requests in 1 minute, limit: 100)',
    ip_address: '10.0.0.45',
    user_id: '1',
    created_at: new Date(now.getTime() - 12 * 60 * 1000).toISOString(), // 12 minutes ago
    resolved_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    metadata: {
      request_count: 150,
      endpoint: '/api/picks',
      user_tier: 'VIP',
      action_taken: 'temporary_throttle'
    }
  },
  {
    id: '3',
    type: 'suspicious_activity',
    severity: 'medium',
    description: 'User BetMaster99 accessing from new geographic location (Nigeria)',
    ip_address: '41.203.72.15',
    user_id: '2',
    created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    metadata: {
      previous_location: 'United States',
      new_location: 'Nigeria',
      distance_km: 11200,
      confidence_score: 0.75,
      vpn_detected: false
    }
  },
  {
    id: '4',
    type: 'api_access',
    severity: 'low',
    description: 'Successful API access from new device for user SharpBettor',
    ip_address: '203.0.113.15',
    user_id: '5',
    created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    resolved_at: new Date(now.getTime() - 43 * 60 * 1000).toISOString(), // 43 minutes ago
    metadata: {
      device_type: 'Mobile',
      browser: 'Chrome Mobile',
      first_access: true,
      verification_sent: true
    }
  },
  {
    id: '5',
    type: 'login_attempt',
    severity: 'critical',
    description: 'Potential credential stuffing attack detected - 127 failed attempts across 15 accounts',
    ip_address: '185.220.101.47',
    created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    resolved_at: new Date(now.getTime() - 90 * 60 * 1000).toISOString(), // 90 minutes ago
    metadata: {
      attack_type: 'credential_stuffing',
      accounts_targeted: 15,
      attempts_per_account: 8.47,
      ip_reputation: 'malicious',
      blocked_permanently: true
    }
  }
]

// Mock Recent Picks Data
export const mockRecentPicks = [
  {
    id: '1',
    user: mockUsers[0],
    sport: 'NFL',
    event: 'Chiefs vs Bills',
    selection: 'Under 47.5',
    odds: -110,
    confidence: 8,
    created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: '2',
    user: mockUsers[1],
    sport: 'NBA',
    event: 'Lakers vs Warriors',
    selection: 'Lakers +4.5',
    odds: -105,
    confidence: 7,
    created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: '3',
    user: mockUsers[4],
    sport: 'MLB',
    event: 'Dodgers vs Padres',
    selection: 'Over 8.5',
    odds: -115,
    confidence: 9,
    created_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    status: 'won'
  }
]

// Dynamic Analytics Calculator
export function getMockAnalytics() {
  const totalUsers = mockUsers.length
  const activeUsers = mockUsers.filter(u => u.status === 'active').length
  const vipUsers = mockUsers.filter(u => u.tier === 'VIP').length
  const premiumUsers = mockUsers.filter(u => u.tier === 'Premium').length
  const bannedUsers = mockUsers.filter(u => u.status === 'banned').length
  
  const totalPicks = mockUsers.reduce((sum, user) => sum + user.total_picks, 0)
  const totalRevenue = mockUsers.reduce((sum, user) => sum + user.revenue, 0)
  
  const healthyAgents = mockAgents.filter(a => a.status === 'healthy').length
  const warningAgents = mockAgents.filter(a => a.status === 'warning').length
  const errorAgents = mockAgents.filter(a => a.status === 'error').length
  
  const openSecurityEvents = mockSecurityEvents.filter(e => !e.resolved_at).length
  const criticalEvents = mockSecurityEvents.filter(e => e.severity === 'critical' && !e.resolved_at).length
  
  return {
    overview: {
      totalUsers,
      activeUsers,
      vipUsers,
      premiumUsers,
      bannedUsers,
      totalPicks,
      pendingPicks: Math.floor(totalPicks * 0.15), // Assume 15% are pending
      wonPicks: Math.floor(totalPicks * 0.65), // Assume 65% win rate
      lostPicks: Math.floor(totalPicks * 0.35), // Assume 35% loss rate
      totalRevenue,
      healthyAgents,
      warningAgents,
      errorAgents,
      openSecurityEvents,
      criticalEvents
    },
    usersByTier: {
      Free: mockUsers.filter(u => u.tier === 'Free').length,
      Premium: premiumUsers,
      VIP: vipUsers
    },
    usersByStatus: {
      active: activeUsers,
      inactive: mockUsers.filter(u => u.status === 'inactive').length,
      banned: bannedUsers
    },
    agentsByStatus: {
      healthy: healthyAgents,
      warning: warningAgents,
      error: errorAgents,
      inactive: mockAgents.filter(a => a.status === 'inactive').length
    }
  }
}

// Simulate real-time updates
export function simulateAgentStatusUpdate(agentId: string) {
  const agent = mockAgents.find(a => a.id === agentId)
  if (agent) {
    agent.last_run = new Date().toISOString()
    agent.total_operations += Math.floor(Math.random() * 10) + 1
    
    // Occasionally change status
    if (Math.random() < 0.1) { // 10% chance
      const statuses: Agent['status'][] = ['healthy', 'warning', 'healthy', 'healthy'] // Bias toward healthy
      const statusIndex = Math.floor(Math.random() * statuses.length);
      if (statuses[statusIndex]) {
        agent.status = statuses[statusIndex];
      }
    }
  }
}

// Simulate new security events
export function simulateNewSecurityEvent(): SecurityEvent {
  const eventTypes = ['login_attempt', 'rate_limit', 'api_access', 'suspicious_activity']
  const severities: SecurityEvent['severity'][] = ['low', 'medium', 'high']
  const ips = ['192.168.1.100', '10.0.0.45', '203.0.113.15', '185.220.101.47']
  
  const eventTypeIndex = Math.floor(Math.random() * eventTypes.length);
  const severityIndex = Math.floor(Math.random() * severities.length);
  const ipIndex = Math.floor(Math.random() * ips.length);
  
  const event: SecurityEvent = {
    id: Math.random().toString(36).substr(2, 9),
    type: eventTypes[eventTypeIndex] as any,
    severity: severities[severityIndex] ?? 'low',
    description: `Simulated security event: ${eventTypes[eventTypeIndex] ?? 'unknown'} detected`,
    ip_address: ips[ipIndex] ?? '127.0.0.1',
    created_at: new Date().toISOString(),
    metadata: {
      simulated: true,
      confidence: Math.random()
    }
  };

  // Conditionally add optional fields
  if (Math.random() > 0.5) {
    const userIndex = Math.floor(Math.random() * mockUsers.length);
    if (mockUsers[userIndex]) {
      event.user_id = mockUsers[userIndex].id;
    }
  }

  return event;
}

// Live data simulation intervals (can be used in components)
export function startLiveDataSimulation() {
  // Update agent statuses every 30 seconds
  setInterval(() => {
    mockAgents.forEach(agent => {
      simulateAgentStatusUpdate(agent.id)
    })
  }, 30000)
  
  // Add random security events every 2 minutes
  setInterval(() => {
    if (Math.random() < 0.3) { // 30% chance every 2 minutes
      mockSecurityEvents.unshift(simulateNewSecurityEvent())
      // Keep only last 20 events
      if (mockSecurityEvents.length > 20) {
        mockSecurityEvents.splice(20)
      }
    }
  }, 120000)
}

// Export function to get all mock data
export function getAllMockData() {
  return {
    users: mockUsers,
    agents: mockAgents,
    securityEvents: mockSecurityEvents,
    recentPicks: mockRecentPicks,
    analytics: getMockAnalytics()
  }
}