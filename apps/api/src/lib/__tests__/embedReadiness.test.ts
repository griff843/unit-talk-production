/**
 * EMBED READINESS GATE TESTS
 * Sprint: EMBED-MIN-REQ-GATE-ENFORCEMENT-051
 *
 * These tests verify the embed readiness gate:
 * - Validates required fields (league, matchup, event time)
 * - Detects "undefined" strings
 * - Detects duplicate line formatting
 * - Respects EMBED_STRICT_MODE
 * - Returns appropriate sanitized fallbacks
 */

import { describe, it, expect } from 'vitest';
import { assertEmbedReadiness } from '../embedPresentationContract';

// ============================================================
// TEST CASES
// ============================================================

describe('assertEmbedReadiness', () => {
  describe('Basic Field Validation', () => {
    it('should pass when all required fields are present', () => {
      const pick = {
        id: 'test-pick-1',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        game_time: '7:30 PM',
        selection: 'LeBron James Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.ready).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect missing league/sport', () => {
      const pick = {
        id: 'test-pick-2',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'LeBron James Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).toContain('league');
    });

    it('should detect missing matchup', () => {
      const pick = {
        id: 'test-pick-3',
        sport: 'NBA',
        game_date: '2026-02-19',
        selection: 'LeBron James Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).toContain('matchup');
    });

    it('should detect missing event time', () => {
      const pick = {
        id: 'test-pick-4',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        selection: 'LeBron James Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).toContain('event_start_time');
    });
  });

  describe('Alternative Field Sources', () => {
    it('should accept league as fallback for sport', () => {
      const pick = {
        id: 'test-pick-5',
        league: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('league');
      expect(result.sanitizedValues.league).toBe('NBA');
    });

    it('should construct matchup from manual_matchup_home/away', () => {
      const pick = {
        id: 'test-pick-6',
        sport: 'NBA',
        manual_matchup_home: 'Celtics',
        manual_matchup_away: 'Lakers',
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('matchup');
      expect(result.sanitizedValues.matchup).toBe('Lakers @ Celtics');
    });

    it('should accept matchup from manual_fields_blob', () => {
      const pick = {
        id: 'test-pick-7',
        sport: 'NBA',
        manual_fields_blob: { matchup: 'Lakers @ Celtics' },
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('matchup');
      expect(result.sanitizedValues.matchup).toBe('Lakers @ Celtics');
    });

    it('should accept matchup from meta.matchup', () => {
      const pick = {
        id: 'test-pick-8',
        sport: 'NBA',
        meta: { matchup: 'Lakers @ Celtics' },
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('matchup');
    });

    it('should accept manual_game_date as fallback', () => {
      const pick = {
        id: 'test-pick-9',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        manual_game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('event_start_time');
    });

    it('should use placed_at as last resort for time', () => {
      const pick = {
        id: 'test-pick-10',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        placed_at: '2026-02-19T15:30:00Z',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('event_start_time');
    });
  });

  describe('Undefined String Detection', () => {
    it('should detect literal "undefined" in selection', () => {
      const pick = {
        id: 'test-pick-11',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'undefined Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.includes('undefined'))).toBe(true);
    });

    it('should detect literal "undefined" in matchup', () => {
      const pick = {
        id: 'test-pick-12',
        sport: 'NBA',
        matchup: 'undefined @ Celtics',
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.violations.some(v => v.includes('undefined'))).toBe(true);
    });

    it('should NOT flag "undefined" in code comments (not in checked fields)', () => {
      const pick = {
        id: 'test-pick-13',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'LeBron James Over 27.5 PTS',
        // Note: title and league don't contain "undefined"
      };

      const result = assertEmbedReadiness(pick);

      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Duplicate Line Formatting Detection', () => {
    it('should detect duplicate line values in selection', () => {
      const pick = {
        id: 'test-pick-14',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'Over 27.5 Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.violations.some(v => v.includes('Duplicate line'))).toBe(true);
    });

    it('should NOT flag non-duplicate line values', () => {
      const pick = {
        id: 'test-pick-15',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'LeBron James Over 27.5 PTS',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.violations.filter(v => v.includes('Duplicate line'))).toHaveLength(0);
    });
  });

  describe('Sanitized Fallback Values', () => {
    it('should provide TBD fallbacks for missing fields', () => {
      const pick = {
        id: 'test-pick-16',
        // Missing sport, matchup, game_date
      };

      const result = assertEmbedReadiness(pick);

      expect(result.sanitizedValues.league).toBe('TBD');
      expect(result.sanitizedValues.matchup).toBe('TBD');
      expect(result.sanitizedValues.eventTime).toBe('TBD');
    });

    it('should use actual values when present', () => {
      const pick = {
        id: 'test-pick-17',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.sanitizedValues.league).toBe('NBA');
      expect(result.sanitizedValues.matchup).toBe('Lakers @ Celtics');
      expect(result.sanitizedValues.eventTime).not.toBe('TBD');
    });
  });

  describe('Mode Behavior', () => {
    it('should report mode correctly', () => {
      const pick = {
        id: 'test-pick-18',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
      };

      const result = assertEmbedReadiness(pick);

      // Mode depends on env var EMBED_STRICT_MODE
      expect(['strict', 'soft']).toContain(result.mode);
    });

    it('should block on violations regardless of mode', () => {
      const pick = {
        id: 'test-pick-19',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: '2026-02-19',
        selection: 'undefined Over 27.5',
      };

      const result = assertEmbedReadiness(pick);

      // Violations always block in both modes
      expect(result.ready).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null fields gracefully', () => {
      const pick = {
        id: 'test-pick-20',
        sport: null,
        matchup: null,
        game_date: null,
      };

      const result = assertEmbedReadiness(pick);

      // Should not throw, just report missing fields
      expect(result.missingFields).toContain('league');
      expect(result.missingFields).toContain('matchup');
      expect(result.missingFields).toContain('event_start_time');
    });

    it('should handle empty string fields', () => {
      const pick = {
        id: 'test-pick-21',
        sport: '',
        matchup: '   ',
        game_date: '',
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).toContain('league');
      expect(result.missingFields).toContain('matchup');
    });

    it('should handle Date objects for game_date', () => {
      const pick = {
        id: 'test-pick-22',
        sport: 'NBA',
        matchup: 'Lakers @ Celtics',
        game_date: new Date('2026-02-19'),
      };

      const result = assertEmbedReadiness(pick);

      expect(result.missingFields).not.toContain('event_start_time');
    });
  });
});
