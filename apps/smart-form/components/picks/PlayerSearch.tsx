/**
 * PlayerSearch Component
 *
 * Production-grade player search with:
 * - 200ms debounce
 * - AbortController for stale request cancellation
 * - 10 minute cache
 * - Skeleton loading state
 * - Auto-game resolution on selection
 */

'use client';

import * as React from 'react';
import { Search, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerSearch } from '@/hooks/use-player-search';
import { useGameResolve } from '@/hooks/use-game-resolve';
import type { Player, GameRef, League } from '@/types/form';

interface PlayerSearchProps {
  league: League;
  date: string; // YYYY-MM-DD
  value?: Player | null;
  onSelect: (player: Player, gameRef: GameRef | null) => void;
  error?: string;
}

export function PlayerSearch({
  league,
  date,
  value,
  onSelect,
  error,
}: PlayerSearchProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { query, setQuery, data: players, isLoading } = usePlayerSearch('', league);

  // Auto-resolve game when player selected
  const { data: gameResolveData, isLoading: isResolvingGame } = useGameResolve(
    selectedPlayerId || undefined,
    date,
    league
  );

  // Handle player selection
  const handleSelectPlayer = React.useCallback(
    (player: Player) => {
      setSelectedPlayerId(player.id);
      setQuery(player.name);
      setIsOpen(false);

      // Will trigger game resolution via useGameResolve
      // We'll call onSelect after resolution completes
    },
    [setQuery]
  );

  // Call onSelect once game is resolved
  React.useEffect(() => {
    if (selectedPlayerId && gameResolveData && !isResolvingGame) {
      const player = players?.find(p => p.id === selectedPlayerId);
      if (player) {
        onSelect(player, gameResolveData.gameRef);
        setSelectedPlayerId(null); // Reset after callback
      }
    }
  }, [selectedPlayerId, gameResolveData, isResolvingGame, players, onSelect]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(newQuery.length >= 2);
  };

  // Handle input focus
  const handleFocus = () => {
    if (query.length >= 2) {
      setIsOpen(true);
    }
  };

  // Handle blur with delay to allow click on result
  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search for player..."
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive'
          )}
          aria-label="Search for player"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="max-h-60 overflow-y-auto p-1">
            {isLoading ? (
              <PlayerSearchSkeleton />
            ) : !players || players.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {query.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No players found'}
              </div>
            ) : (
              players.map(player => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => handleSelectPlayer(player)}
                  className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {player.headshotUrl ? (
                      <img
                        src={player.headshotUrl}
                        alt={player.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {player.team}
                      {player.position && ` • ${player.position}`}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      {isResolvingGame && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving game...
        </div>
      )}
    </div>
  );
}

function PlayerSearchSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
