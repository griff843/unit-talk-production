/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Unit Tests: Validation Module
 *
 * Tests for form validation logic.
 */

import {
  validateStep1,
  validateStep2,
  validateStep3,
  canProceedToNextStep,
  isValidOdds,
  isValidLine,
  parseOdds,
  parseLine,
  isValidProviderCode,
  PickState,
} from '../validation';

// SPRINT-108B: Updated emptyPick to include provider fields (Contract v1.2)
const emptyPick: PickState = {
  sport: '',
  betCategory: '',
  team: '',
  teamId: '',
  player: '',
  playerId: '',
  statType: '',
  line: '',
  direction: '',
  odds: '',
  gameId: '',
  gameLabel: '',
  source: 'api',
  providerId: '',
  providerName: '',
};

describe('validateStep1', () => {
  it('should require sport', () => {
    const errors = validateStep1(emptyPick);
    expect(errors.sport).toBe('Sport is required');
  });

  it('should require bet category', () => {
    const errors = validateStep1(emptyPick);
    expect(errors.betCategory).toBe('Bet type is required');
  });

  it('should pass with valid data', () => {
    const pick: PickState = { ...emptyPick, sport: 'NBA', betCategory: 'player_prop' };
    const errors = validateStep1(pick);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('validateStep2', () => {
  it('should require player for player_prop', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'player_prop' };
    const errors = validateStep2(pick);
    expect(errors.player).toBe('Player is required');
  });

  it('should require statType for player_prop', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'player_prop' };
    const errors = validateStep2(pick);
    expect(errors.statType).toBe('Stat type is required');
  });

  it('should require team for spread', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'spread' };
    const errors = validateStep2(pick);
    expect(errors.team).toBe('Team is required');
  });

  it('should require team for moneyline', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'moneyline' };
    const errors = validateStep2(pick);
    expect(errors.team).toBe('Team is required');
  });

  it('should not require participant for total', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'total' };
    const errors = validateStep2(pick);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should pass with valid player_prop data', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'player_prop',
      player: 'LeBron James',
      statType: 'PTS',
    };
    const errors = validateStep2(pick);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('validateStep3', () => {
  it('should require odds', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'moneyline' };
    const errors = validateStep3(pick);
    expect(errors.odds).toBe('Odds are required');
  });

  it('should require line for spread', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'spread', odds: '-110' };
    const errors = validateStep3(pick);
    expect(errors.line).toBe('Line is required');
  });

  it('should require direction for total', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'total', odds: '-110', line: '220.5' };
    const errors = validateStep3(pick);
    expect(errors.direction).toBe('Direction (Over/Under) is required');
  });

  it('should require direction for player_prop', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'player_prop',
      odds: '-110',
      line: '24.5',
    };
    const errors = validateStep3(pick);
    expect(errors.direction).toBe('Direction (Over/Under) is required');
  });

  // SPRINT-108B: Updated to include providerId per Contract v1.2
  it('should pass with valid moneyline data', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      providerId: 'fanduel',
    };
    const errors = validateStep3(pick);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  // SPRINT-108B: Updated to include providerId per Contract v1.2
  it('should pass with valid player_prop data', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'player_prop',
      odds: '-110',
      line: '24.5',
      direction: 'over',
      providerId: 'draftkings',
    };
    const errors = validateStep3(pick);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('canProceedToNextStep', () => {
  it('should allow step 1 proceed with sport and bet category', () => {
    const pick: PickState = { ...emptyPick, sport: 'NBA', betCategory: 'spread' };
    expect(canProceedToNextStep(1, pick, 0)).toBe(true);
  });

  it('should not allow step 1 proceed without sport', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'spread' };
    expect(canProceedToNextStep(1, pick, 0)).toBe(false);
  });

  it('should allow step 2 proceed for total without participant', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'total' };
    expect(canProceedToNextStep(2, pick, 0)).toBe(true);
  });

  it('should require team for step 2 spread', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'spread' };
    expect(canProceedToNextStep(2, pick, 0)).toBe(false);

    const pickWithTeam: PickState = { ...pick, team: 'Lakers' };
    expect(canProceedToNextStep(2, pickWithTeam, 0)).toBe(true);
  });

  it('should require player and statType for step 2 player_prop', () => {
    const pick: PickState = { ...emptyPick, betCategory: 'player_prop' };
    expect(canProceedToNextStep(2, pick, 0)).toBe(false);

    const pickWithPlayer: PickState = { ...pick, player: 'LeBron', statType: 'PTS' };
    expect(canProceedToNextStep(2, pickWithPlayer, 0)).toBe(true);
  });

  it('should require legs for step 4', () => {
    expect(canProceedToNextStep(4, emptyPick, 0)).toBe(false);
    expect(canProceedToNextStep(4, emptyPick, 1)).toBe(true);
  });
});

describe('isValidOdds', () => {
  it('should accept negative American odds', () => {
    expect(isValidOdds('-110')).toBe(true);
    expect(isValidOdds('-150')).toBe(true);
    expect(isValidOdds('-200')).toBe(true);
  });

  it('should accept positive American odds', () => {
    expect(isValidOdds('+100')).toBe(true);
    expect(isValidOdds('+150')).toBe(true);
    expect(isValidOdds('+500')).toBe(true);
  });

  it('should reject invalid odds', () => {
    expect(isValidOdds('')).toBe(false);
    expect(isValidOdds('abc')).toBe(false);
    expect(isValidOdds('+50')).toBe(false); // Too small
  });
});

