/**
 * DiscordPreview Component
 *
 * Pixel-perfect Discord embed preview that updates as fields change.
 */

'use client';

import * as React from 'react';
import { buildDiscordEmbed, renderDiscordEmbedHTML } from '@/lib/discord-embed';
import type { Player, GameRef, PickInput } from '@/types/form';

interface DiscordPreviewProps {
  pick: Partial<PickInput>;
  player: Player | null;
  gameRef: GameRef | null;
}

export function DiscordPreview({ pick, player, gameRef }: DiscordPreviewProps) {
  const [copySuccess, setCopySuccess] = React.useState(false);

  const embed = React.useMemo(() => {
    // Only render if we have minimum required data
    if (!pick.league || !player || !pick.marketType || !pick.line || !pick.side || !pick.stakeText) {
      return null;
    }

    // Build complete pick input for embed
    const completePick: PickInput = {
      capperId: pick.capperId || '',
      league: pick.league,
      playerId: player.id,
      playerName: player.name,
      gameId: gameRef?.id || null,
      gameDate: pick.gameDate || new Date().toISOString().split('T')[0],
      marketType: pick.marketType,
      line: pick.line,
      side: pick.side,
      stakeText: pick.stakeText,
      userScore: pick.userScore,
      teamId: pick.teamId,
      odds: pick.odds,
    };

    return buildDiscordEmbed(completePick, player, gameRef);
  }, [pick, player, gameRef]);

  const embedHTML = React.useMemo(() => {
    if (!embed) return null;
    return renderDiscordEmbedHTML(embed);
  }, [embed]);

  const handleCopyJSON = React.useCallback(async () => {
    if (!embed) return;

    try {
      const json = JSON.stringify(embed, null, 2);
      await navigator.clipboard.writeText(json);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy JSON:', error);
    }
  }, [embed]);

  if (!embedHTML || !embed) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Fill in the form to see a preview of your Discord pick
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Discord Preview</h3>
        <button
          onClick={handleCopyJSON}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
          title="Copy embed JSON for QA testing"
        >
          {copySuccess ? '✓ Copied!' : 'Copy Preview as JSON'}
        </button>
      </div>
      <div
        className="overflow-hidden rounded-lg"
        dangerouslySetInnerHTML={{ __html: embedHTML }}
      />
    </div>
  );
}
