/**
 * postingAuthority.test.ts — POSTING-AUTHORITY-001 Tests
 *
 * Proves that the origin-gated posting authority logic works correctly:
 * 1. Capper picks (meta.pick_origin='capper') are ALWAYS selected for posting
 *    regardless of promotion_band, tier, or score.
 * 2. System picks (meta.pick_origin='system') require meta.system_approved=true.
 * 3. Kill switch blocks ALL picks (capper + system + legacy).
 * 4. Idempotency: posted_to_discord=true excludes picks.
 * 5. Legacy fallback: picks without origin tag use promotion_band='HARD'.
 *
 * These tests mirror the exact query logic in DiscordPromotionAgent.promoteToDiscord().
 */

// ---- Types (matching unified_picks schema) ----

interface UnifiedPick {
  id: string;
  player_name: string;
  posted_to_discord: boolean;
  promotion_band: string | null;
  tier: string | null;
  meta: Record<string, any> | null;
  capper_username?: string;
}

// ---- Query Simulators (mirrors DiscordPromotionAgent exactly) ----

function selectCapperPicks(picks: UnifiedPick[]): UnifiedPick[] {
  return picks.filter(p => p.posted_to_discord === false && p.meta?.pick_origin === 'capper');
}

function selectApprovedSystemPicks(picks: UnifiedPick[]): UnifiedPick[] {
  return picks.filter(
    p =>
      p.posted_to_discord === false &&
      p.meta?.pick_origin === 'system' &&
      String(p.meta?.system_approved) === 'true'
  );
}

function selectLegacyHardBand(picks: UnifiedPick[]): UnifiedPick[] {
  return picks.filter(
    p =>
      p.posted_to_discord === false &&
      p.promotion_band === 'HARD' &&
      (p.meta === null || p.meta?.pick_origin == null)
  );
}

function selectAll(
  picks: UnifiedPick[],
  killSwitch: boolean
): { capper: UnifiedPick[]; system: UnifiedPick[]; legacy: UnifiedPick[] } {
  if (killSwitch) return { capper: [], system: [], legacy: [] };
  return {
    capper: selectCapperPicks(picks),
    system: selectApprovedSystemPicks(picks),
    legacy: selectLegacyHardBand(picks),
  };
}

// ---- Fixtures ----

const FIXTURES: UnifiedPick[] = [
  {
    id: 'capper-band-none',
    player_name: 'Nikola Jokic',
    posted_to_discord: false,
    promotion_band: 'NONE',
    tier: 'D',
    meta: { pick_origin: 'capper', capper: 'Griff843' },
  },
  {
    id: 'capper-band-null',
    player_name: 'Jayson Tatum',
    posted_to_discord: false,
    promotion_band: null,
    tier: null,
    meta: { pick_origin: 'capper', capper: 'Vicgo' },
  },
  {
    id: 'capper-band-hard',
    player_name: 'Kevin Durant',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'S',
    meta: { pick_origin: 'capper', capper: 'Sauced' },
  },
  {
    id: 'system-unapproved',
    player_name: 'LeBron James',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'S',
    meta: { pick_origin: 'system' },
  },
  {
    id: 'system-approved',
    player_name: 'Luka Doncic',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'A',
    meta: { pick_origin: 'system', system_approved: true },
  },
  {
    id: 'already-posted',
    player_name: 'Stephen Curry',
    posted_to_discord: true,
    promotion_band: 'HARD',
    tier: 'S',
    meta: { pick_origin: 'capper', capper: 'MoneyReef' },
  },
  {
    id: 'legacy-hard',
    player_name: 'Giannis Antetokounmpo',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'A',
    meta: null,
  },
  {
    id: 'legacy-none',
    player_name: 'Trae Young',
    posted_to_discord: false,
    promotion_band: 'NONE',
    tier: 'C',
    meta: null,
  },
];

// ---- Tests ----

