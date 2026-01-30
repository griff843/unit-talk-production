/* eslint-disable no-console */
/**
 * Generate embed snapshot artifacts for each alert type.
 * Run with: npx tsx test/agents/AlertAgent/generateEmbedSnapshots.ts
 */
import * as fs from 'fs';
import * as path from 'path';

import { generateAlertKey } from '../../../src/agents/AlertAgent/v2/alertKey';
import { getConsensusAdvice } from '../../../src/agents/AlertAgent/v2/consensusAdvice';
import { buildAlertEmbedV2 } from '../../../src/agents/AlertAgent/v2/embedBuilderV2';

import type { AlertSignal, AlertType } from '../../../src/agents/AlertAgent/v2/types';

const TYPES: AlertType[] = ['injury', 'steam', 'line_movement', 'hedge', 'middle'];

const SIGNALS: Record<AlertType, Partial<AlertSignal>> = {
  injury: {
    player_name: 'Jayson Tatum',
    sport: 'NBA',
    market: 'points',
    game_id: 'game-bos-mia',
    line: 28.5,
    odds: -115,
    detection: { status: 'questionable', gameTimeClose: true },
  },
  steam: {
    player_name: 'Patrick Mahomes',
    sport: 'NFL',
    market: 'passing_yards',
    game_id: 'game-kc-buf',
    line: 285.5,
    odds: -110,
    detection: { lineMovement: 2.0, publicPercentage: 82 },
  },
  line_movement: {
    player_name: 'Nikola Jokic',
    sport: 'NBA',
    market: 'rebounds',
    game_id: 'game-den-lal',
    line: 12.5,
    odds: -120,
    detection: {
      oldLine: 11.0,
      newLine: 12.5,
      lineChange: 1.5,
      lineVelocity: 0.5,
      direction: 'up',
    },
  },
  hedge: {
    player_name: 'Shohei Ohtani',
    sport: 'MLB',
    market: 'strikeouts',
    game_id: 'game-lad-nyy',
    line: 7.5,
    odds: -105,
    detection: { lineDiscrepancy: 4.0, arbitragePercentage: 2.5 },
  },
  middle: {
    player_name: 'Connor McDavid',
    sport: 'NHL',
    market: 'points',
    game_id: 'game-edm-col',
    line: 1.5,
    odds: +130,
    detection: { middleGap: 3.5, winProbability: 0.72 },
  },
};

const outDir = path.resolve(__dirname, '../../../../out/alert-agent/2026-01-29/03-tests');
// eslint-disable-next-line security/detect-non-literal-fs-filename
fs.mkdirSync(outDir, { recursive: true });

const snapshots: Record<string, unknown> = {};

for (const type of TYPES) {
  const base = SIGNALS[type];
  const signal: AlertSignal = {
    type,
    sport: base.sport || 'NBA',
    market: base.market || 'unknown',
    player_name: base.player_name,
    game_id: base.game_id,
    line: base.line,
    odds: base.odds,
    detection: base.detection || {},
    timestamp: '2026-01-29T19:00:00.000Z',
  };

  const advice = getConsensusAdvice(signal);
  const alertKey = generateAlertKey(signal);
  const embed = buildAlertEmbedV2(signal, advice, alertKey, `trace-${type}`);

  snapshots[type] = {
    signal: {
      type: signal.type,
      player_name: signal.player_name,
      sport: signal.sport,
      market: signal.market,
    },
    alertKey,
    advice,
    embed,
  };
}

const outPath = path.join(outDir, 'embed-snapshots.txt');
// eslint-disable-next-line security/detect-non-literal-fs-filename
fs.writeFileSync(outPath, JSON.stringify(snapshots, null, 2), 'utf-8');
console.log(`Embed snapshots written to: ${outPath}`);
console.log(`Types: ${TYPES.join(', ')}`);
