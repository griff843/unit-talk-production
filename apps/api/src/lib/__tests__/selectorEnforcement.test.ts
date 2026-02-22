/**
 * SPRINT-109A: Selector Enforcement Tests
 *
 * These tests verify that Discord posting selectors:
 * 1. Always call assertDiscordContract before posting
 * 2. Have CONTRACT-GUARDED comments
 * 3. Do not bypass view_postable_picks_v1_2 logic
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

describe('SPRINT-109A: Selector Enforcement', () => {
  describe('assertDiscordContract import verification', () => {
    it('DiscordPromotionAgent imports assertDiscordContract', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/agents/DiscordPromotionAgent/index.ts'),
        'utf-8'
      );
      expect(content).toContain('assertDiscordContract');
      expect(content).toContain("from '../../lib/embedPresentationContract'");
    });

    it('DiscordTicketWorker imports assertDiscordContract', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/consumers/DiscordTicketWorker.ts'),
        'utf-8'
      );
      expect(content).toContain('assertDiscordContract');
      expect(content).toContain("from '../lib/embedPresentationContract'");
    });

    it('BridgeWorker imports assertDiscordContract', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/workers/BridgeWorker.ts'),
        'utf-8'
      );
      expect(content).toContain('assertDiscordContract');
      expect(content).toContain("from '../lib/embedPresentationContract'");
    });
  });

  describe('CONTRACT-GUARDED comments verification', () => {
    it('DiscordPromotionAgent has CONTRACT-GUARDED comments on selectors', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/agents/DiscordPromotionAgent/index.ts'),
        'utf-8'
      );
      expect(content).toContain('CONTRACT-GUARDED');
      expect(content).toContain('Do not bypass view_postable_picks_v1_2');
    });

    it('DiscordTicketWorker has CONTRACT-GUARDED comment', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/consumers/DiscordTicketWorker.ts'),
        'utf-8'
      );
      expect(content).toContain('CONTRACT-GUARDED');
    });

    it('BridgeWorker has CONTRACT-GUARDED comment', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/workers/BridgeWorker.ts'),
        'utf-8'
      );
      expect(content).toContain('CONTRACT-GUARDED');
    });
  });

  describe('assertDiscordContract usage verification', () => {
    it('DiscordTicketWorker calls assertDiscordContract in processItem', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/consumers/DiscordTicketWorker.ts'),
        'utf-8'
      );
      // Should have the call pattern
      expect(content).toMatch(/assertDiscordContract\s*\(/);
      // Should check result.ok
      expect(content).toMatch(/discordContract\.ok|contractResult\.ok/);
    });

    it('BridgeWorker calls assertDiscordContract in ticket handler', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/workers/BridgeWorker.ts'),
        'utf-8'
      );
      // Should have the call pattern
      expect(content).toMatch(/assertDiscordContract\s*\(/);
      // Should check result.ok
      expect(content).toMatch(/contractResult\.ok|discordContract\.ok/);
    });
  });

  describe('No direct webhook calls without contract', () => {
    it('DiscordTicketWorker checks contract before postToDiscord', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/consumers/DiscordTicketWorker.ts'),
        'utf-8'
      );

      // Find the processItem function and verify contract check comes before post
      const processItemMatch = content.match(/async function processItem[\s\S]*?^}/m);
      if (processItemMatch) {
        const processItemCode = processItemMatch[0];
        const contractCheckIndex = processItemCode.indexOf('assertDiscordContract');
        const postIndex = processItemCode.indexOf('postToDiscord');

        // Contract check should come before post
        expect(contractCheckIndex).toBeLessThan(postIndex);
        expect(contractCheckIndex).toBeGreaterThan(-1);
      }
    });
  });
});

describe('SPRINT-109A: No bypass paths', () => {
  it('ticketEmbedBuilder has runtime guard in buildTicketEmbed', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ticketEmbedBuilder.ts'),
      'utf-8'
    );
    // Should throw if contract is invalid
    expect(content).toContain('buildTicketEmbed called without valid contract');
    expect(content).toContain('throw new Error');
  });

  it('ticketEmbedBuilder exports assertTicketDiscordContract', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ticketEmbedBuilder.ts'),
      'utf-8'
    );
    expect(content).toContain('export function assertTicketDiscordContract');
  });
});
