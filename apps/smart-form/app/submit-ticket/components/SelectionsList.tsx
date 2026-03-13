'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatchupAssets, SportsAsset } from '@/components/ui/sports-asset';
import { GameSelection, DISPLAY_LABELS } from '../types';

interface SelectionsListProps {
  selections: GameSelection[];
  onRemove: (id: string) => void;
}

// Format bet type for display
const formatBetType = (betType?: string) => {
  if (!betType) return null;
  return DISPLAY_LABELS[betType] || betType;
};

export function SelectionsList({ selections, onRemove }: SelectionsListProps) {
  if (selections.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Current Selections ({selections.length})
      </h4>
      <div className="space-y-2">
        {selections.map(sel => (
          <div
            key={sel.id}
            className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white"
          >
            <div className="min-w-0 flex flex-1 items-start gap-3">
              {sel.player_headshot_url ? (
                <SportsAsset
                  label={sel.player_name || sel.selection}
                  imageUrl={sel.player_headshot_url}
                  type="player"
                  className="h-10 w-10 shrink-0"
                />
              ) : sel.team_logo_url ? (
                <SportsAsset
                  label={sel.selection}
                  imageUrl={sel.team_logo_url}
                  type="team"
                  shape="square"
                  className="h-10 w-10 shrink-0"
                />
              ) : sel.home_team_logo_url || sel.away_team_logo_url ? (
                <MatchupAssets
                  awayLabel={sel.manual_away_team || sel.game || 'Away'}
                  homeLabel={sel.manual_home_team || sel.game || 'Home'}
                  awayImageUrl={sel.away_team_logo_url}
                  homeImageUrl={sel.home_team_logo_url}
                  assetClassName="h-9 w-9"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 flex items-center gap-1.5 flex-wrap">
                  {sel.game}
                  {sel.sport && (
                    <Badge
                      variant="default"
                      className="text-xs px-1.5 py-0 bg-blue-100 text-blue-800"
                    >
                      {sel.sport}
                    </Badge>
                  )}
                  {sel.bet_type && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {formatBetType(sel.bet_type)}
                    </Badge>
                  )}
                  {sel.source === 'manual' && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Manual
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {sel.selection} @ {Number(sel.odds) > 0 ? '+' : ''}
                  {sel.odds}
                  {sel.line && !sel.selection.includes(sel.line) && ` (${sel.line})`}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2 shrink-0"
              onClick={() => onRemove(sel.id!)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
