/**
 * AlertAgent V2 — Consensus Advice Engine
 *
 * Returns short, sharp, non-robotic advice for alert signals.
 * Falls back to deterministic template advice if AI is unavailable.
 * Never leaks "AI" language.
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import { AlertSignal, AlertType, ConsensusAdvice } from './types';

// ── Template Advice (deterministic fallback) ─────────────────────────────────

const TEMPLATE_ADVICE: Record<AlertType, (signal: AlertSignal) => ConsensusAdvice> = {
  injury: signal => ({
    headline: `${signal.player_name || 'Player'} injury update`,
    action: 'HEDGE',
    reasoning: `${signal.player_name || 'Key player'} status changed to ${signal.detection.status || 'questionable'}. Exposure on this player's props should be reassessed immediately.`,
    risk: 'Status could change again before game time. Monitor official injury reports.',
    confidence: 60,
  }),

  steam: signal => {
    const d = signal.detection;
    const isSharpSide = Number(d.publicPercentage || 0) > 70;
    return {
      headline: `Sharp money on ${signal.player_name || signal.market || 'market'}`,
      action: isSharpSide ? 'FADE' : 'ADD',
      reasoning: `Line moved ${d.lineMovement || '?'} pts against ${d.publicPercentage || '?'}% public action. Sharp books are signaling the opposite side.`,
      risk: 'Steam moves can reverse if triggered by injury news or lineup changes.',
      confidence: 65,
    };
  },

  line_movement: signal => {
    const d = signal.detection;
    const change = Number(d.lineChange || 0);
    const direction = change > 0 ? 'up' : 'down';
    return {
      headline: `${signal.player_name || 'Line'} moved ${direction}`,
      action: Math.abs(change) >= 3 ? 'FADE' : 'HOLD',
      reasoning: `Line shifted ${Math.abs(change).toFixed(1)} pts ${direction}. ${Math.abs(change) >= 3 ? 'Significant move suggests new information.' : 'Moderate move — worth monitoring.'}`,
      risk: 'Line may continue moving. Confirm with multiple books before acting.',
      confidence: 55,
    };
  },

  hedge: signal => {
    const d = signal.detection;
    return {
      headline: `Hedge window on ${signal.player_name || signal.market || 'market'}`,
      action: 'HEDGE',
      reasoning:
        `${d.lineDiscrepancy || '?'} pt discrepancy between books creates a hedge opportunity. ${d.arbitragePercentage ? `Arb: ${d.arbitragePercentage}%` : ''}`.trim(),
      risk: 'Lines can align quickly. Act within the next few minutes if hedging.',
      confidence: 70,
    };
  },

  middle: signal => {
    const d = signal.detection;
    return {
      headline: `Middle on ${signal.player_name || signal.market || 'market'}`,
      action: 'ADD',
      reasoning: `${d.middleGap || d.gap || '?'} pt gap between books. Both sides of the middle can be played for potential two-way win.`,
      risk: 'Middle windows close fast. Verify lines on both books before placing.',
      confidence: 65,
    };
  },
};

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Get consensus advice for an alert signal.
 *
 * Currently uses deterministic template advice (no external AI calls).
 * Designed so that a future version can add AI consensus without changing
 * the interface.
 */
export function getConsensusAdvice(signal: AlertSignal): ConsensusAdvice {
  const templateFn = TEMPLATE_ADVICE[signal.type];
  if (!templateFn) {
    return {
      headline: 'Alert triggered',
      action: 'HOLD',
      reasoning: 'Automatic alert with insufficient context for a specific recommendation.',
      risk: 'Review manually before acting.',
      confidence: 30,
    };
  }

  try {
    return templateFn(signal);
  } catch {
    // Fallback on any error in template logic
    return {
      headline: `${signal.type} alert`,
      action: 'HOLD',
      reasoning: 'Template advice generation encountered an issue. Manual review recommended.',
      risk: 'Verify signal data before acting.',
      confidence: 30,
    };
  }
}
