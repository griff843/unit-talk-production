/**
 * AlertAgent V2 — Shared Types
 *
 * Centralizes all V2-specific type definitions.
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

// ── Alert Types ──────────────────────────────────────────────────────────────

export type AlertType = 'line_movement' | 'steam' | 'hedge' | 'injury' | 'middle';

// ── Alert Signal (input to V2 engine) ────────────────────────────────────────

export interface AlertSignal {
  type: AlertType;
  sport: string;
  market: string;
  player_id?: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  game_id?: string;
  game_date?: string;
  line?: number;
  odds?: number;
  over_odds?: number;
  under_odds?: number;
  book?: string;
  /** Raw detection payload — varies by alert type */
  detection: Record<string, unknown>;
  /** ISO timestamp of when the signal was generated */
  timestamp: string;
}

// ── Consensus Advice ─────────────────────────────────────────────────────────

export interface ConsensusAdvice {
  headline: string;
  action: 'HOLD' | 'HEDGE' | 'FADE' | 'ADD' | 'PASS';
  reasoning: string;
  risk: string;
  confidence: number; // 0–100
}

// ── Alert Payload (output of V2 engine) ──────────────────────────────────────

export interface AlertPayload {
  alert_key: string;
  type: AlertType;
  signal: AlertSignal;
  advice: ConsensusAdvice;
  embed: DiscordEmbedPayload;
  trace_id: string;
  created_at: string;
  dry_run: boolean;
}

// ── Discord Embed Shape ──────────────────────────────────────────────────────

export interface DiscordEmbedPayload {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline: boolean }>;
  footer: { text: string; icon_url?: string };
  thumbnail?: { url: string };
  timestamp: string;
}

// ── Cooldown Config ──────────────────────────────────────────────────────────

export type CooldownWindowsConfig = Record<AlertType, number>;

export const DEFAULT_COOLDOWN_WINDOWS: CooldownWindowsConfig = {
  line_movement: 15 * 60 * 1000, // 15 minutes
  steam: 30 * 60 * 1000, // 30 minutes
  hedge: 60 * 60 * 1000, // 60 minutes
  injury: 120 * 60 * 1000, // 120 minutes (or once per player per day)
  middle: 60 * 60 * 1000, // 60 minutes
};

// ── Timestamp Bucket ─────────────────────────────────────────────────────────

/** 5-minute bucket width in ms */
export const TIMESTAMP_BUCKET_MS = 5 * 60 * 1000;

// ── Alert Engine V2 Config ───────────────────────────────────────────────────

export interface AlertEngineV2Config {
  enabled: boolean;
  dryRun: boolean;
  dryRunOutputDir: string;
  cooldownWindows: CooldownWindowsConfig;
  canaryChannelId?: string;
}
