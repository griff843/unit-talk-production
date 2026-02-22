/* eslint-disable max-lines */
/**
 * DISCORD CONTRACT v1.2 TESTS
 * Sprint: SPRINT-DISCORD-CONTRACT-BOOK-ENFORCEMENT-108B
 *
 * These tests verify the Discord Contract v1.2 enforcement:
 * - Validates all required hard fields (including provider_id)
 * - Returns blocked_contract for missing fields
 * - No implicit defaults allowed
 * - Terminal failure mode (no retry)
 */

import { describe, it, expect } from 'vitest';

import {
  assertDiscordContract,
  isPickPostable,
  DISCORD_CONTRACT_V1_2_HARD_FIELDS,
} from '../embedPresentationContract';

// ============================================================
// TEST CASES: assertDiscordContract
// ============================================================

describe('assertDiscordContract (SPRINT-108B)', () => {
  describe('Valid Picks - All Hard Fields Present', () => {
    it('should pass when all required fields are present', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'LeBron James Over 27.5 PTS',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(true);
      expect(result.code).toBe('ok');
      expect(result.missing_fields).toHaveLength(0);
      expect(result.message).toBe('Discord Contract v1.2 satisfied');
    });

    it('should accept id as fallback for pick_id', () => {
      const pick = {
        id: 'pick-123', // Using id instead of pick_id
        bet_slip_id: 'slip-456',
        user_id: 'user-789',
        stat_type: 'pts',
        selection: 'LeBron James Over 27.5 PTS',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(true);
      expect(result.code).toBe('ok');
    });

    it('should accept user_id as fallback for capper_id', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        user_id: 'user-789', // Using user_id instead of capper_id
        market_type: 'player_prop',
        selection: 'LeBron James Over 27.5 PTS',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { units: 2 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(true);
    });

    it('should accept confidence as fallback for unit_amount', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        bet_type: 'spread',
        selection: 'Lakers -3.5',
        odds: -110,
        tier: 'B',
        provider_id: 1,
        confidence: 3, // Using confidence instead of meta.unit_size
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(true);
    });
  });

  describe('Missing Required Fields - blocked_contract', () => {
    it('should block when provider_id is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'LeBron James Over 27.5 PTS',
        odds: -110,
        tier: 'A',
        // provider_id missing!
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('blocked_contract');
      expect(result.missing_fields).toContain('provider_id');
      expect(result.message).toContain('provider_id');
    });

    it('should block when provider_id is null', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'LeBron James Over 27.5 PTS',
        odds: -110,
        tier: 'A',
        provider_id: null, // Explicitly null
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('blocked_contract');
      expect(result.missing_fields).toContain('provider_id');
    });

    it('should block when pick_id is missing', () => {
      const pick = {
        // pick_id AND id both missing
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('pick_id');
    });

    it('should block when bet_slip_id is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        // bet_slip_id missing
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('bet_slip_id');
    });

    it('should block when capper_id/user_id is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        // Both capper_id and user_id missing
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('capper_id');
    });

    it('should block when selection is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        // selection missing
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('selection');
    });

    it('should block when odds is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        // odds missing
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('odds');
    });

    it('should block when tier is missing', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        // tier missing
        provider_id: 1,
        meta: { unit_size: 1 },
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('tier');
    });

    it('should report all missing fields at once', () => {
      const pick = {
        // All fields missing
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('blocked_contract');
      expect(result.missing_fields).toContain('pick_id');
      expect(result.missing_fields).toContain('bet_slip_id');
      expect(result.missing_fields).toContain('capper_id');
      expect(result.missing_fields).toContain('market_type');
      expect(result.missing_fields).toContain('selection');
      expect(result.missing_fields).toContain('odds');
      expect(result.missing_fields).toContain('unit_amount');
      expect(result.missing_fields).toContain('tier');
      expect(result.missing_fields).toContain('provider_id');
    });
  });

  describe('Unit Amount Resolution', () => {
    it('should accept meta.unit_size', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { unit_size: 2 },
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });

    it('should accept meta.units', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { units: 1.5 },
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });

    it('should accept meta.total_units', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        meta: { total_units: 3 },
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });

    it('should block when no unit amount source is present', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        // No meta.unit_size, meta.units, meta.total_units, or confidence
      };

      const result = assertDiscordContract(pick);

      expect(result.ok).toBe(false);
      expect(result.missing_fields).toContain('unit_amount');
    });
  });

  describe('Market Type Resolution', () => {
    it('should accept stat_type', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        stat_type: 'pts',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        confidence: 1,
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });

    it('should accept bet_type', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        bet_type: 'spread',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        confidence: 1,
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });

    it('should accept market_type', () => {
      const pick = {
        pick_id: 'pick-123',
        bet_slip_id: 'slip-456',
        capper_id: 'user-789',
        market_type: 'player_prop',
        selection: 'Test',
        odds: -110,
        tier: 'A',
        provider_id: 1,
        confidence: 1,
      };

      const result = assertDiscordContract(pick);
      expect(result.ok).toBe(true);
    });
  });
});