describe('isValidLine', () => {
  it('should accept valid lines', () => {
    expect(isValidLine('24.5')).toBe(true);
    expect(isValidLine('-3.5')).toBe(true);
    expect(isValidLine('220')).toBe(true);
  });

  it('should reject invalid lines', () => {
    expect(isValidLine('')).toBe(false);
    expect(isValidLine('abc')).toBe(false);
  });
});

describe('parseOdds', () => {
  it('should parse American odds', () => {
    expect(parseOdds('-110')).toBe(-110);
    expect(parseOdds('+150')).toBe(150);
  });

  it('should handle invalid input', () => {
    expect(parseOdds('')).toBe(-110); // Default
    expect(parseOdds('abc')).toBe(-110);
  });
});

describe('parseLine', () => {
  it('should parse lines', () => {
    expect(parseLine('24.5')).toBe(24.5);
    expect(parseLine('-3.5')).toBe(-3.5);
  });

  it('should handle invalid input', () => {
    expect(parseLine('')).toBe(0);
    expect(parseLine('abc')).toBe(0);
  });
});

// ============================================================
// SPRINT-108B: Provider Validation Tests (Contract v1.2)
// ============================================================

describe('isValidProviderCode (SPRINT-108B)', () => {
  describe('Valid Provider Codes', () => {
    it('should accept lowercase provider codes', () => {
      expect(isValidProviderCode('fanduel')).toBe(true);
      expect(isValidProviderCode('draftkings')).toBe(true);
      expect(isValidProviderCode('betmgm')).toBe(true);
    });

    it('should accept provider codes with underscores', () => {
      expect(isValidProviderCode('espn_bet')).toBe(true);
      expect(isValidProviderCode('hard_rock')).toBe(true);
      expect(isValidProviderCode('bet365_us')).toBe(true);
    });

    it('should accept provider codes with numbers', () => {
      expect(isValidProviderCode('bet365')).toBe(true);
      expect(isValidProviderCode('bet99')).toBe(true);
    });

    it('should accept uppercase provider codes', () => {
      expect(isValidProviderCode('FANDUEL')).toBe(true);
      expect(isValidProviderCode('DRAFTKINGS')).toBe(true);
    });

    it('should accept mixed case provider codes', () => {
      expect(isValidProviderCode('FanDuel')).toBe(true);
      expect(isValidProviderCode('DraftKings')).toBe(true);
    });
  });

  describe('Invalid Provider Codes', () => {
    it('should reject empty string', () => {
      expect(isValidProviderCode('')).toBe(false);
    });

    it('should reject single character', () => {
      expect(isValidProviderCode('a')).toBe(false);
    });

    it('should reject codes with spaces', () => {
      expect(isValidProviderCode('fan duel')).toBe(false);
      expect(isValidProviderCode('draft kings')).toBe(false);
    });

    it('should reject codes with special characters', () => {
      expect(isValidProviderCode('fanduel!')).toBe(false);
      expect(isValidProviderCode('draft@kings')).toBe(false);
      expect(isValidProviderCode('bet-mgm')).toBe(false);
    });

    it('should reject codes that are too long', () => {
      const longCode = 'a'.repeat(51);
      expect(isValidProviderCode(longCode)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should accept minimum length (2 chars)', () => {
      expect(isValidProviderCode('ab')).toBe(true);
    });

    it('should accept maximum length (50 chars)', () => {
      const maxCode = 'a'.repeat(50);
      expect(isValidProviderCode(maxCode)).toBe(true);
    });
  });
});

describe('validateStep3 - Provider Validation (SPRINT-108B)', () => {
  it('should require provider for step 3', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      // providerId missing
    };
    const errors = validateStep3(pick);
    expect(errors.providerId).toBe('Provider is required');
  });

  it('should reject invalid provider code', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      providerId: 'a', // Too short
    };
    const errors = validateStep3(pick);
    expect(errors.providerId).toBe('Invalid provider selection');
  });

  it('should pass with valid provider', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      providerId: 'fanduel',
    };
    const errors = validateStep3(pick);
    expect(errors.providerId).toBeUndefined();
  });
});

describe('canProceedToNextStep - Provider Requirement (SPRINT-108B)', () => {
  it('should require provider for step 3', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      // providerId missing
    };
    expect(canProceedToNextStep(3, pick, 0)).toBe(false);
  });

  it('should allow step 3 proceed with valid provider', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      providerId: 'fanduel',
    };
    expect(canProceedToNextStep(3, pick, 0)).toBe(true);
  });

  it('should not allow step 3 proceed with invalid provider code', () => {
    const pick: PickState = {
      ...emptyPick,
      betCategory: 'moneyline',
      odds: '-110',
      providerId: 'x', // Invalid - too short
    };
    expect(canProceedToNextStep(3, pick, 0)).toBe(false);
  });
});
