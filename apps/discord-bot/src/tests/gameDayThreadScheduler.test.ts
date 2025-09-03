import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Use fake timers for scheduling tests
jest.useFakeTimers();

// Minimal mock Supabase chain
// Mock the ThreadService and config BEFORE importing the SUT
jest.mock('../services/threadService', () => {
  const createGameThreadMock = jest.fn().mockResolvedValue({ id: 'thread-123' });
  const postPickToThreadMock = jest.fn().mockResolvedValue(undefined);
  class ThreadService {
    createGameThread = createGameThreadMock;
    postPickToThread = postPickToThreadMock;
  }
  return { ThreadService, createGameThreadMock, postPickToThreadMock };
});

jest.mock('../config', () => ({ botConfig: { channels: { threads: 'test-threads-channel' } } }));

import { GameDayThreadScheduler, PickContextForScheduling } from '../services/gameDayThreadScheduler';
function makeSupabaseMock(commenceISO: string | null, extra: Partial<any> = {}) {
  const single = jest.fn().mockResolvedValue({ data: commenceISO ? {
    id: 'game-1',
    sport: 'nba',
    home_team: 'LAL',
    away_team: 'GSW',
    commence_time: commenceISO,
    ...extra,
  } : null, error: null });
  const eq = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq, single }));
  const from = jest.fn(() => ({ select, eq, single }));
  const update = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }));

  return {
    client: {
      from,
      select,
      eq,
      single,
      update,
    },
  } as any;
}

// Mock ThreadService class used inside scheduler's doCreate
jest.mock('../services/threadService', () => {
  const createGameThreadMock = jest.fn().mockResolvedValue({ id: 'thread-123' });
  const postPickToThreadMock = jest.fn().mockResolvedValue(undefined);
  class ThreadService {
    createGameThread = createGameThreadMock;
    postPickToThread = postPickToThreadMock;
  }
  return {
    ThreadService,
    createGameThreadMock,
    postPickToThreadMock,
  };
});

// Ensure botConfig has a threads channel id in test
jest.mock('../config', () => {
  return {
    botConfig: {
      channels: { threads: 'test-threads-channel' },
    },
  };
});


// Minimal Discord.js client mock (unused due to ThreadService mock, but required by ctor)
const clientMock: any = {
  channels: { fetch: jest.fn() },
};

const makePick = (overrides: Partial<PickContextForScheduling> = {}): PickContextForScheduling => ({
  id: 'pick-1',
  gameId: 'game-1',
  sport: 'nba',
  teams: 'GSW vs LAL',
  description: 'Steph over 28.5',
  confidence: 8,
  odds: -110,
  units: 1,
  tier: 'member',
  ...overrides,
});

describe('GameDayThreadScheduler', () => {
  const realNow = Date.now;
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // restore Date.now
    (Date.now as any) = realNow;
  });

  it('creates thread immediately when commence time is within 15 minutes', async () => {
    const baseNow = new Date('2025-01-01T12:00:00Z').getTime();
    (Date.now as any) = jest.fn(() => baseNow);

    const commenceISO = new Date(baseNow + 10 * 60 * 1000).toISOString(); // 10 minutes ahead
    const supabaseMock = makeSupabaseMock(commenceISO, { sport: 'nba' });

    const scheduler = new GameDayThreadScheduler(clientMock, supabaseMock);
    await scheduler.scheduleForPick(makePick());

    // Since within 15m, should not rely on timers
    // Advance timers just in case; no pending timers should be required
    jest.runOnlyPendingTimers();

    // Validate ThreadService methods were invoked via our mock
    const { createGameThreadMock, postPickToThreadMock } = jest.requireMock('../services/threadService');
    expect(createGameThreadMock).toHaveBeenCalledTimes(1);
    expect(postPickToThreadMock).toHaveBeenCalledTimes(1);
  });

  it('schedules thread creation 15 minutes before commence time (future >15m)', async () => {
    const baseNow = new Date('2025-01-01T12:00:00Z').getTime();
    (Date.now as any) = jest.fn(() => baseNow);

    // Commence in 45 minutes => schedule at 30 minutes from now
    const commenceISO = new Date(baseNow + 45 * 60 * 1000).toISOString();
    const supabaseMock = makeSupabaseMock(commenceISO, { sport: 'nba' });

    const scheduler = new GameDayThreadScheduler(clientMock, supabaseMock);
    const pick = makePick();
    const schedulePromise = scheduler.scheduleForPick(pick);

    // Nothing should happen immediately
    const { createGameThreadMock, postPickToThreadMock } = jest.requireMock('../services/threadService');
    expect(createGameThreadMock).toHaveBeenCalledTimes(0);

    // Fast-forward 30 minutes (45 - 15)
    jest.advanceTimersByTime(30 * 60 * 1000);
    // Flush pending timers and microtasks triggered by setTimeout
    // @ts-ignore
    if (jest.runOnlyPendingTimersAsync) {
      // @ts-ignore
      await jest.runOnlyPendingTimersAsync();
    } else {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    }

    expect(createGameThreadMock).toHaveBeenCalledTimes(1);
    expect(postPickToThreadMock).toHaveBeenCalledTimes(1);
  });

  it('handles missing gameId by creating an ad-hoc thread immediately', async () => {
    const baseNow = new Date('2025-01-01T12:00:00Z').getTime();
    (Date.now as any) = jest.fn(() => baseNow);

    const supabaseMock = makeSupabaseMock(null); // will skip DB lookup
    const scheduler = new GameDayThreadScheduler(clientMock, supabaseMock);
    await scheduler.scheduleForPick(makePick({ gameId: undefined }));

    const { createGameThreadMock, postPickToThreadMock } = jest.requireMock('../services/threadService');
    expect(createGameThreadMock).toHaveBeenCalledTimes(1);
    expect(postPickToThreadMock).toHaveBeenCalledTimes(1);
  });
});