// ============================================================
// TEST CASES: isPickPostable
// ============================================================

describe('isPickPostable (SPRINT-108B)', () => {
  it('should return postable:true for valid pick', () => {
    const pick = {
      pick_id: 'pick-123',
      bet_slip_id: 'slip-456',
      capper_id: 'user-789',
      stat_type: 'pts',
      selection: 'Test',
      odds: -110,
      tier: 'A',
      provider_id: 1,
      confidence: 1,
      posted_to_discord: false,
      settlement_status: 'pending',
    };

    const result = isPickPostable(pick);

    expect(result.postable).toBe(true);
    expect(result.reason).toBe('Pick is postable');
  });

  it('should return postable:false if already posted', () => {
    const pick = {
      pick_id: 'pick-123',
      bet_slip_id: 'slip-456',
      capper_id: 'user-789',
      stat_type: 'pts',
      selection: 'Test',
      odds: -110,
      tier: 'A',
      provider_id: 1,
      confidence: 1,
      posted_to_discord: true, // Already posted
      settlement_status: 'pending',
    };

    const result = isPickPostable(pick);

    expect(result.postable).toBe(false);
    expect(result.reason).toBe('Already posted to Discord');
  });

  it('should return postable:false if settled', () => {
    const pick = {
      pick_id: 'pick-123',
      bet_slip_id: 'slip-456',
      capper_id: 'user-789',
      stat_type: 'pts',
      selection: 'Test',
      odds: -110,
      tier: 'A',
      provider_id: 1,
      confidence: 1,
      posted_to_discord: false,
      settlement_status: 'won', // Already settled
    };

    const result = isPickPostable(pick);

    expect(result.postable).toBe(false);
    expect(result.reason).toContain('Already settled');
  });

  it('should return postable:false if blocked_reason set', () => {
    const pick = {
      pick_id: 'pick-123',
      bet_slip_id: 'slip-456',
      capper_id: 'user-789',
      stat_type: 'pts',
      selection: 'Test',
      odds: -110,
      tier: 'A',
      provider_id: 1,
      confidence: 1,
      posted_to_discord: false,
      settlement_status: 'pending',
      blocked_reason: 'CONTRACT_V1_2: provider_id',
    };

    const result = isPickPostable(pick);

    expect(result.postable).toBe(false);
    expect(result.reason).toContain('Blocked');
  });

  it('should return postable:false if missing provider_id', () => {
    const pick = {
      pick_id: 'pick-123',
      bet_slip_id: 'slip-456',
      capper_id: 'user-789',
      stat_type: 'pts',
      selection: 'Test',
      odds: -110,
      tier: 'A',
      // provider_id missing
      confidence: 1,
      posted_to_discord: false,
      settlement_status: 'pending',
    };

    const result = isPickPostable(pick);

    expect(result.postable).toBe(false);
    expect(result.reason).toContain('provider_id');
  });
});

// ============================================================
// TEST CASES: Hard Fields Constant
// ============================================================

describe('DISCORD_CONTRACT_V1_2_HARD_FIELDS constant', () => {
  it('should include all 9 required fields', () => {
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('pick_id');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('bet_slip_id');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('capper_id');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('market_type');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('selection');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('odds');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('unit_amount');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('tier');
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toContain('provider_id'); // SPRINT-108B
  });

  it('should have exactly 9 hard fields', () => {
    expect(DISCORD_CONTRACT_V1_2_HARD_FIELDS).toHaveLength(9);
  });
});
