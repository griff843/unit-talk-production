import { useState, useEffect } from 'react';

// PHASE-0-FIX: Removed mock data imports - no silent fallbacks
import { dbOperations, subscriptions, User, Agent, SecurityEvent } from '@/lib/supabase';

// Custom hook for users data
// PHASE-0-FIX: No silent mock fallback - errors surface to UI
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbOperations.getUsers();
      setUsers(data);
    } catch (err) {
      // PHASE-0-FIX: Surface error explicitly - no mock fallback
      console.error('[CC] Failed to fetch users:', err);
      setError(err as Error);
      setUsers([]); // Empty state, not mock data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUser = async (id: string, updates: Partial<User>) => {
    try {
      const updatedUser = await dbOperations.updateUser(id, updates);
      setUsers(prev => prev.map(user => (user.id === id ? updatedUser : user)));
      return updatedUser;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { users, loading, error, updateUser, refetch: fetchUsers };
}

// Custom hook for agents data with real-time updates
// PHASE-0-FIX: No silent mock fallback - errors surface to UI
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const data = await dbOperations.getAgents();
        setAgents(data);
      } catch (err) {
        // PHASE-0-FIX: Surface error explicitly - no mock fallback
        console.error('[CC] Failed to fetch agents:', err);
        setError(err as Error);
        setAgents([]); // Empty state, not mock data
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (agents.length === 0) return;

    const subscription = subscriptions.subscribeToAgentStatus(payload => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const typedNewRecord = newRecord as Agent;
      const typedOldRecord = oldRecord as Agent;

      setAgents(prev => {
        switch (eventType) {
          case 'INSERT':
            return [...prev, typedNewRecord];
          case 'UPDATE':
            return prev.map(agent => (agent.id === typedNewRecord.id ? typedNewRecord : agent));
          case 'DELETE':
            return prev.filter(agent => agent.id !== typedOldRecord.id);
          default:
            return prev;
        }
      });
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [agents.length]);

  const updateAgentStatus = async (
    id: string,
    status: Agent['status'],
    metadata?: Record<string, any>
  ) => {
    try {
      const updatedAgent = await dbOperations.updateAgentStatus(id, status, metadata);
      setAgents(prev => prev.map(agent => (agent.id === id ? updatedAgent : agent)));
      return updatedAgent;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { agents, loading, error, updateAgentStatus };
}

// Custom hook for security events with real-time updates
// PHASE-0-FIX: No silent mock fallback - errors surface to UI
export function useSecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);
        const data = await dbOperations.getSecurityEvents();
        setEvents(data);
      } catch (err) {
        // PHASE-0-FIX: Surface error explicitly - no mock fallback
        console.error('[CC] Failed to fetch security events:', err);
        setError(err as Error);
        setEvents([]); // Empty state, not mock data
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (events.length === 0) return;

    const subscription = subscriptions.subscribeToSecurityEvents(payload => {
      if (payload.eventType === 'INSERT') {
        const newEvent = payload.new as unknown as SecurityEvent;
        setEvents(prev => [newEvent, ...prev.slice(0, 49)]);
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [events.length]);

  return { events, loading, error };
}

// Custom hook for dashboard analytics
// PHASE-0-FIX: No silent mock fallback - errors surface to UI
export function useAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }
      const data = await dbOperations.getAnalytics();

      // Process the data into dashboard metrics
      const analyticsData = data as any;

      const usersByTier =
        analyticsData.users?.reduce(
          (acc: any, user: any) => {
            acc[user.tier] = (acc[user.tier] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) ||
        analyticsData.usersByTier ||
        {};

      const usersByStatus =
        analyticsData.users?.reduce(
          (acc: any, user: any) => {
            acc[user.status] = (acc[user.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) ||
        analyticsData.usersByStatus ||
        {};

      const picksByStatus =
        analyticsData.picks?.reduce(
          (acc: any, pick: any) => {
            acc[pick.status] = (acc[pick.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      const totalRevenue =
        analyticsData.picks
          ?.filter((pick: any) => pick.profit && pick.profit > 0)
          ?.reduce((sum: number, pick: any) => sum + (pick.profit || 0), 0) ||
        analyticsData.overview?.totalRevenue ||
        0;

      const agentsByStatus =
        analyticsData.agents?.reduce(
          (acc: any, agent: any) => {
            acc[agent.status] = (acc[agent.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) ||
        analyticsData.agentsByStatus ||
        {};

      const processedAnalytics = {
        overview: {
          totalUsers: analyticsData.users?.length || analyticsData.overview?.totalUsers || 0,
          activeUsers: usersByStatus.active || 0,
          vipUsers: usersByTier.VIP || 0,
          bannedUsers: usersByStatus.banned || 0,
          totalPicks: analyticsData.picks?.length || analyticsData.overview?.totalPicks || 0,
          wonPicks: picksByStatus.won || 0,
          lostPicks: picksByStatus.lost || 0,
          pendingPicks: picksByStatus.pending || 0,
          totalRevenue,
          healthyAgents: agentsByStatus.healthy || 0,
          warningAgents: agentsByStatus.warning || 0,
          errorAgents: agentsByStatus.error || 0,
        },
        usersByTier,
        usersByStatus,
        picksByStatus,
        agentsByStatus,
      };

      setAnalytics(processedAnalytics);
    } catch (err) {
      // PHASE-0-FIX: Surface error explicitly - no mock fallback
      console.error('[CC] Failed to fetch analytics:', err);
      if (!isBackground) {
        setError(err as Error);
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Refresh analytics every 5 minutes
    const interval = setInterval(() => fetchAnalytics(true), 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return { analytics, loading, error, refetch: fetchAnalytics };
}

// Custom hook for picks data
// PHASE-0-FIX: No silent mock fallback - errors surface to UI
export function usePicks(limit = 100) {
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPicks() {
      try {
        setLoading(true);
        setError(null);
        const data = await dbOperations.getPicks(limit);
        setPicks(data);
      } catch (err) {
        // PHASE-0-FIX: Surface error explicitly - no mock fallback
        console.error('[CC] Failed to fetch picks:', err);
        setError(err as Error);
        setPicks([]); // Empty state, not mock data
      } finally {
        setLoading(false);
      }
    }

    fetchPicks();
  }, [limit]);

  // Real-time subscriptions
  useEffect(() => {
    if (picks.length === 0) return;

    const subscription = subscriptions.subscribeToNewPicks(payload => {
      if (payload.eventType === 'INSERT') {
        setPicks(prev => [payload.new, ...prev.slice(0, limit - 1)]);
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [picks.length, limit]);

  return { picks, loading, error };
}
