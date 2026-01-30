/* eslint-disable max-lines */
/**
 * AlertAgent V2 — Comprehensive Test Suite
 *
 * Tests:
 *  1. Alert key stability (deterministic)
 *  2. Cooldown enforcement (per-type windows)
 *  3. DRY_RUN writes payload artifacts
 *  4. Embed shape correctness (structural assertions)
 *  5. Advice engine fallback behavior
 *  6. No duplicates when same event processed twice (idempotency)
 *  7. Engine flag-gating (V2 off by default)
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AlertEngineV2 } from '../../../src/agents/AlertAgent/v2/alertEngineV2';
import {
  generateAlertKey,
  computeTimestampBucket,
} from '../../../src/agents/AlertAgent/v2/alertKey';
import { getConsensusAdvice } from '../../../src/agents/AlertAgent/v2/consensusAdvice';
import { CooldownManager } from '../../../src/agents/AlertAgent/v2/cooldownManager';
import { buildAlertEmbedV2 } from '../../../src/agents/AlertAgent/v2/embedBuilderV2';

import type {
  AlertSignal,
  ConsensusAdvice,
  AlertType,
} from '../../../src/agents/AlertAgent/v2/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeSignal(overrides?: Partial<AlertSignal>): AlertSignal {
  return {
    type: 'steam',
    sport: 'NBA',
    market: 'points',
    player_name: 'LeBron James',
    player_id: 'player-123',
    game_id: 'game-456',
    line: 25.5,
    odds: -110,
    book: 'DraftKings',
    detection: {
      lineMovement: 1.5,
      publicPercentage: 78,
    },
    timestamp: '2026-01-29T18:00:00.000Z',
    ...overrides,
  };
}

function makeInjurySignal(): AlertSignal {
  return makeSignal({
    type: 'injury',
    detection: {
      status: 'questionable',
      gameTimeClose: true,
    },
  });
}

function makeLineMovementSignal(): AlertSignal {
  return makeSignal({
    type: 'line_movement',
    detection: {
      oldLine: 25.5,
      newLine: 27.0,
      lineChange: 1.5,
      lineVelocity: 0.3,
      direction: 'up',
    },
  });
}

function makeHedgeSignal(): AlertSignal {
  return makeSignal({
    type: 'hedge',
    detection: {
      lineDiscrepancy: 3.5,
      arbitragePercentage: 2.1,
    },
  });
}

function makeMiddleSignal(): AlertSignal {
  return makeSignal({
    type: 'middle',
    detection: {
      middleGap: 3.0,
      winProbability: 0.65,
    },
  });
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AlertAgent V2', () => {
  // ════════════════════════════════════════════════════════════════════════════
  // 1. Alert Key Stability
  // ════════════════════════════════════════════════════════════════════════════

  describe('Alert Key Generation', () => {
    it('produces the same key for identical signals', () => {
      const signal = makeSignal();
      const key1 = generateAlertKey(signal);
      const key2 = generateAlertKey(signal);
      expect(key1).toBe(key2);
    });

    it('produces different keys for different players', () => {
      const signal1 = makeSignal({ player_name: 'LeBron James', player_id: 'p1' });
      const signal2 = makeSignal({ player_name: 'Kevin Durant', player_id: 'p2' });
      expect(generateAlertKey(signal1)).not.toBe(generateAlertKey(signal2));
    });

    it('produces different keys for different alert types', () => {
      const s1 = makeSignal({ type: 'steam' });
      const s2 = makeSignal({ type: 'injury' });
      expect(generateAlertKey(s1)).not.toBe(generateAlertKey(s2));
    });

    it('produces different keys for different sports', () => {
      const s1 = makeSignal({ sport: 'NBA' });
      const s2 = makeSignal({ sport: 'NFL' });
      expect(generateAlertKey(s1)).not.toBe(generateAlertKey(s2));
    });

    it('same key within the same 5-min timestamp bucket', () => {
      const s1 = makeSignal({ timestamp: '2026-01-29T18:00:00.000Z' });
      const s2 = makeSignal({ timestamp: '2026-01-29T18:02:30.000Z' });
      expect(generateAlertKey(s1)).toBe(generateAlertKey(s2));
    });

    it('different key across 5-min timestamp buckets', () => {
      const s1 = makeSignal({ timestamp: '2026-01-29T18:00:00.000Z' });
      const s2 = makeSignal({ timestamp: '2026-01-29T18:05:01.000Z' });
      expect(generateAlertKey(s1)).not.toBe(generateAlertKey(s2));
    });

    it('key is a 24-char hex string', () => {
      const key = generateAlertKey(makeSignal());
      expect(key).toMatch(/^[0-9a-f]{24}$/);
    });
  });

  describe('Timestamp Bucket', () => {
    it('aligns to 5-min boundaries', () => {
      const bucket = computeTimestampBucket('2026-01-29T18:03:45.000Z');
      const expected = new Date('2026-01-29T18:00:00.000Z').getTime();
      expect(bucket).toBe(expected);
    });

    it('supports custom bucket width', () => {
      const bucket15 = computeTimestampBucket('2026-01-29T18:07:00.000Z', 15 * 60 * 1000);
      const expected = new Date('2026-01-29T18:00:00.000Z').getTime();
      expect(bucket15).toBe(expected);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Cooldown Enforcement
  // ════════════════════════════════════════════════════════════════════════════

  describe('CooldownManager', () => {
    let cm: CooldownManager;

    beforeEach(() => {
      cm = new CooldownManager();
    });

    afterEach(() => {
      cm.destroy();
    });

    it('allows first alert (not in cooldown)', () => {
      expect(cm.tryAcquire('key-1', 'steam')).toBe(true);
    });

    it('blocks duplicate alert within cooldown window', () => {
      expect(cm.tryAcquire('key-1', 'steam')).toBe(true);
      expect(cm.tryAcquire('key-1', 'steam')).toBe(false);
    });

    it('allows different keys simultaneously', () => {
      expect(cm.tryAcquire('key-1', 'steam')).toBe(true);
      expect(cm.tryAcquire('key-2', 'steam')).toBe(true);
    });

    it('has per-type cooldown windows', () => {
      expect(cm.getWindowMs('line_movement')).toBe(15 * 60 * 1000);
      expect(cm.getWindowMs('steam')).toBe(30 * 60 * 1000);
      expect(cm.getWindowMs('hedge')).toBe(60 * 60 * 1000);
      expect(cm.getWindowMs('injury')).toBe(120 * 60 * 1000);
      expect(cm.getWindowMs('middle')).toBe(60 * 60 * 1000);
    });

    it('tracks cache size', () => {
      cm.tryAcquire('a', 'steam');
      cm.tryAcquire('b', 'injury');
      expect(cm.size()).toBe(2);
    });

    it('clear() removes all entries', () => {
      cm.tryAcquire('a', 'steam');
      cm.clear();
      expect(cm.size()).toBe(0);
      // Should allow the same key again
      expect(cm.tryAcquire('a', 'steam')).toBe(true);
    });

    it('supports custom cooldown windows', () => {
      const custom = new CooldownManager({ steam: 1000 }); // 1 second
      expect(custom.getWindowMs('steam')).toBe(1000);
      custom.destroy();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. Embed Shape Correctness
  // ════════════════════════════════════════════════════════════════════════════

  describe('Embed Builder V2', () => {
    const advice: ConsensusAdvice = {
      headline: 'Sharp action on LeBron points',
      action: 'FADE',
      reasoning: 'Line moved against heavy public exposure.',
      risk: 'Steam moves can reverse on injury news.',
      confidence: 72,
    };

    it('produces correct embed structure', () => {
      const signal = makeSignal();
      const embed = buildAlertEmbedV2(signal, advice, 'abc123', 'trace-001');

      expect(embed.title).toContain('STEAM MOVE');
      expect(embed.title).toContain(advice.headline);
      expect(embed.description).toBeTruthy();
      expect(typeof embed.color).toBe('number');
      expect(embed.fields).toBeInstanceOf(Array);
      expect(embed.fields.length).toBeGreaterThanOrEqual(2);
      expect(embed.footer.text).toContain('trace-001');
      expect(embed.footer.text).toContain('abc123');
      expect(embed.timestamp).toBeTruthy();
    });

    it('includes Market Info field', () => {
      const embed = buildAlertEmbedV2(makeSignal(), advice, 'k', 't');
      const marketField = embed.fields.find(f => f.name.includes('Market Info'));
      expect(marketField).toBeTruthy();
      expect(marketField!.value).toContain('25.5');
    });

    it('includes Suggested Action field', () => {
      const embed = buildAlertEmbedV2(makeSignal(), advice, 'k', 't');
      const actionField = embed.fields.find(f => f.name.includes('Suggested Action'));
      expect(actionField).toBeTruthy();
      expect(actionField!.value).toContain('FADE');
      expect(actionField!.value).toContain('72');
    });

    it('includes Risk field', () => {
      const embed = buildAlertEmbedV2(makeSignal(), advice, 'k', 't');
      const riskField = embed.fields.find(f => f.name.includes('Risk'));
      expect(riskField).toBeTruthy();
    });

    it('includes trigger bullets for each alert type', () => {
      const signals: AlertSignal[] = [
        makeInjurySignal(),
        makeSignal(),
        makeLineMovementSignal(),
        makeHedgeSignal(),
        makeMiddleSignal(),
      ];
      for (const signal of signals) {
        const embed = buildAlertEmbedV2(signal, advice, 'k', 't');
        const triggerField = embed.fields.find(f => f.name.includes('Why It Triggered'));
        expect(triggerField).toBeTruthy();
        expect(triggerField!.value.length).toBeGreaterThan(0);
      }
    });

    it('includes thumbnail when provided', () => {
      const embed = buildAlertEmbedV2(
        makeSignal(),
        advice,
        'k',
        't',
        'https://example.com/headshot.png'
      );
      expect(embed.thumbnail).toEqual({ url: 'https://example.com/headshot.png' });
    });

    it('omits thumbnail when not provided', () => {
      const embed = buildAlertEmbedV2(makeSignal(), advice, 'k', 't');
      expect(embed.thumbnail).toBeUndefined();
    });

    it('uses correct colors per alert type', () => {
      const expected: Record<AlertType, number> = {
        injury: 0xff0000,
        steam: 0xff6600,
        line_movement: 0xff9900,
        hedge: 0x3366ff,
        middle: 0xaa00ff,
      };
      for (const [type, color] of Object.entries(expected)) {
        const signal = makeSignal({ type: type as AlertType });
        const embed = buildAlertEmbedV2(signal, advice, 'k', 't');
        expect(embed.color).toBe(color);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. Advice Engine Fallback Behavior
  // ════════════════════════════════════════════════════════════════════════════

  describe('Consensus Advice Engine', () => {
    it('returns advice for all 5 alert types', () => {
      const types: AlertType[] = ['injury', 'steam', 'line_movement', 'hedge', 'middle'];
      for (const type of types) {
        const signal = makeSignal({ type });
        const advice = getConsensusAdvice(signal);
        expect(advice.headline).toBeTruthy();
        expect(advice.action).toMatch(/^(HOLD|HEDGE|FADE|ADD|PASS)$/);
        expect(advice.reasoning).toBeTruthy();
        expect(advice.risk).toBeTruthy();
        expect(advice.confidence).toBeGreaterThan(0);
        expect(advice.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('injury signal returns HEDGE action', () => {
      const advice = getConsensusAdvice(makeInjurySignal());
      expect(advice.action).toBe('HEDGE');
    });

    it('steam with high public returns FADE', () => {
      const advice = getConsensusAdvice(
        makeSignal({
          type: 'steam',
          detection: { publicPercentage: 78, lineMovement: 1.5 },
        })
      );
      expect(advice.action).toBe('FADE');
    });

    it('hedge signal returns HEDGE action', () => {
      const advice = getConsensusAdvice(makeHedgeSignal());
      expect(advice.action).toBe('HEDGE');
    });

    it('middle signal returns ADD action', () => {
      const advice = getConsensusAdvice(makeMiddleSignal());
      expect(advice.action).toBe('ADD');
    });

    it('does not leak AI language', () => {
      const types: AlertType[] = ['injury', 'steam', 'line_movement', 'hedge', 'middle'];
      for (const type of types) {
        const advice = getConsensusAdvice(makeSignal({ type }));
        const combined = [advice.headline, advice.reasoning, advice.risk].join(' ').toLowerCase();
        expect(combined).not.toContain('ai ');
        expect(combined).not.toContain('artificial intelligence');
        expect(combined).not.toContain('machine learning');
        expect(combined).not.toContain('neural');
      }
    });

    it('returns fallback for unknown type', () => {
      const advice = getConsensusAdvice(makeSignal({ type: 'unknown_type' as AlertType }));
      expect(advice.action).toBe('HOLD');
      expect(advice.confidence).toBe(30);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. AlertEngine V2 — DRY_RUN + Idempotency
  // ════════════════════════════════════════════════════════════════════════════

  describe('AlertEngineV2', () => {
    let engine: AlertEngineV2;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alertv2-test-'));
      engine = new AlertEngineV2({
        enabled: true,
        dryRun: true,
        dryRunOutputDir: tmpDir,
      });
    });

    afterEach(() => {
      engine.destroy();
      // Clean up temp dir
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup errors */
      }
    });

    it('processSignal returns payload on first call', async () => {
      const signal = makeSignal();
      const result = await engine.processSignal(signal);
      expect(result).not.toBeNull();
      expect(result!.alert_key).toBeTruthy();
      expect(result!.type).toBe('steam');
      expect(result!.dry_run).toBe(true);
    });

    it('processSignal returns null on duplicate (idempotency)', async () => {
      const signal = makeSignal();
      const first = await engine.processSignal(signal);
      expect(first).not.toBeNull();

      const second = await engine.processSignal(signal);
      expect(second).toBeNull();
    });

    it('DRY_RUN writes JSON artifact to output dir', async () => {
      const signal = makeSignal();
      await engine.processSignal(signal);

      const files = fs.readdirSync(tmpDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^dryrun-steam-[0-9a-f]+\.json$/);

      const content = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf-8'));
      expect(content.type).toBe('steam');
      expect(content.alert_key).toBeTruthy();
      expect(content.advice).toBeTruthy();
      expect(content.embed).toBeTruthy();
      expect(content.dry_run).toBe(true);
    });

    it('processes different signal types independently', async () => {
      const steam = await engine.processSignal(makeSignal());
      const injury = await engine.processSignal(makeInjurySignal());
      const hedge = await engine.processSignal(makeHedgeSignal());

      expect(steam).not.toBeNull();
      expect(injury).not.toBeNull();
      expect(hedge).not.toBeNull();

      expect(steam!.alert_key).not.toBe(injury!.alert_key);
      expect(steam!.alert_key).not.toBe(hedge!.alert_key);
    });

    it('isEnabled reflects config', () => {
      expect(engine.isEnabled()).toBe(true);

      const offEngine = new AlertEngineV2({
        enabled: false,
        dryRun: true,
        dryRunOutputDir: tmpDir,
      });
      expect(offEngine.isEnabled()).toBe(false);
      offEngine.destroy();
    });

    it('isDryRun reflects config', () => {
      expect(engine.isDryRun()).toBe(true);
    });

    it('calls postEmbed callback when NOT in dry-run mode', async () => {
      const posted: any[] = [];
      const liveEngine = new AlertEngineV2(
        { enabled: true, dryRun: false, dryRunOutputDir: tmpDir },
        async payload => {
          posted.push(payload);
        }
      );

      await liveEngine.processSignal(makeSignal());
      expect(posted.length).toBe(1);
      expect(posted[0].type).toBe('steam');
      liveEngine.destroy();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Full Idempotency Proof (same event processed twice = 1 output)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Idempotency Proof', () => {
    it('processing identical signal 10 times produces exactly 1 payload', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-test-'));
      const engine = new AlertEngineV2({
        enabled: true,
        dryRun: true,
        dryRunOutputDir: tmpDir,
      });

      const signal = makeSignal();
      let payloads = 0;
      for (let i = 0; i < 10; i++) {
        const result = await engine.processSignal(signal);
        if (result) payloads++;
      }

      expect(payloads).toBe(1);
      expect(fs.readdirSync(tmpDir).length).toBe(1);

      engine.destroy();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('5 different alert types produce 5 payloads', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-test-'));
      const engine = new AlertEngineV2({
        enabled: true,
        dryRun: true,
        dryRunOutputDir: tmpDir,
      });

      const signals = [
        makeSignal(),
        makeInjurySignal(),
        makeLineMovementSignal(),
        makeHedgeSignal(),
        makeMiddleSignal(),
      ];

      let payloads = 0;
      for (const signal of signals) {
        const result = await engine.processSignal(signal);
        if (result) payloads++;
      }

      expect(payloads).toBe(5);
      expect(fs.readdirSync(tmpDir).length).toBe(5);

      engine.destroy();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. Payload Shape Validation (embed snapshots)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Payload Shape Validation', () => {
    it('AlertPayload has all required fields', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shape-test-'));
      const engine = new AlertEngineV2({
        enabled: true,
        dryRun: true,
        dryRunOutputDir: tmpDir,
      });

      const result = await engine.processSignal(makeSignal());
      expect(result).not.toBeNull();

      // Top-level fields
      expect(result).toHaveProperty('alert_key');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('advice');
      expect(result).toHaveProperty('embed');
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('dry_run');

      // Advice shape
      expect(result!.advice).toHaveProperty('headline');
      expect(result!.advice).toHaveProperty('action');
      expect(result!.advice).toHaveProperty('reasoning');
      expect(result!.advice).toHaveProperty('risk');
      expect(result!.advice).toHaveProperty('confidence');

      // Embed shape
      expect(result!.embed).toHaveProperty('title');
      expect(result!.embed).toHaveProperty('description');
      expect(result!.embed).toHaveProperty('color');
      expect(result!.embed).toHaveProperty('fields');
      expect(result!.embed).toHaveProperty('footer');
      expect(result!.embed).toHaveProperty('timestamp');

      engine.destroy();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
