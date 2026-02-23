'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sport } from '../types';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical GamesRow
interface UIGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  matchup: string;
  sport: string;
  spread: { home: number; away: number; odds: number };
  total: number;
  moneyline: { home: number; away: number };
  time: string;
  utc_timestamp?: number;
  is_live: boolean;
  has_spread?: boolean;
  has_total?: boolean;
  has_moneyline?: boolean;
  // SMARTFORM-ENTITY-RESOLUTION-001: Team UUIDs for FanDuel-style entity scoping
  home_team_uuid?: string | null;
  away_team_uuid?: string | null;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy alias for backward compatibility
type Game = UIGame;

interface GamesListProps {
  sport?: Sport;
  gameDate?: string;
  selectedGameId?: string;
  onSelectGame: (game: UIGame) => void;
}

function LocalGameTime({
  utcTimestamp,
  fallbackTime,
}: {
  utcTimestamp?: number;
  fallbackTime?: string;
}) {
  const [localTime, setLocalTime] = useState<string>('');

  useEffect(() => {
    if (utcTimestamp) {
      const gameDate = new Date(utcTimestamp);
      setLocalTime(
        gameDate.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        })
      );
    } else if (fallbackTime) {
      setLocalTime(fallbackTime);
    }
  }, [utcTimestamp, fallbackTime]);

  return (
    <span className="text-sm text-muted-foreground">{localTime || fallbackTime || 'TBD'}</span>
  );
}

function formatOdds(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '--';
  return value > 0 ? `+${value}` : `${value}`;
}

function formatSpread(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '--';
  return value > 0 ? `+${value}` : `${value}`;
}

function formatTotal(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '--';
  return `${value}`;
}

export function GamesList({ sport, gameDate, selectedGameId, onSelectGame }: GamesListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGames = async () => {
      if (!sport || !gameDate) {
        setGames([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { apiClient } = await import('@/lib/api-client');
        const realGames = await apiClient.fetchGames(sport);

        if (realGames && realGames.length > 0) {
          const formatted = realGames.map((game: any, index: number) => ({
            id: game.id || `${sport?.toLowerCase()}-game-${index + 1}`,
            homeTeam: game.home_team_name || game.homeTeam || 'Home Team',
            awayTeam: game.away_team_name || game.awayTeam || 'Away Team',
            matchup:
              game.matchup ||
              `${game.away_team_name || game.awayTeam || 'Away'} @ ${game.home_team_name || game.homeTeam || 'Home'}`,
            sport: sport,
            spread: {
              home: game.spread_clean || game.spread?.home || 0,
              away: game.spread_clean ? -game.spread_clean : game.spread?.away || 0,
              // SMARTFORM-ODDS-FIELD-INTEGRITY-007: No silent -110 fallback, use null for missing odds
              odds: game.spread_odds_clean || game.spread?.odds || null,
            },
            total: game.total_clean || game.total || 0,
            moneyline: {
              home: game.moneyline_home_clean || game.moneyline?.home || 0,
              away: game.moneyline_away_clean || game.moneyline?.away || 0,
            },
            time: game.display_time || game.game_time_local || 'TBD',
            utc_timestamp: game.utc_timestamp,
            is_live: game.is_live || false,
            has_spread: game.has_spread || false,
            has_total: game.has_total || false,
            has_moneyline: game.has_moneyline || false,
            // SMARTFORM-ENTITY-RESOLUTION-001: Team UUIDs for FanDuel-style entity scoping
            home_team_uuid: game.home_team_uuid || null,
            away_team_uuid: game.away_team_uuid || null,
          }));
          setGames(formatted);
        } else {
          setGames([]);
          setError('No games available for this date.');
        }
      } catch (err) {
        console.error('Error loading games:', err);
        setError('Failed to load games.');
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [sport, gameDate]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Loading games...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">{error}</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No games found. Try a different date or sport.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-sm font-semibold text-foreground">Available Games</h4>
        <span className="text-xs text-muted-foreground">Local time</span>
      </div>
      {games.map(game => {
        const hasAnyOdds = game.has_spread || game.has_total || game.has_moneyline;

        return (
          <div
            key={game.id}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedGameId === game.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-border/80'
            }`}
            onClick={() => onSelectGame(game)}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm text-foreground">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <LocalGameTime utcTimestamp={game.utc_timestamp} fallbackTime={game.time} />
                  {game.is_live && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      LIVE
                    </Badge>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {game.sport}
              </Badge>
            </div>

            {/* Inline odds row */}
            {hasAnyOdds && (
              <div className="flex gap-3 mt-2 pt-2 border-t border-border">
                {game.has_spread && (
                  <div className="text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70 mr-1">SPR</span>
                    <span className="font-medium text-foreground">
                      {formatSpread(game.spread.home)}
                    </span>
                    <span className="text-muted-foreground/70 ml-0.5">
                      ({formatOdds(game.spread.odds)})
                    </span>
                  </div>
                )}
                {game.has_total && (
                  <div className="text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70 mr-1">O/U</span>
                    <span className="font-medium text-foreground">{formatTotal(game.total)}</span>
                  </div>
                )}
                {game.has_moneyline && (
                  <div className="text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70 mr-1">ML</span>
                    <span className="font-medium text-foreground">
                      {formatOdds(game.moneyline.home)}
                    </span>
                    <span className="text-muted-foreground/70 mx-0.5">/</span>
                    <span className="font-medium text-foreground">
                      {formatOdds(game.moneyline.away)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { Game };
