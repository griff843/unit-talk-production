/**
 * Tests for context-loader.ts
 *
 * Verifies context pack building and fail-closed behavior.
 */

import { describe, it, expect } from 'vitest';

import { buildContextPack } from '../context-loader.js';
import { loadGovernance } from '../governance-loader.js';

describe('context-loader', () => {
  describe('buildContextPack', () => {
    it('should build a context pack from loaded manifest', () => {
      const governance = loadGovernance();
      expect(governance.contextManifest).not.toBeNull();

      const pack = buildContextPack(governance.contextManifest!);

      expect(pack.loaded.length).toBeGreaterThan(0);
      expect(pack.truthPriorityOrder).toBeInstanceOf(Array);
      expect(pack.truthPriorityOrder.length).toBeGreaterThan(0);
      expect(pack.forbiddenSources).toBeInstanceOf(Array);
    });

    it('should load always-required context sources', () => {
      const governance = loadGovernance();
      const pack = buildContextPack(governance.contextManifest!);

      const alwaysLoaded = pack.loaded.filter(e => e.category === 'always');
      expect(alwaysLoaded.length).toBeGreaterThan(0);

      // Check that loaded entries have content
      for (const entry of alwaysLoaded) {
        expect(entry.content).toBeDefined();
        expect(entry.content.length).toBeGreaterThan(0);
        expect(entry.contentType).toBeDefined();
      }
    });

    it('should report failed loads with reasons', () => {
      const governance = loadGovernance();
      const pack = buildContextPack(governance.contextManifest!);

      // Failed entries should have reasons
      for (const entry of pack.failed) {
        expect(entry.reason).toBeDefined();
        expect(entry.reason.length).toBeGreaterThan(0);
      }
    });

    it('should correctly determine isComplete when no fatal failures', () => {
      const governance = loadGovernance();
      const pack = buildContextPack(governance.contextManifest!);

      // isComplete should be true if no fail-closed reasons
      if (pack.failClosedReasons.length === 0) {
        expect(pack.isComplete).toBe(true);
      } else {
        expect(pack.isComplete).toBe(false);
      }
    });

    it('should load optional context without failing', () => {
      const governance = loadGovernance();
      const pack = buildContextPack(governance.contextManifest!);

      const optionalLoaded = pack.loaded.filter(e => e.category === 'optional');
      // Optional context should load if files exist — not a failure if some don't
      expect(optionalLoaded).toBeInstanceOf(Array);
    });

    it('should filter sprint-specific context by relevant domains', () => {
      const governance = loadGovernance();

      // Load with lifecycle-related domains
      const packWithDomains = buildContextPack(governance.contextManifest!, 'SPRINT-TEST-001', [
        'unified_picks',
        'lifecycle',
      ]);

      // Load without domains
      const packWithoutDomains = buildContextPack(
        governance.contextManifest!,
        'SPRINT-TEST-001',
        []
      );

      // With relevant domains, more sprint-specific sources should load
      const sprintSpecificWithDomains = packWithDomains.loaded.filter(
        e => e.category === 'sprint_specific'
      );
      const sprintSpecificWithout = packWithoutDomains.loaded.filter(
        e => e.category === 'sprint_specific'
      );

      // With lifecycle domains specified, we expect at least some sprint-specific context to load
      // (or at least attempt to load). Without domains, fewer should match.
      expect(sprintSpecificWithDomains.length).toBeGreaterThanOrEqual(sprintSpecificWithout.length);
    });
  });
});
