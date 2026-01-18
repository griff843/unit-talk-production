/**
 * Discord Embed Formatting Tests
 *
 * Tests formatPickEmbed to ensure all PickView fields are properly
 * displayed in Discord embeds.
 */

// Mock logger first
jest.mock('../../../src/shared/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { formatPickEmbed } from '../../../src/publish/discord-sender';
import type { PickView } from '../../../src/publish/pick-view';

describe('formatPickEmbed', () => {
  it('should include all required fields for CANARY picks', () => {
    const pickView: PickView = {
      sport: 'NCAAB',
      league: 'NCAAB',
      matchup: 'Alabama St Hornets @ Missouri Tigers',
      homeTeam: 'missouri tigers',
      awayTeam: 'alabama st hornets',
      betType: 'moneyline',
      selection: 'alabama st hornets',
      line: 0,
      odds: 3500,
      units: 1,
      stake: 1,
      confidence: 8,
      book: 'FanDuel',
    };

    const embed = formatPickEmbed(pickView);

    // Verify title
    expect(embed.title).toBe('🔥 Alabama St Hornets @ Missouri Tigers');

    // Verify fields are present
    const fieldNames = embed.fields?.map((f) => f.name) || [];
    expect(fieldNames).toContain('🏆 Sport/League');
    expect(fieldNames).toContain('🏟️ Matchup');
    expect(fieldNames).toContain('📊 Bet Type');
    expect(fieldNames).toContain('⬆️ Pick/Side');
    expect(fieldNames).toContain('📏 Line');
    expect(fieldNames).toContain('💰 Odds');
    expect(fieldNames).toContain('💵 Units');
    expect(fieldNames).toContain('🎯 Confidence');
    expect(fieldNames).toContain('📖 Book');

    // Verify field values
    const sportField = embed.fields?.find((f) => f.name === '🏆 Sport/League');
    expect(sportField?.value).toBe('NCAAB');

    const matchupField = embed.fields?.find((f) => f.name === '🏟️ Matchup');
    expect(matchupField?.value).toBe('Alabama St Hornets @ Missouri Tigers');

    const betTypeField = embed.fields?.find((f) => f.name === '📊 Bet Type');
    expect(betTypeField?.value).toBe('moneyline');

    const selectionField = embed.fields?.find((f) => f.name === '⬆️ Pick/Side');
    expect(selectionField?.value).toBe('alabama st hornets');

    const lineField = embed.fields?.find((f) => f.name === '📏 Line');
    expect(lineField?.value).toBe('0');

    const oddsField = embed.fields?.find((f) => f.name === '💰 Odds');
    expect(oddsField?.value).toBe('3500');

    const unitsField = embed.fields?.find((f) => f.name === '💵 Units');
    expect(unitsField?.value).toBe('1');

    const confidenceField = embed.fields?.find((f) => f.name === '🎯 Confidence');
    expect(confidenceField?.value).toBe('8');

    const bookField = embed.fields?.find((f) => f.name === '📖 Book');
    expect(bookField?.value).toBe('FanDuel');
  });

  it('should handle prop bets with player names', () => {
    const pickView: PickView = {
      sport: 'NBA',
      playerName: 'LeBron James',
      betType: 'points',
      selection: 'over',
      line: 25.5,
      odds: -110,
      stake: 2,
      confidence: 9,
    };

    const embed = formatPickEmbed(pickView);

    // Title should use player name
    expect(embed.title).toBe('🔥 LeBron James');

    const selectionField = embed.fields?.find((f) => f.name === '⬆️ Pick/Side');
    expect(selectionField?.value).toBe('over');

    const lineField = embed.fields?.find((f) => f.name === '📏 Line');
    expect(lineField?.value).toBe('25.5');
  });

  it('should handle minimal pick data without errors', () => {
    const pickView: PickView = {
      selection: 'over',
      odds: -110,
    };

    const embed = formatPickEmbed(pickView);

    expect(embed.title).toBe('🔥 New Pick');
    expect(embed.fields?.find((f) => f.name === '⬆️ Pick/Side')?.value).toBe('over');
    expect(embed.fields?.find((f) => f.name === '💰 Odds')?.value).toBe('-110');

    // Should use default confidence
    expect(embed.fields?.find((f) => f.name === '🎯 Confidence')?.value).toBe('75');
  });

  it('should include tier and professional score when available', () => {
    const pickView: PickView = {
      selection: 'under',
      odds: -110,
      tier: 'S',
      professional_score: 92,
    };

    const embed = formatPickEmbed(pickView);

    const fieldNames = embed.fields?.map((f) => f.name) || [];
    expect(fieldNames).toContain('⭐ Tier');
    expect(fieldNames).toContain('🎓 Professional Score');

    expect(embed.fields?.find((f) => f.name === '⭐ Tier')?.value).toBe('S');
    expect(embed.fields?.find((f) => f.name === '🎓 Professional Score')?.value).toBe('92');
  });

  it('should handle notes in description', () => {
    const pickView: PickView = {
      selection: 'over',
      odds: -110,
      notes: 'Strong value play - line moved from 48.5',
    };

    const embed = formatPickEmbed(pickView);

    expect(embed.description).toBe('Strong value play - line moved from 48.5');
  });

  it('should omit line field when undefined', () => {
    const pickView: PickView = {
      selection: 'Lakers ML',
      odds: -150,
      betType: 'moneyline',
    };

    const embed = formatPickEmbed(pickView);

    const fieldNames = embed.fields?.map((f) => f.name) || [];
    expect(fieldNames).not.toContain('📏 Line');
  });

  it('should include line field when explicitly 0', () => {
    const pickView: PickView = {
      selection: 'pick em',
      odds: -110,
      line: 0,
    };

    const embed = formatPickEmbed(pickView);

    const fieldNames = embed.fields?.map((f) => f.name) || [];
    expect(fieldNames).toContain('📏 Line');
    expect(embed.fields?.find((f) => f.name === '📏 Line')?.value).toBe('0');
  });

  it('should have correct embed structure', () => {
    const pickView: PickView = {
      selection: 'over',
      odds: -110,
    };

    const embed = formatPickEmbed(pickView);

    expect(embed.color).toBe(0x00ff00); // Green
    expect(embed.timestamp).toBeDefined();
    expect(embed.footer?.text).toBe('Unit Talk • Professional Betting Intelligence');
  });

  it('should handle complete real-world CANARY record', () => {
    // Real production structure
    const pickView: PickView = {
      sport: 'NCAAB',
      league: 'NCAAB',
      matchup: 'alabama st hornets @ missouri tigers',
      homeTeam: 'missouri tigers',
      awayTeam: 'alabama st hornets',
      selection: 'alabama st hornets',
      line: 0,
      odds: 3500,
      confidence: 8,
      canonical_game_id: 'game-123',
    };

    const embed = formatPickEmbed(pickView);

    // Ensure no errors and all critical fields present
    expect(embed.title).toContain('alabama st hornets @ missouri tigers');
    expect(embed.fields?.length).toBeGreaterThan(0);

    // Verify critical fields
    const criticalFields = ['🏆 Sport/League', '⬆️ Pick/Side', '💰 Odds', '🎯 Confidence'];
    const fieldNames = embed.fields?.map((f) => f.name) || [];

    criticalFields.forEach((fieldName) => {
      expect(fieldNames).toContain(fieldName);
    });
  });
});
