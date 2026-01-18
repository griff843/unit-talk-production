/**
 * PickView Normalization Tests
 *
 * Tests the buildPickView function to ensure proper metadata merging
 * and field precedence across picks and pick_publish tables.
 */

import { buildPickView, type PickView } from '../../../src/publish/pick-view';

describe('buildPickView', () => {
  describe('field precedence rules', () => {
    it('should prefer picks.selection over metadata keys', () => {
      const pickRow = {
        selection: 'database selection',
        metadata: {
          selection: 'metadata selection',
          pickSide: 'metadata pickSide',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.selection).toBe('database selection');
    });

    it('should use metadata selection when picks.selection is empty', () => {
      const pickRow = {
        selection: '',
        metadata: {
          pickSide: 'alabama st hornets',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.selection).toBe('alabama st hornets');
    });

    it('should prefer picks.odds over metadata odds', () => {
      const pickRow = {
        odds: 3500,
        metadata: {
          odds: 2000,
        },
      };

      const view = buildPickView(pickRow);

      expect(view.odds).toBe(3500);
    });

    it('should prefer picks.metadata over pick_publish.metadata', () => {
      const pickRow = {
        metadata: {
          sport: 'NCAAB',
          line: 5.5,
        },
      };

      const publishRow = {
        metadata: {
          sport: 'NFL',
          line: 7.5,
        },
      };

      const view = buildPickView(pickRow, publishRow);

      expect(view.sport).toBe('NCAAB');
      expect(view.line).toBe(5.5);
    });
  });

  describe('real CANARY record structure', () => {
    it('should handle actual production CANARY metadata correctly', () => {
      // Real production data from pick_publish.id = 8fd4d573-e800-4166-a196-4e60b16caf8e
      const pickRow = {
        id: '2b786966-0f55-402f-bec8-8e46189bcd4e',
        selection: '',
        odds: 0,
        metadata: {},
      };

      const publishRow = {
        metadata: {
          sport: 'NCAAB',
          league: 'NCAAB',
          home_team: 'missouri tigers',
          away_team: 'alabama st hornets',
          line: 0,
          odds: 3500,
          units: 1,
          confidence: 8,
          pickSide: 'alabama st hornets',
          canonical_game_id: 'game-123',
          canonical_player_id: null,
        },
      };

      const view = buildPickView(pickRow, publishRow);

      // Verify all fields are extracted correctly
      expect(view.sport).toBe('NCAAB');
      expect(view.league).toBe('NCAAB');
      expect(view.homeTeam).toBe('missouri tigers');
      expect(view.awayTeam).toBe('alabama st hornets');
      expect(view.matchup).toBe('alabama st hornets @ missouri tigers');
      expect(view.line).toBe(0);
      expect(view.odds).toBe(3500); // From publish metadata
      expect(view.selection).toBe('alabama st hornets'); // From pickSide
      expect(view.confidence).toBe(8); // From publish metadata
      expect(view.stake).toBe(1); // From publish metadata units field
      expect(view.units).toBe(1); // Aliased from stake
      expect(view.canonical_game_id).toBe('game-123');
    });

    it('should handle missing metadata gracefully', () => {
      const pickRow = {
        selection: 'over',
        odds: -110,
      };

      const view = buildPickView(pickRow);

      expect(view.selection).toBe('over');
      expect(view.odds).toBe(-110);
      expect(view.sport).toBeUndefined();
      expect(view.matchup).toBeUndefined();
    });
  });

  describe('key normalization', () => {
    it('should normalize pickSide to selection', () => {
      const pickRow = {
        selection: '',
        metadata: {
          pickSide: 'under',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.selection).toBe('under');
    });

    it('should normalize bet_type to betType', () => {
      const pickRow = {
        metadata: {
          bet_type: 'spread',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.betType).toBe('spread');
    });

    it('should normalize home_team and away_team', () => {
      const pickRow = {
        metadata: {
          home_team: 'Lakers',
          away_team: 'Warriors',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.homeTeam).toBe('Lakers');
      expect(view.awayTeam).toBe('Warriors');
      expect(view.matchup).toBe('Warriors @ Lakers');
    });

    it('should normalize market_type to betType', () => {
      const pickRow = {
        metadata: {
          market_type: 'total',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.betType).toBe('total');
    });
  });

  describe('matchup building', () => {
    it('should build matchup from away @ home', () => {
      const pickRow = {
        metadata: {
          away_team: 'Team A',
          home_team: 'Team B',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.matchup).toBe('Team A @ Team B');
    });

    it('should return undefined matchup if teams missing', () => {
      const pickRow = {
        metadata: {
          home_team: 'Team A',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.matchup).toBeUndefined();
    });
  });

  describe('book vs market distinction', () => {
    it('should identify FanDuel as a book', () => {
      const pickRow = {
        metadata: {
          market: 'FanDuel',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.book).toBe('FanDuel');
      expect(view.market).toBeUndefined();
    });

    it('should identify DraftKings as a book', () => {
      const pickRow = {
        metadata: {
          market: 'DraftKings Premium',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.book).toBe('DraftKings Premium');
      expect(view.market).toBeUndefined();
    });

    it('should treat non-book values as market', () => {
      const pickRow = {
        metadata: {
          market: 'Alternate Lines',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.market).toBe('Alternate Lines');
      expect(view.book).toBeUndefined();
    });
  });

  describe('units and stake aliasing', () => {
    it('should set units as alias for stake', () => {
      const pickRow = {
        stake: 2.5,
      };

      const view = buildPickView(pickRow);

      expect(view.stake).toBe(2.5);
      expect(view.units).toBe(2.5);
    });
  });

  describe('canonical IDs', () => {
    it('should extract canonical game and player IDs', () => {
      const pickRow = {
        metadata: {
          canonical_game_id: 'game-abc-123',
          canonical_player_id: 'player-xyz-456',
        },
      };

      const view = buildPickView(pickRow);

      expect(view.canonical_game_id).toBe('game-abc-123');
      expect(view.canonical_player_id).toBe('player-xyz-456');
    });
  });

  describe('backward compatibility', () => {
    it('should handle old records without metadata', () => {
      const pickRow = {
        selection: 'over',
        odds: -110,
        confidence: 7,
        stake: 1,
        tier: 'A',
      };

      const view = buildPickView(pickRow);

      expect(view.selection).toBe('over');
      expect(view.odds).toBe(-110);
      expect(view.confidence).toBe(7);
      expect(view.stake).toBe(1);
      expect(view.tier).toBe('A');
    });
  });
});
