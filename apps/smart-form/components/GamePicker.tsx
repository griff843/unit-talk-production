'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Calendar, Clock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type GameOption, type AutocompleteResponse } from '@unit-talk/shared-forms';

interface GamePickerProps {
  value?: string;
  onChange: (value: string, option?: GameOption) => void;
  placeholder?: string;
  sport?: string;
  dateRange?: 'today' | 'tomorrow' | 'week' | 'all';
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

const DEBOUNCE_DELAY = 300;

/**
 * GamePicker - Game selection component with date filtering
 * Features intelligent game grouping by date and league
 */
export function GamePicker({
  value,
  onChange,
  placeholder = 'Search games...',
  sport,
  dateRange = 'week',
  disabled = false,
  error,
  required = false,
}: GamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState<GameOption | null>(null);

  // Debounce query input for performance
  const debounceTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (newQuery: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDebouncedQuery(newQuery);
      }, DEBOUNCE_DELAY);
    };
  }, []);

  // Update debounced query when input changes
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.length >= 2) {
      debounceTimer(newQuery);
    } else {
      setDebouncedQuery('');
    }
  }, [debounceTimer]);

  // Fetch game options with react-query for caching
  const {
    data: gamesResponse,
    isLoading,
    error: queryError
  } = useQuery({
    queryKey: ['game-autocomplete', debouncedQuery, sport, dateRange],
    queryFn: async (): Promise<AutocompleteResponse<GameOption>> => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          options: [],
          meta: {
            total: 0,
            filtered: 0,
            query: debouncedQuery,
            filters: { sport, date_range: dateRange },
            execution_time_ms: 0,
            cache_hit: true,
          },
        };
      }

      const searchParams = new URLSearchParams({
        type: 'game',
        query: debouncedQuery,
        limit: '25',
        include_metadata: 'true',
        date_range: dateRange,
      });

      if (sport) searchParams.set('sport', sport);

      const response = await fetch(`/api/props?${searchParams}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch games: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const options = gamesResponse?.options || [];

  // Handle option selection
  const handleSelect = useCallback((optionValue: string) => {
    const option = options.find(opt => opt.value === optionValue);
    if (option) {
      setSelectedOption(option);
      onChange(optionValue, option);
      setOpen(false);
      setQuery(option.label);
    }
  }, [options, onChange]);

  // Get display value
  const displayValue = selectedOption?.label || value || '';

  // Format game date and time
  const formatGameDateTime = (gameDate: string) => {
    try {
      const date = new Date(gameDate);
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const gameDay = new Date(gameDate);
      gameDay.setHours(0, 0, 0, 0);

      let dateLabel = '';
      if (gameDay.getTime() === today.getTime()) {
        dateLabel = 'Today';
      } else if (gameDay.getTime() === tomorrow.getTime()) {
        dateLabel = 'Tomorrow';
      } else {
        dateLabel = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }

      const timeLabel = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });

      return { dateLabel, timeLabel, isLive: date < now && (now.getTime() - date.getTime()) < 4 * 60 * 60 * 1000 };
    } catch {
      return { dateLabel: 'TBD', timeLabel: '', isLive: false };
    }
  };

  // Get league badge color
  const getLeagueColor = (league: string) => {
    switch (league.toUpperCase()) {
      case 'NFL': return 'bg-green-100 text-green-800 border-green-200';
      case 'NBA': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MLB': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'NHL': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'NCAAF': return 'bg-red-100 text-red-800 border-red-200';
      case 'WNBA': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Format prop count
  const formatPropCount = (count: number) => {
    return count === 1 ? '1 prop' : `${count} props`;
  };

  // Group games by date for better organization
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, GameOption[]>();

    options.forEach(option => {
      const { dateLabel } = formatGameDateTime(option.metadata.game_date);
      if (!groups.has(dateLabel)) {
        groups.set(dateLabel, []);
      }
      groups.get(dateLabel)!.push(option);
    });

    // Sort groups by date
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      const dateOrder = ['Today', 'Tomorrow'];
      const aIndex = dateOrder.indexOf(a);
      const bIndex = dateOrder.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedGroups;
  }, [options]);

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-required={required}
            aria-invalid={!!error}
            className={cn(
              'w-full justify-between font-normal',
              !displayValue && 'text-muted-foreground',
              error && 'border-red-500 focus:ring-red-500'
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {displayValue || placeholder}
              </span>
              {selectedOption?.metadata.league && (
                <Badge
                  variant="outline"
                  className={cn('text-xs', getLeagueColor(selectedOption.metadata.league))}
                >
                  {selectedOption.metadata.league}
                </Badge>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search games..."
              value={query}
              onValueChange={handleQueryChange}
            />

            {isLoading && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Searching games...
              </div>
            )}

            {queryError && (
              <div className="p-4 text-sm text-red-600 text-center">
                Failed to load games. Please try again.
              </div>
            )}

            {!isLoading && !queryError && options.length === 0 && debouncedQuery.length >= 2 && (
              <CommandEmpty>
                No games found for "{debouncedQuery}".
                {sport && <div className="text-xs text-muted-foreground mt-1">in {sport}</div>}
              </CommandEmpty>
            )}

            {groupedOptions.length > 0 && groupedOptions.map(([dateLabel, games]) => (
              <CommandGroup key={dateLabel} heading={dateLabel}>
                {games.map((option) => {
                  const { dateLabel: gameDateLabel, timeLabel, isLive } = formatGameDateTime(option.metadata.game_date);

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleSelect}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === option.value ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {option.metadata.matchup}
                            </span>
                            {isLive && (
                              <Badge variant="destructive" className="text-xs">
                                LIVE
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{timeLabel}</span>
                            {option.metadata.league && (
                              <>
                                <span>•</span>
                                <span>{option.metadata.league}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getLeagueColor(option.metadata.league))}
                        >
                          {option.metadata.league}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          <Trophy className="h-3 w-3 mr-1" />
                          {formatPropCount(option.metadata.prop_count)}
                        </Badge>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}

            {gamesResponse?.meta && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/50">
                {gamesResponse.meta.filtered} of {gamesResponse.meta.total} games
                {gamesResponse.meta.cache_hit && (
                  <span className="ml-2 text-green-600">⚡ cached</span>
                )}
                <span className="ml-2">
                  {gamesResponse.meta.execution_time_ms}ms
                </span>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}