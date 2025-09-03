import { Database } from '../../src/db/types/supabase';

// User types
type User = Database['public']['Tables']['users']['Row'];
type Capper = Database['public']['Tables']['cappers']['Row'];
type Pick = Database['public']['Tables']['daily_picks']['Row'];

// Mock user data
export const mockUsers: User[] = [
  {
    id: 'user-1',
    discord_id: 'discord-123',
    discord_username: 'TestUser1',
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-01').toISOString(),
    tier: 'vip',
    status: 'active'
  },
  {
    id: 'user-2',
    discord_id: 'discord-456',
    discord_username: 'TestUser2',
    created_at: new Date('2025-01-02').toISOString(),
    updated_at: new Date('2025-01-02').toISOString(),
    tier: 'vip_plus',
    status: 'active'
  }
];

// Mock capper data
export const mockCappers: Capper[] = [
  {
    id: 'capper-1',
    discord_id: 'discord-123',
    discord_username: 'TestUser1',
    display_name: 'The Analyst',
    tier: 'pro',
    specialties: ['NBA', 'MLB'],
    bio: 'Professional sports analyst',
    experience_years: 5,
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-01').toISOString(),
    status: 'active'
  },
  {
    id: 'capper-2',
    discord_id: 'discord-456',
    discord_username: 'TestUser2',
    display_name: 'Stats Master',
    tier: 'elite',
    specialties: ['NFL', 'NBA'],
    bio: 'Statistical analysis expert',
    experience_years: 8,
    created_at: new Date('2025-01-02').toISOString(),
    updated_at: new Date('2025-01-02').toISOString(),
    status: 'active'
  }
];

// Mock pick data
export const mockPicks: Pick[] = [
  {
    id: 'pick-1',
    capper_id: 'capper-1',
    capper_discord_id: 'discord-123',
    capper_username: 'TestUser1',
    event_date: new Date('2025-07-20').toISOString().split('T')[0],
    status: 'pending',
    pick_type: 'single',
    total_legs: 1,
    total_odds: -110,
    total_units: 2,
    legs: [{
      game: 'Lakers vs Warriors',
      bet_type: 'Spread',
      selection: 'Lakers -5.5',
      odds: -110
    }],
    created_at: new Date('2025-07-20T10:00:00Z').toISOString(),
    updated_at: new Date('2025-07-20T10:00:00Z').toISOString(),
    metadata: {
      submitted_at: new Date('2025-07-20T10:00:00Z').toISOString(),
      submitted_by: 'discord-123'
    }
  },
  {
    id: 'pick-2',
    capper_id: 'capper-1',
    capper_discord_id: 'discord-123',
    capper_username: 'TestUser1',
    event_date: new Date('2025-07-20').toISOString().split('T')[0],
    status: 'pending',
    pick_type: 'parlay',
    total_legs: 2,
    total_odds: 250,
    total_units: 1,
    legs: [
      {
        game: 'Warriors vs Lakers',
        bet_type: 'Moneyline',
        selection: 'Warriors ML',
        odds: 150
      },
      {
        game: 'Celtics vs Heat',
        bet_type: 'Total',
        selection: 'Over 220.5',
        odds: 100
      }
    ],
    created_at: new Date('2025-07-20T11:00:00Z').toISOString(),
    updated_at: new Date('2025-07-20T11:00:00Z').toISOString(),
    metadata: {
      submitted_at: new Date('2025-07-20T11:00:00Z').toISOString(),
      submitted_by: 'discord-123'
    }
  }
];

// Mock capper stats
export const mockCapperStats = {
  capper_1: {
    total_picks: 100,
    win_rate: 0.65,
    wins: 65,
    losses: 30,
    pushes: 5,
    roi: 0.15,
    profit_loss: 25.5,
    current_streak: 3
  },
  capper_2: {
    total_picks: 200,
    win_rate: 0.70,
    wins: 140,
    losses: 50,
    pushes: 10,
    roi: 0.20,
    profit_loss: 50.5,
    current_streak: 5
  }
};

// Helper function to get today's date in YYYY-MM-DD format
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper function to create a new pick object
export function createMockPick(overrides: Partial<Pick> = {}): Pick {
  const defaultPick: Pick = {
    id: `pick-${Date.now()}`,
    capper_id: 'capper-1',
    capper_discord_id: 'discord-123',
    capper_username: 'TestUser1',
    event_date: getTodayString(),
    status: 'pending',
    pick_type: 'single',
    total_legs: 1,
    total_odds: -110,
    total_units: 2,
    legs: [{
      game: 'Lakers vs Warriors',
      bet_type: 'Spread',
      selection: 'Lakers -5.5',
      odds: -110
    }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      submitted_at: new Date().toISOString(),
      submitted_by: 'discord-123'
    }
  };

  return { ...defaultPick, ...overrides };
}

// Helper function to create a new capper object
export function createMockCapper(overrides: Partial<Capper> = {}): Capper {
  const defaultCapper: Capper = {
    id: `capper-${Date.now()}`,
    discord_id: `discord-${Date.now()}`,
    discord_username: `TestUser${Date.now()}`,
    display_name: 'New Capper',
    tier: 'rookie',
    specialties: [],
    bio: null,
    experience_years: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active'
  };

  return { ...defaultCapper, ...overrides };
}

// Helper function to create a new user object
export function createMockUser(overrides: Partial<User> = {}): User {
  const defaultUser: User = {
    id: `user-${Date.now()}`,
    discord_id: `discord-${Date.now()}`,
    discord_username: `TestUser${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tier: 'free',
    status: 'active'
  };

  return { ...defaultUser, ...overrides };
} 