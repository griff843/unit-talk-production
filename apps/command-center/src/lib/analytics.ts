// Analytics utilities for Command Center
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical UsersRow
export interface AnalyticsUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  tier: 'Free' | 'Premium' | 'VIP';
  status: 'active' | 'inactive' | 'banned';
  permissions: string[];
}

export interface DatabaseService {
  getUsers(): Promise<AnalyticsUser[]>;
  getUserById(id: string): Promise<AnalyticsUser>;
  updateUser(id: string, updates: Partial<AnalyticsUser>): Promise<AnalyticsUser>;
  deleteUser(id: string): Promise<void>;
  createUser(user: Omit<AnalyticsUser, 'id'>): Promise<AnalyticsUser>;
  getUsersByTier(tier: string): Promise<AnalyticsUser[]>;
  getUsersByStatus(status: string): Promise<AnalyticsUser[]>;
  getUsersByRole(role: string): Promise<AnalyticsUser[]>;
  searchUsers(query: string): Promise<AnalyticsUser[]>;
  getAnalytics(): Promise<AnalyticsData>;
  supabase: any; // Supabase client
}

export interface AnalyticsData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    vipUsers: number;
    premiumUsers: number;
    bannedUsers: number;
    totalPicks: number;
    pendingPicks: number;
    wonPicks: number;
    lostPicks: number;
    totalRevenue: number;
    monthlyRevenue: number;
    dailyRevenue: number;
    conversionRate: number;
    churnRate: number;
    avgWinRate: number;
    totalAlerts: number;
    pendingAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
    errorAlerts: number;
    systemHealth: number;
    criticalEvents: number;
  };
  users: {
    total: number;
    active: number;
    newUsers: number;
    byTier: {
      Free: number;
      Premium: number;
      VIP: number;
    };
    byStatus: {
      active: number;
      inactive: number;
      banned: number;
    };
    avgWinRate: number;
    topUsers: AnalyticsUser[];
  };
  agents: {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    avgSuccessRate: number;
    avgResponseTime: number;
    totalOperations: number;
    performanceDetails: any[];
  };
  picks: {
    total: number;
    pending: number;
    won: number;
    lost: number;
    push: number;
    avgROI: number;
    totalVolume: number;
    monthlyVolume: number;
    dailyVolume: number;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
    topPerformers: any[];
  };
  alerts: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    avgDeliveryTime: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    recentAlerts: any[];
  };
  system: {
    uptime: number;
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
    errors: number;
    warnings: number;
    health: number;
  };
  realtime: {
    activeConnections: number;
    messagesPerSecond: number;
    latency: number;
  };
}

// Mock database service for development
export const databaseService: DatabaseService = {
  getUsers: async () => [],
  getUserById: async (id: string) => ({
    id,
    name: 'Mock User',
    email: 'mock@example.com',
    role: 'viewer',
    tier: 'Free',
    status: 'active',
    permissions: [],
  }),
  updateUser: async (id: string, updates: Partial<AnalyticsUser>) => ({
    id,
    name: 'Mock User',
    email: 'mock@example.com',
    role: 'viewer',
    tier: 'Free',
    status: 'active',
    permissions: [],
    ...updates,
  }),
  deleteUser: async (id: string) => {},
  createUser: async (user: Omit<AnalyticsUser, 'id'>) => ({
    id: 'mock-id',
    ...user,
  }),
  getUsersByTier: async (tier: string) => [],
  getUsersByStatus: async (status: string) => [],
  getUsersByRole: async (role: string) => [],
  searchUsers: async (query: string) => [],
  getAnalytics: async () => ({
    overview: {
      totalUsers: 0,
      activeUsers: 0,
      vipUsers: 0,
      premiumUsers: 0,
      bannedUsers: 0,
      totalPicks: 0,
      pendingPicks: 0,
      wonPicks: 0,
      lostPicks: 0,
      totalRevenue: 0,
      monthlyRevenue: 0,
      dailyRevenue: 0,
      conversionRate: 0,
      churnRate: 0,
      avgWinRate: 0,
      totalAlerts: 0,
      pendingAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      errorAlerts: 0,
      systemHealth: 100,
      criticalEvents: 0,
    },
    users: {
      total: 0,
      active: 0,
      newUsers: 0,
      byTier: { Free: 0, Premium: 0, VIP: 0 },
      byStatus: { active: 0, inactive: 0, banned: 0 },
      avgWinRate: 0,
      topUsers: [],
    },
    agents: {
      total: 0,
      healthy: 0,
      warning: 0,
      error: 0,
      avgSuccessRate: 0,
      avgResponseTime: 0,
      totalOperations: 0,
      performanceDetails: [],
    },
    picks: {
      total: 0,
      pending: 0,
      won: 0,
      lost: 0,
      push: 0,
      avgROI: 0,
      totalVolume: 0,
      monthlyVolume: 0,
      dailyVolume: 0,
      byTier: {},
      byStatus: {},
      topPerformers: [],
    },
    alerts: {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      avgDeliveryTime: 0,
      byType: {},
      byChannel: {},
      recentAlerts: [],
    },
    system: {
      uptime: 0,
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { in: 0, out: 0 },
      errors: 0,
      warnings: 0,
      health: 100,
    },
    realtime: {
      activeConnections: 0,
      messagesPerSecond: 0,
      latency: 0,
    },
  }),
  supabase: null,
};

export async function getAnalyticsData(): Promise<AnalyticsData> {
  return databaseService.getAnalytics();
}

export function getCurrentUserId(): string {
  return 'mock-user-id';
}

export async function getClientIP(): Promise<string> {
  return '127.0.0.1';
}
