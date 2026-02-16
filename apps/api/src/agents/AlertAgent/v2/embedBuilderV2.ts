/**
 * AlertAgent V2 — Premium Embed Builder
 *
 * Single unified embed builder that outputs consistent Discord embed JSON.
 * Does NOT import discord.js — produces plain JSON payloads usable in
 * DRY_RUN mode without any Discord dependency.
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import { AlertSignal, AlertType, ConsensusAdvice, DiscordEmbedPayload } from './types';

// ── Color Palette ────────────────────────────────────────────────────────────

const ALERT_COLORS: Record<AlertType, number> = {
  injury: 0xff0000, // Red
  steam: 0xff6600, // Orange
  line_movement: 0xff9900, // Amber
  hedge: 0x3366ff, // Blue
  middle: 0xaa00ff, // Purple
};

// ── Title Prefixes ───────────────────────────────────────────────────────────

const ALERT_TITLES: Record<AlertType, string> = {
  injury: '🚑 INJURY ALERT',
  steam: '🔥 STEAM MOVE',
  line_movement: '📈 LINE MOVEMENT',
  hedge: '🛡️ HEDGE OPPORTUNITY',
  middle: '🔁 MIDDLE OPPORTUNITY',
};

// ── Action Emoji Map ─────────────────────────────────────────────────────────

const ACTION_EMOJI: Record<string, string> = {
  HOLD: '✋',
  HEDGE: '🛡️',
  FADE: '🚫',
  ADD: '➕',
  PASS: '⏭️',
};

// ── Build Embed Options ──────────────────────────────────────────────────────

export interface BuildEmbedOptions {
  signal: AlertSignal;
  advice: ConsensusAdvice;
  alertKey: string;
  traceId: string;
  thumbnailUrl?: string;
}

// ── Build Embed ──────────────────────────────────────────────────────────────

// eslint-disable-next-line max-params
export function buildAlertEmbedV2(
  signal: AlertSignal,
  advice: ConsensusAdvice,
  alertKey: string,
  traceId: string,
  thumbnailUrl?: string
): DiscordEmbedPayload {
  const opts: BuildEmbedOptions = { signal, advice, alertKey, traceId, thumbnailUrl };
  return buildEmbed(opts);
}

function buildEmbed(opts: BuildEmbedOptions): DiscordEmbedPayload {
  const { signal, advice, alertKey, traceId, thumbnailUrl } = opts;
  const titlePrefix = ALERT_TITLES[signal.type] ?? '⚠️ ALERT';
  const headline = advice.headline || buildHeadline(signal);

  const embed: DiscordEmbedPayload = {
    title: `${titlePrefix} — ${headline}`,
    description: buildDescription(signal, advice),
    color: ALERT_COLORS[signal.type] ?? 0x808080,
    fields: buildFields(signal, advice),
    footer: { text: `trace: ${traceId} | key: ${alertKey} | ${new Date().toISOString()}` },
    timestamp: new Date().toISOString(),
  };

  if (thumbnailUrl) {
    embed.thumbnail = { url: thumbnailUrl };
  }

  return embed;
}

// ── Headline Builder ─────────────────────────────────────────────────────────

function buildHeadline(signal: AlertSignal): string {
  const entity = signal.player_name || signal.team_name || 'Unknown';
  const market = signal.market || '';
  return `${entity}${market ? ` (${market})` : ''}`;
}

// ── Description Builder (2–4 lines, human, not robotic) ──────────────────────

function buildDescription(signal: AlertSignal, advice: ConsensusAdvice): string {
  const lines: string[] = [describeSignal(signal)];
  if (advice.reasoning) {
    const r = advice.reasoning;
    lines.push(r.length > 180 ? r.slice(0, 177) + '...' : r);
  }
  return lines.join('\n');
}

// ── Signal Description (table-driven to reduce complexity) ───────────────────

type DescribeFn = (entity: string, signal: AlertSignal) => string;

const SIGNAL_DESCRIBERS: Record<AlertType, DescribeFn> = {
  injury: (entity, signal) =>
    `**${entity}** status changed to **${signal.detection.status || 'questionable'}**. Game impact assessment triggered.`,
  steam: (entity, signal) => {
    const d = signal.detection;
    return `Sharp action detected on **${entity}** ${signal.market || ''}. Line moved ${d.lineMovement || '?'} pts with ${d.publicPercentage || '?'}% public exposure.`;
  },
  line_movement: (entity, signal) => {
    const d = signal.detection;
    return `**${entity}** ${signal.market || ''} line shifted from **${d.oldLine ?? '?'}** → **${d.newLine ?? signal.line ?? '?'}** (${d.direction || 'unknown'} movement).`;
  },
  hedge: (entity, signal) =>
    `Hedge window open on **${entity}** ${signal.market || ''}. Discrepancy across books: **${signal.detection.lineDiscrepancy || '?'}** pts.`,
  middle: (entity, signal) => {
    const d = signal.detection;
    return `Middle opportunity detected on **${entity}** ${signal.market || ''}. Gap: **${d.middleGap || d.gap || '?'}** pts between books.`;
  },
};

function describeSignal(signal: AlertSignal): string {
  const entity = signal.player_name || signal.team_name || 'Unknown';
  const describer = SIGNAL_DESCRIBERS[signal.type];
  return describer ? describer(entity, signal) : `Alert triggered for **${entity}**.`;
}

// ── Fields Builder ───────────────────────────────────────────────────────────

function buildFields(
  signal: AlertSignal,
  advice: ConsensusAdvice
): Array<{ name: string; value: string; inline: boolean }> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  addMarketField(fields, signal);
  addTriggerField(fields, signal);
  addActionField(fields, advice);
  addRiskField(fields, advice);

  return fields;
}

function addMarketField(
  fields: Array<{ name: string; value: string; inline: boolean }>,
  signal: AlertSignal
): void {
  if (signal.line === undefined && signal.odds === undefined && !signal.market) return;
  const parts: string[] = [];
  if (signal.market) parts.push(`**Market:** ${signal.market}`);
  if (signal.line !== undefined) parts.push(`**Line:** ${signal.line}`);
  if (signal.odds !== undefined) parts.push(`**Odds:** ${formatOdds(signal.odds)}`);
  fields.push({ name: '📊 Market Info', value: parts.join(' • '), inline: false });
}

function addTriggerField(
  fields: Array<{ name: string; value: string; inline: boolean }>,
  signal: AlertSignal
): void {
  const triggers = buildTriggerBullets(signal);
  if (triggers.length > 0) {
    fields.push({ name: '⚡ Why It Triggered', value: triggers.join('\n'), inline: false });
  }
}

function addActionField(
  fields: Array<{ name: string; value: string; inline: boolean }>,
  advice: ConsensusAdvice
): void {
  const emoji = ACTION_EMOJI[advice.action] ?? '❓';
  fields.push({
    name: '🎯 Suggested Action',
    value: `${emoji} **${advice.action}** (${advice.confidence}% confidence)`,
    inline: true,
  });
}

function addRiskField(
  fields: Array<{ name: string; value: string; inline: boolean }>,
  advice: ConsensusAdvice
): void {
  if (advice.risk) {
    fields.push({ name: '⚠️ Risk', value: advice.risk, inline: true });
  }
}

// ── Trigger Bullets (table-driven) ───────────────────────────────────────────

type BulletFn = (d: Record<string, unknown>) => string[];

const TRIGGER_BUILDERS: Record<AlertType, BulletFn> = {
  injury: d => {
    const b: string[] = [];
    if (d.status) b.push(`• Player status: **${d.status}**`);
    if (d.gameTimeClose) b.push(`• Game starts within 2 hours`);
    return b;
  },
  steam: d => {
    const b: string[] = [];
    if (d.lineMovement) b.push(`• Line moved **${d.lineMovement}** pts`);
    if (d.publicPercentage) b.push(`• Public exposure: **${d.publicPercentage}%**`);
    return b;
  },
  line_movement: d => {
    const b: string[] = [];
    if (d.lineChange) b.push(`• Line change: **${d.lineChange}** pts`);
    if (d.lineVelocity) b.push(`• Velocity: **${d.lineVelocity}** pts/min`);
    return b;
  },
  hedge: d => {
    const b: string[] = [];
    if (d.arbitragePercentage) b.push(`• Arbitrage: **${d.arbitragePercentage}%**`);
    if (d.lineDiscrepancy) b.push(`• Line gap: **${d.lineDiscrepancy}** pts`);
    return b;
  },
  middle: d => {
    const b: string[] = [];
    if (d.middleGap || d.gap) b.push(`• Middle gap: **${d.middleGap || d.gap}** pts`);
    if (d.winProbability)
      b.push(`• Win probability: **${(Number(d.winProbability) * 100).toFixed(0)}%**`);
    return b;
  },
};

function buildTriggerBullets(signal: AlertSignal): string[] {
  const builder = TRIGGER_BUILDERS[signal.type];
  return builder ? builder(signal.detection).slice(0, 2) : [];
}

// ── Utility ──────────────────────────────────────────────────────────────────

function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return String(odds);
}
