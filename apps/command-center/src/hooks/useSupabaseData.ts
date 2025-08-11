import { useState, useEffect } from 'react';
import { dbOperations, subscriptions, User, Agent, SecurityEvent } from '@/lib/supabase';
import {
  mockUsers,
  mockAgents,
  mockSecurityEvents,
  getMockAnalytics,
  startLiveDataSimulation,
} from '@/lib/mockData';

// Custom hook for users data
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await dbOperations.getUsers();
      setUsers(data);
    } catch (err) {
      console.log('Supabase unavailable, using mock data for users');
      setUsers(mockUsers);
      setError(null); // Don't show error for mock data
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
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]); // Start empty for faster initial render
  const [loading, setLoading] = useState(true); // Show loading initially
  const [error, setError] = useState<Error | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    // Set mock data immediately for is_instant UI
    setAgents(mockAgents);
    setLoading(false);
    setUsingMockData(true);

    // Then try to fetch real data in background
    async function fetchAgents() {
      try {
        const data = await dbOperations.getAgents();
        setAgents(data);
        setUsingMockData(false);
      } catch (err) {
        console.log('Supabase unavailable, continuing with mock data for agents');
        // Keep mock data if real fetch fails
        setUsingMockData(true);
        setError(null);
      }
    }

    // Delay real data fetch to not block initial render
    const timeoutId = setTimeout(fetchAgents, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Separate effect for real-time subscriptions
  useEffect(() => {
    if (usingMockData) return;

    const subscription = subscriptions.subscribeToAgentStatus(payload => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      setAgents(prev => {
        switch (eventType) {
          case 'INSERT':
            return [...prev, newRecord];
          case 'UPDATE':
            return prev.map(agent => (agent.id === newRecord.id ? newRecord : agent));
          case 'DELETE':
            return prev.filter(agent => agent.id !== oldRecord.id);
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
  }, [usingMockData]);

  const updateAgentStatus = async (
    id: string,
    status: Agent['status'],
    metadata?: Record<string, any>
  ) => {
    try {
      if (usingMockData) {
        // Update mock data locally
        const updatedAgent = {
          ...mockAgents.find(a => a.id === id)!,
          status,
          last_run: new Date().toISOString(),
        };
        setAgents(prev => prev.map(agent => (agent.id === id ? updatedAgent : agent)));
        return updatedAgent;
      } else {
        const updatedAgent = await dbOperations.updateAgentStatus(id, status, metadata);
        setAgents(prev => prev.map(agent => (agent.id === id ? updatedAgent : agent)));
        return updatedAgent;
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { agents, loading, error, updateAgentStatus, usingMockData };
}

// Custom hook for security events with real-time updates
export function useSecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>(mockSecurityEvents); // Start with mock data immediately
  const [loading, setLoading] = useState(false); // Don't start in loading state
  const [error, setError] = useState<Error | null>(null);
  const [usingMockData, setUsingMockData] = useState(true); // Start with mock data flag

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const data = await dbOperations.getSecurityEvents();
        setEvents(data);
        setUsingMockData(false);
      } catch (err) {
        console.log('Supabase unavailable, continuing with mock data for security events');
        // Keep existing mock data, don't set it again
        setUsingMockData(true);
        setError(null); // Don't show error for mock data
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();

    // Subscribe to new security events only if not using mock data
    let subscription: any = null;
    if (!usingMockData) {
      subscription = subscriptions.subscribeToSecurityEvents(payload => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [payload.new, ...prev.slice(0, 49)]); // Keep last 50 events
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [usingMockData]);

  return { events, loading, error, usingMockData };
}

// Custom hook for dashboard analytics
export function useAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null); // Start empty for faster render
  const [loading, setLoading] = useState(true); // Show loading initially
  const [error, setError] = useState<Error | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchAnalytics = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await dbOperations.getAnalytics();

      // Process the data into dashboard metrics (handle both mock and real data)
      const analyticsData = data as any; // Type assertion for flexibility

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
      setUsingMockData(false);
    } catch (err) {
      console.log('Supabase unavailable, continuing with mock analytics data');
      // Keep existing mock data, don't set it again
      setUsingMockData(true);
      setError(null); // Don't show error for mock data
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    // Set mock data immediately for is_instant UI
    setAnalytics(getMockAnalytics());
    setLoading(false);
    setUsingMockData(true);

    // Then try to fetch real data in background
    const timeoutId = setTimeout(() => {
      fetchAnalytics(true); // Background fetch
    }, 150);

    // Refresh analytics every 5 minutes
    const interval = setInterval(() => fetchAnalytics(true), 5 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, []);

  return { analytics, loading, error, refetch: fetchAnalytics, usingMockData };
}

// Custom hook for picks data
export function usePicks(limit = 100) {
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function fetchPicks() {
      try {
        setLoading(true);
        const data = await dbOperations.getPicks(limit);
        setPicks(data);
        setUsingMockData(false);
      } catch (err) {
        console.log('Supabase unavailable, using mock data for picks');
        // Import mock picks data from mockData.ts
        const { mockRecentPicks } = await import('@/lib/mockData');
        setPicks(mockRecentPicks.slice(0, limit));
        setUsingMockData(true);
        setError(null); // Don't show error for mock data
      } finally {
        setLoading(false);
      }
    }

    fetchPicks();

    // Subscribe to new picks only if not using mock data
    let subscription: any = null;
    if (!usingMockData) {
      subscription = subscriptions.subscribeToNewPicks(payload => {
        if (payload.eventType === 'INSERT') {
          setPicks(prev => [payload.new, ...prev.slice(0, limit - 1)]);
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [limit, usingMockData]);

  return { picks, loading, error, usingMockData };
}
