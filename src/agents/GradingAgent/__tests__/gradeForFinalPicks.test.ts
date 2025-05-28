import { gradeAndPromoteFinalPicks } from '../gradeForFinalPicks';
import { supabase } from '../../../services/supabaseClient';
import { Pick, PickLeg } from '../types';
import { jest } from '@jest/globals';

// Mock Supabase client
jest.mock('../../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

// Mock logging
jest.mock('../../../services/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('gradeAndPromoteFinalPicks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSinglePick: Pick = {
    id: 'test-pick-1',
    player_name: 'Test Player',
    bet_type: 'single',
    is_parlay: false,
    is_teaser: false,
    is_rr: false,
    promoted_to_final: false,
    is_valid: true,
    created_at: new Date().toISOString()
  };

  const mockParlayPick: Pick = {
    id: 'test-pick-2',
    player_name: 'Test Player',
    bet_type: 'parlay',
    is_parlay: true,
    is_teaser: false,
    is_rr: false,
    legs: [
      {
        player_name: 'Player 1',
        line_value: 1.5,
        market_type: 'points',
        odds: -110
      },
      {
        player_name: 'Player 2',
        line_value: 2.5,
        market_type: 'assists',
        odds: -120
      }
    ] as PickLeg[],
    promoted_to_final: false,
    is_valid: true,
    created_at: new Date().toISOString()
  };

  test('should handle empty picks list', async () => {
    const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockSelect
        })
      })
    });

    await gradeAndPromoteFinalPicks();
    expect(mockSelect).toHaveBeenCalled();
  });

  test('should process single pick successfully', async () => {
    const mockSelect = jest.fn().mockResolvedValue({ 
      data: [mockSinglePick], 
      error: null 
    });
    
    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as jest.Mock).mockImplementation((table) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockSelect
        })
      }),
      insert: mockInsert,
      update: mockUpdate
    }));

    await gradeAndPromoteFinalPicks();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  test('should process parlay pick successfully', async () => {
    const mockSelect = jest.fn().mockResolvedValue({ 
      data: [mockParlayPick], 
      error: null 
    });
    
    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as jest.Mock).mockImplementation((table) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockSelect
        })
      }),
      insert: mockInsert,
      update: mockUpdate
    }));

    await gradeAndPromoteFinalPicks();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  test('should handle database errors gracefully', async () => {
    const mockSelect = jest.fn().mockResolvedValue({ 
      data: null, 
      error: new Error('Database connection failed') 
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockSelect
        })
      })
    });

    await expect(gradeAndPromoteFinalPicks()).rejects.toThrow('Database connection failed');
  });
}); 