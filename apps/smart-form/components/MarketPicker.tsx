'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Filter, X, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MarketOption, type AutocompleteResponse } from '@unit-talk/shared-forms';

interface MarketPickerProps {
  value?: string[];
  onChange: (values: string[], options?: MarketOption[]) => void;
  placeholder?: string;
  sport?: string;
  playerName?: string;
  maxSelections?: number;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  showSubmarkets?: boolean;
}

const DEBOUNCE_DELAY = 300;

/**
 * MarketPicker - Multi-select market/submarket filter component
 * Features filter chips interface with intelligent market grouping
 */
export function MarketPicker({
  value = [],
  onChange,
  placeholder = 'Search markets...',
  sport,
  playerName,
  maxSelections = 10,
  disabled = false,
  error,
  required = false,
  showSubmarkets = true,
}: MarketPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Map<string, MarketOption>>(new Map());

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

  // Fetch market options with react-query for caching
  const {
    data: marketsResponse,
    isLoading,
    error: queryError
  } = useQuery({
    queryKey: ['market-autocomplete', debouncedQuery, sport, playerName, showSubmarkets],
    queryFn: async (): Promise<AutocompleteResponse<MarketOption>> => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          options: [],
          meta: {
            total: 0,
            filtered: 0,
            query: debouncedQuery,
            filters: { sport, player_name: playerName },
            execution_time_ms: 0,
            cache_hit: true,
          },
        };
      }

      const searchParams = new URLSearchParams({
        type: 'market',
        query: debouncedQuery,
        limit: '30',
        include_metadata: 'true',
        include_submarkets: showSubmarkets.toString(),
      });

      if (sport) searchParams.set('sport', sport);
      if (playerName) searchParams.set('player_name', playerName);

      const response = await fetch(`/api/props?${searchParams}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const options = marketsResponse?.options || [];

  // Handle option selection/deselection
  const handleSelect = useCallback((optionValue: string) => {
    const option = options.find(opt => opt.value === optionValue);
    if (!option) return;

    const newSelectedOptions = new Map(selectedOptions);
    const newValues = [...value];

    if (value.includes(optionValue)) {
      // Deselect
      newSelectedOptions.delete(optionValue);
      const index = newValues.indexOf(optionValue);
      if (index > -1) {
        newValues.splice(index, 1);
      }
    } else if (value.length < maxSelections) {
      // Select (if under limit)
      newSelectedOptions.set(optionValue, option);
      newValues.push(optionValue);
    }

    setSelectedOptions(newSelectedOptions);
    onChange(newValues, Array.from(newSelectedOptions.values()));
  }, [options, selectedOptions, value, maxSelections, onChange]);

  // Remove selected chip
  const handleRemoveChip = useCallback((optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelectedOptions = new Map(selectedOptions);
    newSelectedOptions.delete(optionValue);

    const newValues = value.filter(v => v !== optionValue);
    setSelectedOptions(newSelectedOptions);
    onChange(newValues, Array.from(newSelectedOptions.values()));
  }, [selectedOptions, value, onChange]);

  // Clear all selections
  const handleClearAll = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedOptions(new Map());
    onChange([], []);
  }, [onChange]);

  // Get market category color
  const getMarketColor = (market: string) => {
    const marketLower = market.toLowerCase();
    if (marketLower.includes('points') || marketLower.includes('scoring')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (marketLower.includes('assists') || marketLower.includes('rebounds')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (marketLower.includes('three') || marketLower.includes('field goal')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    if (marketLower.includes('yards') || marketLower.includes('rushing') || marketLower.includes('passing')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // Format prop count
  const formatPropCount = (count: number) => {
    return count === 1 ? '1 prop' : `${count} props`;
  };

  return (
    <div className="w-full space-y-2">
      {/* Selected chips display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((selectedValue) => {
            const option = Array.from(selectedOptions.values()).find(opt => opt.value === selectedValue);
            const displayLabel = option?.label || selectedValue;

            return (
              <Badge
                key={selectedValue}
                variant="secondary"
                className={cn(
                  'pr-1 text-xs font-medium cursor-default',
                  option ? getMarketColor(option.value) : 'bg-gray-100 text-gray-700'
                )}
              >
                <span className="mr-1">{displayLabel}</span>
                <button
                  type="button"
                  className="ml-1 hover:bg-black/10 rounded-sm p-0.5"
                  onClick={(e) => handleRemoveChip(selectedValue, e)}
                  aria-label={`Remove ${displayLabel}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          {value.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Selection limit indicator */}
      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {value.length} of {maxSelections} markets selected
        </div>
      )}

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
              value.length === 0 && 'text-muted-foreground',
              error && 'border-red-500 focus:ring-red-500'
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Filter className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {value.length === 0
                  ? placeholder
                  : value.length === 1
                  ? selectedOptions.get(value[0])?.label || value[0]
                  : `${value.length} markets selected`
                }
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search markets..."
              value={query}
              onValueChange={handleQueryChange}
            />

            {isLoading && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Searching markets...
              </div>
            )}

            {queryError && (
              <div className="p-4 text-sm text-red-600 text-center">
                Failed to load markets. Please try again.
              </div>
            )}

            {!isLoading && !queryError && options.length === 0 && debouncedQuery.length >= 2 && (
              <CommandEmpty>
                No markets found for "{debouncedQuery}".
                {sport && <div className="text-xs text-muted-foreground mt-1">in {sport}</div>}
              </CommandEmpty>
            )}

            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = value.includes(option.value);
                  const canSelect = !isSelected && value.length < maxSelections;

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleSelect}
                      disabled={!isSelected && !canSelect}
                      className={cn(
                        'flex items-center justify-between p-3',
                        !canSelect && !isSelected && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {option.label}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{option.metadata.sport}</span>
                            {option.metadata.submarket && (
                              <>
                                <span>•</span>
                                <span>{option.metadata.submarket}</span>
                              </>
                            )}
                            {option.metadata.prop_count > 0 && (
                              <>
                                <span>•</span>
                                <span>{formatPropCount(option.metadata.prop_count)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getMarketColor(option.value))}
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {option.metadata.prop_count}
                        </Badge>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {marketsResponse?.meta && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/50">
                {marketsResponse.meta.filtered} of {marketsResponse.meta.total} markets
                {marketsResponse.meta.cache_hit && (
                  <span className="ml-2 text-green-600">⚡ cached</span>
                )}
                <span className="ml-2">
                  {marketsResponse.meta.execution_time_ms}ms
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