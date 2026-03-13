/**
 * Integration tests: ShadowRunner
 * Sprint: SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS
 *
 * Uses demo-events.jsonl and demo-events-shadow-variant.jsonl fixtures.
 * Runs in-process (no filesystem writes for proof bundles — tmpdir used).
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { describe, it, expect, beforeEach } from 'vitest';

import { NullNotificationAdapter } from '../../adapters/null-notification';
import { RecordingPublishAdapter } from '../../adapters/recording-publish';
import { RecordingRecapAdapter } from '../../adapters/recording-recap';
import { ReplaySettlementAdapter } from '../../adapters/replay-settlement';
import { ShadowFeedAdapter } from '../../adapters/shadow-feed';
import { RealClockProvider } from '../../clock';
import { storeFromJsonl } from '../../event-store';
import { ShadowRunner } from '../shadow-runner';

import type { ShadowRunnerConfig } from '../types';

// ─────────────────────────────────────────────────────────────
// FIXTURE PATHS
// ─────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../test-fixtures');
const FIXTURE_PATH = join(fixturesDir, 'demo-events.jsonl');
const VARIANT_PATH = join(fixturesDir, 'demo-events-shadow-variant.jsonl');

const FIXTURE_JSONL = readFileSync(FIXTURE_PATH, 'utf8');
const VARIANT_JSONL = readFileSync(VARIANT_PATH, 'utf8');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildConfig(
  referenceJsonl: string,
  shadowJsonl: string,
  runIdSuffix?: string
): ShadowRunnerConfig {
  const runId = `test-guardrails-${runIdSuffix ?? randomUUID().slice(0, 8)}`;
  const referenceStore = storeFromJsonl(referenceJsonl);
  const shadowStore = storeFromJsonl(shadowJsonl);
  const clock = new RealClockProvider();

  const notificationAdapter = new NullNotificationAdapter('shadow');

  const referenceAdapters = {
    mode: 'shadow' as const,
    publish: new RecordingPublishAdapter('shadow'),
    notification: new NullNotificationAdapter('shadow'),
    feed: new ShadowFeedAdapter(referenceStore),
    settlement: new ReplaySettlementAdapter('shadow', referenceStore),
    recap: new RecordingRecapAdapter('shadow'),
  };

  const shadowAdapters = {
    mode: 'shadow' as const,
    publish: new RecordingPublishAdapter('shadow'),
    notification: new NullNotificationAdapter('shadow'),
    feed: new ShadowFeedAdapter(shadowStore),
    settlement: new ReplaySettlementAdapter('shadow', shadowStore),
    recap: new RecordingRecapAdapter('shadow'),
  };

  return {
    runId,
    referenceStore,
    shadowStore,
    clock,
    referenceAdapters,
    shadowAdapters,
    notificationAdapter,
    repoRoot: tmpdir(), // use tmpdir for proof artifacts in tests
  };
}

// ─────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────

describe('ShadowRunner integration', () => {
  describe('identical fixtures → PASS', () => {
    it('returns PASS verdict with 0 divergences', async () => {
      const config = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'clean');
      const runner = new ShadowRunner(config);
      const result = await runner.run();

      expect(result.verdictResult.verdict).toBe('PASS');
      expect(result.verdictResult.freezeRecommended).toBe(false);
      expect(result.verdictResult.divergences.totalCount).toBe(0);
      expect(result.verdictResult.divergences.bySeverity.CRITICAL).toBe(0);
    });

    it('does NOT emit a critical alert when PASS', async () => {
      const config = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'clean-alert');
      const runner = new ShadowRunner(config);
      await runner.run();

      const nullAdapter = config.notificationAdapter as NullNotificationAdapter;
      const criticalAlerts = nullAdapter
        .getSuppressed()
        .filter(s => s.alert.severity === 'critical');
      expect(criticalAlerts).toHaveLength(0);
    });

    it('writes proof bundle with 4 required files', async () => {
      const { existsSync } = await import('fs');
      const config = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'clean-proof');
      const runner = new ShadowRunner(config);
      const result = await runner.run();

      const bundlePath = result.proofBundlePath;
      expect(existsSync(join(bundlePath, 'shadow-trace.jsonl'))).toBe(true);
      expect(existsSync(join(bundlePath, 'divergence-report.json'))).toBe(true);
      expect(existsSync(join(bundlePath, 'shadow-verdict.json'))).toBe(true);
      expect(existsSync(join(bundlePath, 'proof-checksum.txt'))).toBe(true);
    });
  });

  describe('divergent fixture → FAIL + critical alert', () => {
    it('returns FAIL verdict on shadow variant', async () => {
      const config = buildConfig(FIXTURE_JSONL, VARIANT_JSONL, 'diverge');
      const runner = new ShadowRunner(config);
      const result = await runner.run();

      expect(result.verdictResult.verdict).toBe('FAIL');
      expect(result.verdictResult.freezeRecommended).toBe(true);
      expect(result.verdictResult.divergences.bySeverity.CRITICAL).toBeGreaterThanOrEqual(1);
    });

    it('captures a critical-severity alert in NullNotificationAdapter', async () => {
      const config = buildConfig(FIXTURE_JSONL, VARIANT_JSONL, 'diverge-alert');
      const runner = new ShadowRunner(config);
      await runner.run();

      const nullAdapter = config.notificationAdapter as NullNotificationAdapter;
      const criticalAlerts = nullAdapter
        .getSuppressed()
        .filter(s => s.alert.severity === 'critical');
      expect(criticalAlerts).toHaveLength(1);
      expect(criticalAlerts[0].alert.message).toMatch(/autopilot freeze/i);
      expect(
        (criticalAlerts[0].alert.context as Record<string, unknown>)['freezeRecommended']
      ).toBe(true);
    });

    it('writes proof bundle on FAIL', async () => {
      const { existsSync } = await import('fs');
      const config = buildConfig(FIXTURE_JSONL, VARIANT_JSONL, 'diverge-proof');
      const runner = new ShadowRunner(config);
      const result = await runner.run();

      expect(existsSync(result.proofBundlePath)).toBe(true);
      expect(existsSync(join(result.proofBundlePath, 'shadow-verdict.json'))).toBe(true);
    });
  });

  describe('Gate G — determinism across two runs', () => {
    it('identical fixtures produce the same verdict on two successive runs', async () => {
      const run1 = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'det-1');
      const run2 = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'det-2');

      const [r1, r2] = await Promise.all([
        new ShadowRunner(run1).run(),
        new ShadowRunner(run2).run(),
      ]);

      expect(r1.verdictResult.verdict).toBe(r2.verdictResult.verdict);
      expect(r1.verdictResult.divergences.totalCount).toBe(r2.verdictResult.divergences.totalCount);
      expect(r1.verdictResult.freezeRecommended).toBe(r2.verdictResult.freezeRecommended);
    });

    it('divergent fixtures produce the same verdict on two successive runs', async () => {
      const run1 = buildConfig(FIXTURE_JSONL, VARIANT_JSONL, 'det-div-1');
      const run2 = buildConfig(FIXTURE_JSONL, VARIANT_JSONL, 'det-div-2');

      const [r1, r2] = await Promise.all([
        new ShadowRunner(run1).run(),
        new ShadowRunner(run2).run(),
      ]);

      expect(r1.verdictResult.verdict).toBe(r2.verdictResult.verdict);
      expect(r1.verdictResult.freezeRecommended).toBe(r2.verdictResult.freezeRecommended);
    });
  });

  describe('result structure', () => {
    it('includes runId, traces, divergenceReport, timing metadata', async () => {
      const config = buildConfig(FIXTURE_JSONL, FIXTURE_JSONL, 'struct');
      const runner = new ShadowRunner(config);
      const result = await runner.run();

      expect(result.runId).toBe(config.runId);
      expect(result.shadowTrace).toBeDefined();
      expect(result.referenceTrace).toBeDefined();
      expect(result.divergenceReport).toBeDefined();
      expect(result.proofBundlePath).toBeTruthy();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });
  });
});
