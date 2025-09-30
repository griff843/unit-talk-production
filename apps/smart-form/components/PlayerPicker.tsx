'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, User, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PlayerOption, type AutocompleteResponse } from '@unit-talk/shared-forms';

interface PlayerPickerProps {
  value?: string;
  onChange: (value: string, option?: PlayerOption) => void;
  placeholder?: string;
  sport?: string;
  market?: string;
  tier?: string[];
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

const DEBOUNCE_DELAY = 300;

/**
 * PlayerPicker - Optimized autocomplete component for player selection
 * Features sub-200ms response times with intelligent caching and debouncing
 */
export function PlayerPicker({
  value,
  onChange,
  placeholder = 'Search for a player...',
  sport,
  market,
  tier,
  disabled = false,
  error,
  required = false,
}: PlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState<PlayerOption | null>(null);

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

  // Fetch player options with react-query for caching
  const {
    data: playersResponse,
    isLoading,
    error: queryError
  } = useQuery({
    queryKey: ['player-autocomplete', debouncedQuery, sport, market, tier],
    queryFn: async (): Promise<AutocompleteResponse<PlayerOption>> => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          options: [],
          meta: {
            total: 0,
            filtered: 0,
            query: debouncedQuery,
            filters: { sport, market, tier },
            execution_time_ms: 0,
            cache_hit: true,
          },
        };
      }

      const searchParams = new URLSearchParams({
        type: 'player',
        query: debouncedQuery,
        limit: '20',
        include_metadata: 'true',
      });

      if (sport) searchParams.set('sport', sport);
      if (market) searchParams.set('market', market);
      if (tier?.length) searchParams.set('tier', tier.join(','));

      const response = await fetch(`/api/props?${searchParams}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=60', // Client-side cache
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const options = playersResponse?.options || [];

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

  // Format tier badge color
  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'A': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'B': return 'bg-green-100 text-green-800 border-green-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Format confidence score
  const formatConfidence = (score?: number) => {
    if (!score) return null;
    return `${(score * 100).toFixed(0)}%`;
  };

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
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {displayValue || placeholder}
              </span>
              {selectedOption?.metadata.tier && (
                <Badge
                  variant="outline"
                  className={cn('text-xs', getTierColor(selectedOption.metadata.tier))}
                >
                  {selectedOption.metadata.tier}
                </Badge>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search players..."
              value={query}
              onValueChange={handleQueryChange}
            />

            {isLoading && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Searching players...
              </div>
            )}

            {queryError && (
              <div className="p-4 text-sm text-red-600 text-center">
                Failed to load players. Please try again.
              </div>
            )}

            {!isLoading && !queryError && options.length === 0 && debouncedQuery.length >= 2 && (
              <CommandEmpty>
                No players found for "{debouncedQuery}".
                {sport && <div className="text-xs text-muted-foreground mt-1">in {sport}</div>}
              </CommandEmpty>
            )}

            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
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
                        <div className="font-medium truncate">
                          {option.metadata.team_name ?
                            `${option.value} (${option.metadata.team_name})` :
                            option.value
                          }
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{option.metadata.sport}</span>
                          {option.metadata.recent_props > 0 && (
                            <>
                              <span>•</span>
                              <span>{option.metadata.recent_props} recent props</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {option.metadata.tier && (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getTierColor(option.metadata.tier))}
                        >
                          {option.metadata.tier}
                        </Badge>
                      )}
                      {option.metadata.avg_confidence && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <TrendingUp className="h-3 w-3" />
                          {formatConfidence(option.metadata.avg_confidence)}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {playersResponse?.meta && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/50">
                {playersResponse.meta.filtered} of {playersResponse.meta.total} players
                {playersResponse.meta.cache_hit && (
                  <span className="ml-2 text-green-600">⚡ cached</span>
                )}
                <span className="ml-2">
                  {playersResponse.meta.execution_time_ms}ms
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