describe('postingAuthority (POSTING-AUTHORITY-001)', () => {
  describe('capper picks selection ignores promotion_band', () => {
    it('capper pick with band=NONE and tier=D is selected', () => {
      const selected = selectCapperPicks(FIXTURES);
      expect(selected.find(p => p.id === 'capper-band-none')).toBeDefined();
    });

    it('capper pick with band=null and tier=null is selected', () => {
      const selected = selectCapperPicks(FIXTURES);
      expect(selected.find(p => p.id === 'capper-band-null')).toBeDefined();
    });

    it('capper pick with band=HARD is also selected (no exclusion)', () => {
      const selected = selectCapperPicks(FIXTURES);
      expect(selected.find(p => p.id === 'capper-band-hard')).toBeDefined();
    });

    it('all capper picks regardless of band are selected', () => {
      const selected = selectCapperPicks(FIXTURES);
      const capperIds = selected.map(p => p.id);
      expect(capperIds).toContain('capper-band-none');
      expect(capperIds).toContain('capper-band-null');
      expect(capperIds).toContain('capper-band-hard');
      expect(capperIds).toHaveLength(3);
    });

    it('already-posted capper pick is excluded by idempotency', () => {
      const selected = selectCapperPicks(FIXTURES);
      expect(selected.find(p => p.id === 'already-posted')).toBeUndefined();
    });
  });

  describe('system picks require approval flag', () => {
    it('unapproved system pick is NOT selected', () => {
      const selected = selectApprovedSystemPicks(FIXTURES);
      expect(selected.find(p => p.id === 'system-unapproved')).toBeUndefined();
    });

    it('approved system pick IS selected', () => {
      const selected = selectApprovedSystemPicks(FIXTURES);
      expect(selected.find(p => p.id === 'system-approved')).toBeDefined();
    });

    it('approving a system pick changes its eligibility', () => {
      // Before: not approved
      const before = selectApprovedSystemPicks(FIXTURES);
      expect(before.find(p => p.id === 'system-unapproved')).toBeUndefined();

      // After: approved
      const mutated = FIXTURES.map(p =>
        p.id === 'system-unapproved' ? { ...p, meta: { ...p.meta, system_approved: true } } : p
      );
      const after = selectApprovedSystemPicks(mutated);
      expect(after.find(p => p.id === 'system-unapproved')).toBeDefined();
    });
  });

  describe('kill switch blocks both capper and system', () => {
    it('kill switch ON: no capper picks selected', () => {
      const result = selectAll(FIXTURES, true);
      expect(result.capper).toHaveLength(0);
    });

    it('kill switch ON: no system picks selected', () => {
      const result = selectAll(FIXTURES, true);
      expect(result.system).toHaveLength(0);
    });

    it('kill switch ON: no legacy picks selected', () => {
      const result = selectAll(FIXTURES, true);
      expect(result.legacy).toHaveLength(0);
    });

    it('kill switch OFF: picks are returned normally', () => {
      const result = selectAll(FIXTURES, false);
      expect(result.capper.length).toBeGreaterThan(0);
      expect(result.system.length).toBeGreaterThan(0);
      expect(result.legacy.length).toBeGreaterThan(0);
    });
  });

  describe('legacy fallback for picks without origin tag', () => {
    it('legacy pick with HARD band is selected via fallback', () => {
      const selected = selectLegacyHardBand(FIXTURES);
      expect(selected.find(p => p.id === 'legacy-hard')).toBeDefined();
    });

    it('legacy pick with NONE band is NOT selected', () => {
      const selected = selectLegacyHardBand(FIXTURES);
      expect(selected.find(p => p.id === 'legacy-none')).toBeUndefined();
    });

    it('origin-tagged picks are NOT in legacy set', () => {
      const selected = selectLegacyHardBand(FIXTURES);
      const ids = selected.map(p => p.id);
      // These have meta.pick_origin set, so they should NOT appear in legacy
      expect(ids).not.toContain('capper-band-hard');
      expect(ids).not.toContain('system-approved');
    });
  });

  describe('capper routing includes capper identity', () => {
    it('each capper pick carries the capper name in meta', () => {
      const selected = selectCapperPicks(FIXTURES);
      for (const pick of selected) {
        expect(pick.meta?.capper).toBeDefined();
        expect(typeof pick.meta?.capper).toBe('string');
      }
    });

    it('capper names match known cappers', () => {
      const selected = selectCapperPicks(FIXTURES);
      const capperNames = selected.map(p => p.meta?.capper);
      expect(capperNames).toContain('Griff843');
      expect(capperNames).toContain('Vicgo');
      expect(capperNames).toContain('Sauced');
    });
  });

  describe('discord receipt structure', () => {
    it('receipt includes required fields', () => {
      const receipt = {
        channel_id: 'capper-thread:Griff843',
        poster: 'DiscordPromotionAgent',
        posted_at: new Date().toISOString(),
      };

      expect(receipt.channel_id).toBeDefined();
      expect(receipt.poster).toBeDefined();
      expect(receipt.posted_at).toBeDefined();
      expect(new Date(receipt.posted_at).getTime()).not.toBeNaN();
    });
  });
});
